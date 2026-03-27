import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import dotenv from "dotenv";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode
} from "plaid";
import {
  calculateCouponSettlement,
  calculateScenarioSettlement
} from "./lib/calculations.js";
import { ecosystem, bidtModel } from "./lib/static-data.js";
import { readStore, writeStore } from "./lib/store.js";

dotenv.config();

const publicDir = join(process.cwd(), "public");
const port = Number(process.env.PORT || 3000);
const plaidEnvName = process.env.PLAID_ENV || "sandbox";
const plaidEnvironment = PlaidEnvironments[plaidEnvName] || PlaidEnvironments.sandbox;
const plaidConfigured = Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
const plaidClient = plaidConfigured
  ? new PlaidApi(
      new Configuration({
        basePath: plaidEnvironment,
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
            "PLAID-SECRET": process.env.PLAID_SECRET
          }
        }
      })
    )
  : null;

const bankConnections = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload));
}

function sendNoContent(res) {
  res.writeHead(204);
  res.end();
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function routeMatch(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function defaultLedger() {
  return {
    coupons: [],
    transactions: [],
    metrics: {
      totalCouponsIssued: 0,
      totalCouponsRedeemed: 0,
      totalCouponsExpired: 0,
      platformFeesCollected: 0,
      merchantReleases: 0,
      supplierReleases: 0,
      courierReleases: 0
    }
  };
}

function normalizeWalletAddress(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const walletAddress = String(value).trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    throw new Error("Wallet address must be a valid EVM address.");
  }

  return walletAddress;
}

function addTransaction(state, transaction) {
  state.transactions.unshift({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...transaction
  });
  state.transactions = state.transactions.slice(0, 50);
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/overview") {
    const store = await readStore();
    const scenarioA = calculateScenarioSettlement({
      scenario: "A",
      dozensSold: 100,
      feeRate: 0.015
    });
    const scenarioB = calculateScenarioSettlement({
      scenario: "B",
      dozensSold: 100,
      feeRate: 0.015
    });

    return json(res, 200, {
      hero: {
        title: "SBIF Florist Shop POC",
        subtitle:
          "A Web3-style smart banking prototype for merchant financing, tokenized coupons, and automated settlement."
      },
      scenarios: {
        scenarioA,
        scenarioB
      },
      ecosystem,
      bidtModel,
      openBanking: {
        provider: "Plaid",
        enabled: plaidConfigured,
        environment: plaidEnvName
      },
      ledger: store
    });
  }

  if (req.method === "GET" && pathname === "/api/open-banking/status") {
    return json(res, 200, {
      provider: "Plaid",
      enabled: plaidConfigured,
      environment: plaidEnvName
    });
  }

  if (req.method === "POST" && pathname === "/api/open-banking/create-link-token") {
    if (!plaidClient) {
      return json(res, 503, {
        error: "Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET first."
      });
    }

    const body = await parseBody(req);
    const userId = String(body.userId || `sbif-user-${randomUUID()}`);
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "SBIF Florist Platform",
      products: [Products.Auth],
      language: "en",
      country_codes: [CountryCode.Us],
      redirect_uri: process.env.PLAID_REDIRECT_URI || undefined
    });

    return json(res, 200, {
      linkToken: response.data.link_token,
      expiration: response.data.expiration
    });
  }

  if (req.method === "POST" && pathname === "/api/open-banking/exchange-public-token") {
    if (!plaidClient) {
      return json(res, 503, {
        error: "Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET first."
      });
    }

    const body = await parseBody(req);
    const publicToken = String(body.publicToken || "").trim();
    const userId = String(body.userId || "anonymous");

    if (!publicToken) {
      throw new Error("publicToken is required.");
    }

    const exchange = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;
    const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });

    bankConnections.set(userId, {
      accessToken,
      itemId,
      institutionId: body.institutionId || null,
      accounts: accountsResponse.data.accounts
    });

    return json(res, 200, {
      itemId,
      accounts: accountsResponse.data.accounts.map((account) => ({
        id: account.account_id,
        name: account.name,
        subtype: account.subtype,
        type: account.type,
        mask: account.mask,
        balances: account.balances
      }))
    });
  }

  if (req.method === "GET" && pathname === "/api/open-banking/accounts") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = url.searchParams.get("userId") || "anonymous";
    const connection = bankConnections.get(userId);

    if (!connection) {
      return json(res, 404, { error: "No connected bank account found for this user." });
    }

    return json(res, 200, {
      itemId: connection.itemId,
      accounts: connection.accounts.map((account) => ({
        id: account.account_id,
        name: account.name,
        subtype: account.subtype,
        type: account.type,
        mask: account.mask,
        balances: account.balances
      }))
    });
  }

  if (req.method === "GET" && pathname === "/api/stakeholders") {
    return json(res, 200, ecosystem);
  }

  if (req.method === "GET" && pathname === "/api/bidt") {
    return json(res, 200, bidtModel);
  }

  if (req.method === "GET" && pathname === "/api/coupons") {
    const store = await readStore();
    return json(res, 200, store);
  }

  if (req.method === "POST" && pathname === "/api/scenarios/settle") {
    const body = await parseBody(req);
    const result = calculateScenarioSettlement(body);
    return json(res, 200, result);
  }

  if (req.method === "POST" && pathname === "/api/coupons/purchase") {
    const body = await parseBody(req);
    const quantity = Number(body.quantity || 1);
    const buyerName = String(body.buyerName || "").trim();
    const paymentMethod = String(body.paymentMethod || "eHKD");
    const walletAddress = normalizeWalletAddress(body.walletAddress);
    const txHash = body.txHash ? String(body.txHash) : null;
    const contractAddress = body.contractAddress ? String(body.contractAddress) : null;
    const chainId = body.chainId ? Number(body.chainId) : null;
    const contractCouponIds = Array.isArray(body.contractCouponIds) ? body.contractCouponIds.map(Number) : [];

    if (!buyerName) {
      throw new Error("Buyer name is required.");
    }

    const store = await readStore();
    const settlement = calculateCouponSettlement({ quantity });
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt);
    expiresAt.setMonth(expiresAt.getMonth() + 12);

    for (let i = 0; i < quantity; i += 1) {
      store.coupons.push({
        id: randomUUID(),
        buyerName,
        walletAddress,
        chainId,
        contractAddress,
        contractCouponId: contractCouponIds[i] ?? null,
        purchaseTxHash: txHash,
        paymentMethod,
        status: "issued",
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        tokenPrice: 15
      });
    }

    store.metrics.totalCouponsIssued += quantity;
    addTransaction(store, {
      type: "coupon_purchase",
      buyerName,
      walletAddress,
      quantity,
      chainId,
      contractAddress,
      txHash,
      contractCouponIds,
      paymentMethod,
      value: settlement.totalPurchaseValue
    });

    await writeStore(store);
    return json(res, 201, { settlement, coupons: store.coupons.slice(-quantity) });
  }

  if (req.method === "POST" && routeMatch(pathname, "/api/coupons") && pathname.endsWith("/redeem")) {
    const body = await parseBody(req);
    const couponId = pathname.split("/")[3];
    const store = await readStore();
    const coupon = store.coupons.find((item) => item.id === couponId);

    if (!coupon) {
      return json(res, 404, { error: "Coupon not found." });
    }

    if (coupon.status !== "issued") {
      return json(res, 400, { error: "Coupon is not redeemable." });
    }

    const settlement = calculateCouponSettlement({ quantity: 1 });
    coupon.status = "redeemed";
    coupon.redeemedAt = new Date().toISOString();
    coupon.redeemTxHash = body.txHash ? String(body.txHash) : null;

    store.metrics.totalCouponsRedeemed += 1;
    store.metrics.platformFeesCollected += settlement.platformFee;
    store.metrics.merchantReleases += settlement.merchantRelease;
    store.metrics.supplierReleases += settlement.supplierRelease;
    store.metrics.courierReleases += settlement.courierRelease;

    addTransaction(store, {
      type: "coupon_redeemed",
      couponId,
      contractCouponId: coupon.contractCouponId,
      buyerName: coupon.buyerName,
      walletAddress: coupon.walletAddress,
      txHash: coupon.redeemTxHash,
      value: settlement.totalPurchaseValue
    });

    await writeStore(store);
    return json(res, 200, { coupon, settlement });
  }

  if (req.method === "POST" && pathname === "/api/coupons/process-expiry") {
    const store = await readStore();
    const now = new Date();
    let expiredCount = 0;
    let merchantReleaseTotal = 0;
    let feeTotal = 0;

    for (const coupon of store.coupons) {
      if (coupon.status === "issued" && new Date(coupon.expiresAt) <= now) {
        const settlement = calculateCouponSettlement({ quantity: 1 });
        coupon.status = "expired";
        coupon.expiredAt = now.toISOString();
        expiredCount += 1;
        merchantReleaseTotal += settlement.tokenPrice - settlement.platformFee;
        feeTotal += settlement.platformFee;
      }
    }

    if (expiredCount > 0) {
      store.metrics.totalCouponsExpired += expiredCount;
      store.metrics.platformFeesCollected += feeTotal;
      store.metrics.merchantReleases += merchantReleaseTotal;
      addTransaction(store, {
        type: "coupon_expiry_processed",
        quantity: expiredCount,
        value: merchantReleaseTotal
      });
      await writeStore(store);
    }

    return json(res, 200, {
      expiredCount,
      merchantReleaseTotal: Number(merchantReleaseTotal.toFixed(2)),
      platformFeeTotal: Number(feeTotal.toFixed(2))
    });
  }

  if (req.method === "DELETE" && pathname === "/api/coupons") {
    await writeStore(defaultLedger());
    return sendNoContent(res);
  }

  return false;
}

async function serveStatic(res, pathname) {
  if (pathname === "/vendor/ethers.umd.min.js") {
    const vendorPath = join(process.cwd(), "node_modules", "ethers", "dist", "ethers.umd.min.js");
    const data = await readFile(vendorPath);
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8"
    });
    res.end(data);
    return;
  }

  const safePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = join(publicDir, normalize(safePath));

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream"
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

export function createAppServer() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const handled = url.pathname.startsWith("/api/")
        ? await handleApi(req, res, url.pathname)
        : false;

      if (handled === false) {
        await serveStatic(res, url.pathname);
      }
    } catch (error) {
      json(res, 400, { error: error.message || "Unknown error" });
    }
  });
}

if (process.env.NODE_ENV !== "test") {
  createAppServer().listen(port, () => {
    console.log(`SBIF florist app running at http://localhost:${port}`);
  });
}
