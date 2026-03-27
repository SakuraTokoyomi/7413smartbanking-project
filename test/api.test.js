process.env.NODE_ENV = "test";

import test from "node:test";
import assert from "node:assert/strict";
import { resetStore, writeStore } from "../lib/store.js";

let server;
let baseUrl;
let createAppServer;

test.before(async () => {
  ({ createAppServer } = await import("../server.js"));
  await resetStore();
  server = createAppServer();
  await new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await resetStore();
});

test("overview endpoint returns dashboard payload", async () => {
  const response = await fetch(`${baseUrl}/api/overview`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.hero.title, "SBIF Florist Shop POC");
  assert.equal(payload.scenarios.scenarioA.merchantNetProfit, 90);
});

test("open banking status reports disabled when creds are missing", async () => {
  const response = await fetch(`${baseUrl}/api/open-banking/status`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.provider, "Plaid");
  assert.equal(payload.enabled, false);
});

test("open banking link token creation is blocked without Plaid credentials", async () => {
  const response = await fetch(`${baseUrl}/api/open-banking/create-link-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: "demo-user" })
  });
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.match(payload.error, /Plaid is not configured/);
});

test("coupon purchase and redeem flow updates ledger", async () => {
  const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";
  const purchase = await fetch(`${baseUrl}/api/coupons/purchase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      buyerName: "John",
      quantity: 1,
      paymentMethod: "eHKD",
      walletAddress
    })
  });
  const purchasePayload = await purchase.json();

  assert.equal(purchase.status, 201);
  assert.equal(purchasePayload.coupons.length, 1);
  assert.equal(purchasePayload.coupons[0].walletAddress, walletAddress);

  const couponId = purchasePayload.coupons[0].id;
  const redeem = await fetch(`${baseUrl}/api/coupons/${couponId}/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  const redeemPayload = await redeem.json();

  assert.equal(redeem.status, 200);
  assert.equal(redeemPayload.coupon.status, "redeemed");

  const storeResponse = await fetch(`${baseUrl}/api/coupons`);
  const storePayload = await storeResponse.json();

  assert.equal(storePayload.metrics.totalCouponsIssued, 1);
  assert.equal(storePayload.metrics.totalCouponsRedeemed, 1);
  assert.equal(storePayload.metrics.platformFeesCollected, 0.45);
  assert.equal(storePayload.transactions[0].walletAddress, walletAddress);
});

test("purchase rejects malformed wallet addresses", async () => {
  const response = await fetch(`${baseUrl}/api/coupons/purchase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      buyerName: "John",
      quantity: 1,
      paymentMethod: "USDC",
      walletAddress: "bad-wallet"
    })
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.error, /Wallet address must be a valid EVM address/);
});

test("expiry processing settles issued expired coupons to merchant", async () => {
  await writeStore({
    coupons: [
      {
        id: "expired-1",
        buyerName: "Alice",
        paymentMethod: "USDC",
        status: "issued",
        issuedAt: "2024-01-01T00:00:00.000Z",
        expiresAt: "2024-02-01T00:00:00.000Z",
        tokenPrice: 15
      }
    ],
    transactions: [],
    metrics: {
      totalCouponsIssued: 1,
      totalCouponsRedeemed: 0,
      totalCouponsExpired: 0,
      platformFeesCollected: 0,
      merchantReleases: 0,
      supplierReleases: 0,
      courierReleases: 0
    }
  });

  const response = await fetch(`${baseUrl}/api/coupons/process-expiry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.expiredCount, 1);
  assert.equal(payload.merchantReleaseTotal, 14.55);
});
