const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1
});

const walletState = {
  provider: null,
  browserProvider: null,
  signer: null,
  account: null,
  chainIdHex: null,
  contractConfig: null,
  contract: null
};

const bankState = {
  status: null,
  userId: `bank-user-${Math.random().toString(36).slice(2, 10)}`,
  accounts: [],
  itemId: null
};

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function shortAddress(address) {
  if (!address) {
    return "Not connected";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function chainLabel(chainIdHex) {
  const labels = {
    "0x1": "Ethereum Mainnet",
    "0x89": "Polygon",
    "0xaa36a7": "Sepolia",
    "0x539": "Ganache Localhost"
  };

  return labels[chainIdHex] || `Chain ${chainIdHex || "unknown"}`;
}

function formatContractRequirement() {
  const config = walletState.contractConfig;
  if (!config || !config.contractAddress) {
    return "Contract not deployed. Run the local Hardhat node and deploy script first.";
  }

  return `Contract ${shortAddress(config.contractAddress)} on ${config.networkName}.`;
}

function renderWalletStatus() {
  const container = document.getElementById("wallet-status");
  const addressField = document.getElementById("wallet-address-field");
  const feedback = document.getElementById("wallet-feedback");

  if (!walletState.provider) {
    container.innerHTML = `
      <h3>Wallet status</h3>
      <p>No injected wallet detected. Install MetaMask to use on-chain purchase and redemption.</p>
    `;
    addressField.value = "";
    feedback.textContent = formatContractRequirement();
    return;
  }

  if (!walletState.account) {
    container.innerHTML = `
      <h3>Wallet status</h3>
      <p>Wallet detected. Connect it to sign real contract transactions.</p>
    `;
    addressField.value = "";
    feedback.textContent = formatContractRequirement();
    return;
  }

  addressField.value = walletState.account;
  container.innerHTML = `
    <h3>Wallet connected</h3>
    <p>Address: <strong>${shortAddress(walletState.account)}</strong></p>
    <p>Network: <strong>${chainLabel(walletState.chainIdHex)}</strong></p>
  `;
  feedback.textContent = "Wallet is ready. New coupon purchase and redemption will call the Solidity contract first, then sync the app ledger.";
}

function renderContractStatus() {
  const container = document.getElementById("contract-status");
  const config = walletState.contractConfig;

  if (!config || !config.contractAddress) {
    container.innerHTML = `
      <h3>Contract status</h3>
      <p>No deployed contract configured yet. After deployment, this panel will show the live address.</p>
    `;
    return;
  }

  container.innerHTML = `
    <h3>Contract ready</h3>
    <p>Address: <strong>${shortAddress(config.contractAddress)}</strong></p>
    <p>Network: <strong>${config.networkName}</strong></p>
  `;
}

function renderBankStatus() {
  const container = document.getElementById("bank-status");
  const feedback = document.getElementById("bank-feedback");

  if (!bankState.status?.enabled) {
    container.innerHTML = `
      <h3>Bank connection</h3>
      <p>Plaid is not configured yet. Add server env vars to enable official open banking connectivity.</p>
    `;
    feedback.textContent = "Set PLAID_CLIENT_ID and PLAID_SECRET to enable the bank flow.";
    return;
  }

  if (!bankState.itemId) {
    container.innerHTML = `
      <h3>Bank connection</h3>
      <p>Plaid ${bankState.status.environment} is ready. Connect a bank account to pull account balances through the official API.</p>
    `;
    return;
  }

  container.innerHTML = `
    <h3>Bank connected</h3>
    <p>Provider: <strong>Plaid ${bankState.status.environment}</strong></p>
    <p>Item: <strong>${shortAddress(bankState.itemId)}</strong></p>
  `;
  feedback.textContent = "Bank account connection established through Plaid. Account data below is fetched from the API.";
}

function renderBankAccounts(accounts) {
  const container = document.getElementById("bank-accounts");
  if (!accounts.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = accounts
    .map(
      (account) => `
        <article class="bank-account">
          <h3>${account.name}</h3>
          <p>${account.type} / ${account.subtype || "n/a"} / ****${account.mask || "0000"}</p>
          <p>Available: ${account.balances.available ?? "n/a"} ${account.balances.iso_currency_code || "USD"}</p>
          <p>Current: ${account.balances.current ?? "n/a"} ${account.balances.iso_currency_code || "USD"}</p>
        </article>
      `
    )
    .join("");
}

function renderMetricGrid(container, items) {
  container.innerHTML = items
    .map(
      ({ label, value, note = "" }) => `
        <article class="metric-card">
          <h3>${label}</h3>
          <strong>${value}</strong>
          <p>${note}</p>
        </article>
      `
    )
    .join("");
}

function renderStakeholders(stakeholders) {
  const container = document.getElementById("stakeholders");
  container.innerHTML = stakeholders
    .map(
      (item) => `
        <article class="stack-item">
          <h3>${item.stakeholder}</h3>
          <p>${item.benefit}</p>
        </article>
      `
    )
    .join("");
}

function renderBidt(model) {
  const container = document.getElementById("bidt");
  container.innerHTML = Object.values(model)
    .map(
      (section) => `
        <article class="bidt-item">
          <h3>${section.title}</h3>
          <ul class="compact-list">${section.points.map((point) => `<li>${point}</li>`).join("")}</ul>
        </article>
      `
    )
    .join("");
}

function renderCoupons(coupons) {
  const container = document.getElementById("coupon-list");
  if (coupons.length === 0) {
    container.innerHTML = `<div class="stack-item"><p>No coupons issued yet.</p></div>`;
    return;
  }

  container.innerHTML = coupons
    .slice()
    .reverse()
    .map(
      (coupon) => `
        <div class="coupon-row">
          <div>
            <strong>${coupon.buyerName}</strong>
            <p>Local ${coupon.id}</p>
          </div>
          <div>
            <strong>${coupon.contractCouponId ? `Chain #${coupon.contractCouponId}` : coupon.paymentMethod}</strong>
            <p>${coupon.walletAddress ? shortAddress(coupon.walletAddress) : coupon.status}</p>
          </div>
          <div>
            <strong>${currency.format(coupon.tokenPrice)}</strong>
            <p>Expires ${new Date(coupon.expiresAt).toLocaleDateString()}</p>
          </div>
          <div>
            <strong>${coupon.status}</strong>
            <p>${coupon.purchaseTxHash ? shortAddress(coupon.purchaseTxHash) : "No chain tx"}</p>
          </div>
          <button ${coupon.status !== "issued" ? "disabled" : ""} data-redeem="${coupon.id}">
            Redeem
          </button>
        </div>
      `
    )
    .join("");
}

function renderTransactions(transactions) {
  const container = document.getElementById("transactions");
  if (transactions.length === 0) {
    container.innerHTML = `<div class="stack-item"><p>No transactions yet.</p></div>`;
    return;
  }

  container.innerHTML = transactions
    .map(
      (entry) => `
        <article class="stack-item">
          <h3>${entry.type}</h3>
          <p>${new Date(entry.timestamp).toLocaleString()} | ${entry.buyerName || "system"} | ${currency.format(entry.value || 0)}</p>
          <p>${entry.walletAddress ? `Wallet ${shortAddress(entry.walletAddress)}` : "No wallet attached"}</p>
          <p>${entry.txHash ? `Tx ${shortAddress(entry.txHash)}` : "No chain transaction recorded"}</p>
        </article>
      `
    )
    .join("");
}

function renderLedgerMetrics(metrics) {
  renderMetricGrid(document.getElementById("metrics"), [
    { label: "Coupons Issued", value: metrics.totalCouponsIssued, note: "Total prepaid tokens minted." },
    { label: "Coupons Redeemed", value: metrics.totalCouponsRedeemed, note: "On-chain redemption synced back to app ledger." },
    { label: "Coupons Expired", value: metrics.totalCouponsExpired, note: "Expired and settled to merchant." },
    { label: "Platform Fees", value: currency.format(metrics.platformFeesCollected), note: "BaaS/BaaP revenue." },
    { label: "Merchant Release", value: currency.format(metrics.merchantReleases), note: "Net value to florist." },
    { label: "Supplier Release", value: currency.format(metrics.supplierReleases), note: "Conditional supplier payout." },
    { label: "Courier Release", value: currency.format(metrics.courierReleases), note: "Delivery-triggered payout." }
  ]);
}

function renderScenario(result) {
  renderMetricGrid(document.getElementById("scenario-result"), [
    { label: "Gross Revenue", value: currency.format(result.grossRevenue), note: `Sales of ${result.dozensSold} dozen.` },
    { label: "Investor Gross", value: currency.format(result.investorGrossEntitlement), note: `Scenario ${result.scenario} entitlement.` },
    { label: "Investor Profit", value: currency.format(result.investorProfit), note: `${percent.format(result.investorReturnRate)} weekly return on principal.` },
    { label: "Annualized ROI", value: percent.format(result.annualizedInvestorRoi), note: "Simple annualized return." },
    { label: "Platform Fee", value: currency.format(result.platformFee), note: `${percent.format(result.platformFeeRate)} fee rate.` },
    { label: "Merchant Net Profit", value: currency.format(result.merchantNetProfit), note: result.merchantRoi === null ? "ROI undefined when merchant invests $0." : `${percent.format(result.merchantRoi)} ROI.` }
  ]);
}

async function refreshDashboard() {
  const data = await request("/api/overview");
  renderScenario(data.scenarios.scenarioA);
  renderLedgerMetrics(data.ledger.metrics);
  renderCoupons(data.ledger.coupons);
  renderTransactions(data.ledger.transactions);
  renderStakeholders(data.ecosystem.stakeholders);
  renderBidt(data.bidtModel);
  window.__couponCache = data.ledger.coupons;
}

async function loadOpenBankingStatus() {
  bankState.status = await request("/api/open-banking/status");
  renderBankStatus();
}

async function loadContractConfig() {
  const response = await fetch("/contract-config.json");
  walletState.contractConfig = await response.json();
  renderContractStatus();
}

async function syncWalletState() {
  walletState.provider = window.ethereum || null;
  if (!walletState.provider) {
    renderWalletStatus();
    return;
  }

  const accounts = await walletState.provider.request({ method: "eth_accounts" });
  walletState.account = accounts[0] || null;
  walletState.chainIdHex = await walletState.provider.request({ method: "eth_chainId" });

  if (walletState.account) {
    walletState.browserProvider = new window.ethers.BrowserProvider(walletState.provider);
    walletState.signer = await walletState.browserProvider.getSigner();
    await instantiateContract();
  }

  renderWalletStatus();
}

async function instantiateContract() {
  const config = walletState.contractConfig;
  if (!walletState.browserProvider || !walletState.signer || !config?.contractAddress || !config.abi?.length) {
    walletState.contract = null;
    return;
  }

  walletState.contract = new window.ethers.Contract(
    config.contractAddress,
    config.abi,
    walletState.signer
  );
}

async function connectWallet() {
  const feedback = document.getElementById("wallet-feedback");
  if (!window.ethereum) {
    feedback.textContent = "No EVM wallet detected. Install MetaMask first.";
    renderWalletStatus();
    return;
  }

  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    await syncWalletState();
  } catch (error) {
    feedback.textContent = error.message || "Wallet connection was rejected.";
  }
}

function disconnectWallet() {
  walletState.browserProvider = null;
  walletState.signer = null;
  walletState.account = null;
  walletState.contract = null;
  walletState.chainIdHex = null;
  document.getElementById("wallet-address-field").value = "";
  renderWalletStatus();
  document.getElementById("wallet-feedback").textContent = "Local wallet session cleared. Browser wallet remains installed.";
}

async function switchToLocalChain() {
  const feedback = document.getElementById("wallet-feedback");
  if (!window.ethereum || !walletState.contractConfig?.chainId) {
    feedback.textContent = "Wallet or contract config is not ready.";
    return;
  }

  const hexChainId = `0x${Number(walletState.contractConfig.chainId).toString(16)}`;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }]
    });
  } catch (error) {
    if (error.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hexChainId,
          chainName: "Hardhat Localhost",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["http://127.0.0.1:8545"]
        }]
      });
    } else {
      feedback.textContent = error.message || "Could not switch chain.";
      return;
    }
  }

  await syncWalletState();
}

async function ensureReadyForContractAction() {
  if (!walletState.account) {
    throw new Error("Connect your wallet before using on-chain purchase or redemption.");
  }

  if (!walletState.contractConfig?.contractAddress || !walletState.contract) {
    throw new Error("Contract not deployed yet. Run the local chain and deployment script first.");
  }

  const expectedHex = `0x${Number(walletState.contractConfig.chainId).toString(16)}`;
  if (walletState.chainIdHex?.toLowerCase() !== expectedHex.toLowerCase()) {
    throw new Error(`Switch wallet network to ${walletState.contractConfig.networkName} before continuing.`);
  }
}

function extractEventArgs(receipt, eventName) {
  return receipt.logs
    .map((log) => {
      try {
        return walletState.contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((entry) => entry.name === eventName)
    .map((entry) => entry.args);
}

async function handleScenarioSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const result = await request("/api/scenarios/settle", {
    method: "POST",
    body: JSON.stringify({
      scenario: form.get("scenario"),
      dozensSold: Number(form.get("dozensSold")),
      feeRate: Number(form.get("feeRate"))
    })
  });
  renderScenario(result);
}

async function connectBank() {
  const feedback = document.getElementById("bank-feedback");

  try {
    if (!bankState.status?.enabled) {
      throw new Error("Open banking is not configured on the server yet.");
    }

    const tokenResponse = await request("/api/open-banking/create-link-token", {
      method: "POST",
      body: JSON.stringify({ userId: bankState.userId })
    });

    if (!window.Plaid) {
      throw new Error("Plaid Link script did not load.");
    }

    const handler = window.Plaid.create({
      token: tokenResponse.linkToken,
      onSuccess: async (publicToken, metadata) => {
        const exchange = await request("/api/open-banking/exchange-public-token", {
          method: "POST",
          body: JSON.stringify({
            publicToken,
            userId: bankState.userId,
            institutionId: metadata?.institution?.institution_id || null
          })
        });

        bankState.itemId = exchange.itemId;
        bankState.accounts = exchange.accounts;
        renderBankStatus();
        renderBankAccounts(bankState.accounts);
      },
      onExit: (error) => {
        if (error) {
          feedback.textContent = error.display_message || error.error_message || "Plaid Link exited with an error.";
        }
      }
    });

    handler.open();
  } catch (error) {
    feedback.textContent = error.message;
  }
}

async function refreshBankAccounts() {
  const feedback = document.getElementById("bank-feedback");

  try {
    const response = await request(`/api/open-banking/accounts?userId=${encodeURIComponent(bankState.userId)}`);
    bankState.itemId = response.itemId;
    bankState.accounts = response.accounts;
    renderBankStatus();
    renderBankAccounts(bankState.accounts);
  } catch (error) {
    feedback.textContent = error.message;
  }
}

async function handlePurchase(event) {
  event.preventDefault();
  const feedback = document.getElementById("coupon-feedback");
  const form = new FormData(event.currentTarget);

  try {
    await ensureReadyForContractAction();

    const quantity = Number(form.get("quantity"));
    const buyerName = String(form.get("buyerName"));
    const tx = await walletState.contract.purchaseCoupon(quantity, buyerName, {
      value: BigInt(walletState.contractConfig.tokenPriceWei) * BigInt(quantity)
    });
    const receipt = await tx.wait();
    const purchaseEvents = extractEventArgs(receipt, "CouponPurchased");
    const contractCouponIds = purchaseEvents.map((args) => Number(args.couponId));

    const result = await request("/api/coupons/purchase", {
      method: "POST",
      body: JSON.stringify({
        buyerName,
        walletAddress: walletState.account,
        quantity,
        paymentMethod: form.get("paymentMethod"),
        txHash: receipt.hash,
        chainId: Number(walletState.contractConfig.chainId),
        contractAddress: walletState.contractConfig.contractAddress,
        contractCouponIds
      })
    });

    feedback.textContent = `On-chain purchase confirmed. Issued ${result.settlement.quantity} coupon(s) in tx ${shortAddress(receipt.hash)}.`;
    await refreshDashboard();
  } catch (error) {
    feedback.textContent = error.message;
  }
}

async function handleCouponActions(event) {
  const button = event.target.closest("[data-redeem]");
  if (!button) {
    return;
  }

  const feedback = document.getElementById("coupon-feedback");
  const coupon = (window.__couponCache || []).find((entry) => entry.id === button.dataset.redeem);

  try {
    await ensureReadyForContractAction();

    if (!coupon?.contractCouponId) {
      throw new Error("This coupon is missing an on-chain coupon id.");
    }

    const tx = await walletState.contract.redeemCoupon(coupon.contractCouponId);
    const receipt = await tx.wait();
    const result = await request(`/api/coupons/${coupon.id}/redeem`, {
      method: "POST",
      body: JSON.stringify({ txHash: receipt.hash })
    });

    feedback.textContent = `On-chain redemption confirmed for coupon #${coupon.contractCouponId}. Merchant received ${currency.format(result.settlement.merchantRelease)} after settlement.`;
    await refreshDashboard();
  } catch (error) {
    feedback.textContent = error.message;
  }
}

async function handleProcessExpiry() {
  const result = await request("/api/coupons/process-expiry", {
    method: "POST",
    body: JSON.stringify({})
  });
  document.getElementById("coupon-feedback").textContent = `Processed ${result.expiredCount} expired coupon(s). Merchant release ${currency.format(result.merchantReleaseTotal)}.`;
  await refreshDashboard();
}

async function handleReset() {
  await request("/api/coupons", { method: "DELETE" });
  document.getElementById("coupon-feedback").textContent = "Demo ledger reset.";
  await refreshDashboard();
}

function bindWalletEvents() {
  if (!window.ethereum) {
    renderWalletStatus();
    return;
  }

  window.ethereum.on("accountsChanged", async (accounts) => {
    walletState.account = accounts[0] || null;
    walletState.browserProvider = walletState.account ? new window.ethers.BrowserProvider(window.ethereum) : null;
    walletState.signer = walletState.account ? await walletState.browserProvider.getSigner() : null;
    await instantiateContract();
    renderWalletStatus();
  });

  window.ethereum.on("chainChanged", async (chainId) => {
    walletState.chainIdHex = chainId;
    if (walletState.account) {
      walletState.browserProvider = new window.ethers.BrowserProvider(window.ethereum);
      walletState.signer = await walletState.browserProvider.getSigner();
      await instantiateContract();
    }
    renderWalletStatus();
  });
}

document.getElementById("scenario-form").addEventListener("submit", handleScenarioSubmit);
document.getElementById("purchase-form").addEventListener("submit", handlePurchase);
document.getElementById("coupon-list").addEventListener("click", handleCouponActions);
document.getElementById("process-expiry").addEventListener("click", handleProcessExpiry);
document.getElementById("reset-ledger").addEventListener("click", handleReset);
document.getElementById("connect-wallet").addEventListener("click", connectWallet);
document.getElementById("disconnect-wallet").addEventListener("click", disconnectWallet);
document.getElementById("switch-network").addEventListener("click", switchToLocalChain);
document.getElementById("connect-bank").addEventListener("click", connectBank);
document.getElementById("refresh-bank").addEventListener("click", refreshBankAccounts);

Promise.all([loadContractConfig(), syncWalletState(), refreshDashboard(), loadOpenBankingStatus()])
  .then(() => {
    bindWalletEvents();
    renderWalletStatus();
    renderContractStatus();
    renderBankStatus();
    renderBankAccounts(bankState.accounts);
  })
  .catch((error) => {
    document.getElementById("coupon-feedback").textContent = error.message;
  });
