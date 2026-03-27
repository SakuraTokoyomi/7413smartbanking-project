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
  settlementContract: null,
  complianceContract: null
};

const chainState = {
  coupons: [],
  events: [],
  complianceRecord: null
};

const stakeholders = [
  {
    stakeholder: "Investors / Sponsors",
    benefit: "Observe public on-chain coupon issuance and redemption while funding the merchant ecosystem."
  },
  {
    stakeholder: "Florist Merchant",
    benefit: "Uses a permissioned public-chain workflow to raise capital and automate conditional settlement."
  },
  {
    stakeholder: "Buyers / Supporters",
    benefit: "Redeem on-chain coupon positions once their wallet receives compliance clearance."
  },
  {
    stakeholder: "Suppliers",
    benefit: "Receive deterministic settlement routed directly by the smart contract."
  },
  {
    stakeholder: "Courier / Logistics",
    benefit: "Gets programmatic payment when coupon redemption is executed."
  },
  {
    stakeholder: "Compliance / RegTech Operator",
    benefit: "Publishes AML or open-banking screening outcomes as on-chain permission records."
  }
];

const bidtModel = [
  {
    title: "Business",
    points: [
      "Raise florist working capital through tokenized prepaid coupons and programmable settlement.",
      "Use a public blockchain but restrict business access to AML-cleared wallets."
    ]
  },
  {
    title: "Information",
    points: [
      "Store coupon issuance, redemption, expiry, and compliance attestations on-chain.",
      "Make the buyer wallet the primary digital identity in the system."
    ]
  },
  {
    title: "Digital",
    points: [
      "Represent compliance outcomes as registry records instead of hidden database checks.",
      "Expose a dApp interface that reads live state and historical events from the chain."
    ]
  },
  {
    title: "Technology",
    points: [
      "Use Solidity contracts for token transaction logging and settlement.",
      "Use a compliance registry to model permissioned access on a public chain."
    ]
  }
];

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

function formatTimestamp(unixSeconds) {
  if (!unixSeconds) {
    return "n/a";
  }

  return new Date(Number(unixSeconds) * 1000).toLocaleString();
}

function metricCard(label, value, note = "") {
  return `
    <article class="metric-card">
      <h3>${label}</h3>
      <strong>${value}</strong>
      <p>${note}</p>
    </article>
  `;
}

function calculateScenarioSettlement({ scenario, dozensSold, feeRate }) {
  const principal = scenario === "A" ? 200 : 1200;
  const payoutPerDozen = scenario === "A" ? 2.1 : 12.6;
  const merchantCogs = scenario === "A" ? dozensSold * 10 : 0;
  const grossRevenue = dozensSold * 20;
  const investorGrossEntitlement = dozensSold * payoutPerDozen;
  const investorProfit = investorGrossEntitlement - principal;
  const investorReturnRate = investorProfit / principal;
  const annualizedInvestorRoi = investorReturnRate * 52;
  const platformFee = investorGrossEntitlement * feeRate;
  const merchantNetProfit = grossRevenue - merchantCogs - investorGrossEntitlement - 700;
  const merchantRoi = scenario === "A" ? merchantNetProfit / principal : null;

  return {
    scenario,
    dozensSold,
    grossRevenue,
    investorGrossEntitlement,
    investorProfit,
    investorReturnRate,
    annualizedInvestorRoi,
    platformFee,
    feeRate,
    merchantNetProfit,
    merchantRoi
  };
}

function renderScenario(result) {
  document.getElementById("scenario-result").innerHTML = [
    metricCard("Gross Revenue", currency.format(result.grossRevenue), `Sales of ${result.dozensSold} dozen.`),
    metricCard("Investor Gross", currency.format(result.investorGrossEntitlement), `Scenario ${result.scenario} entitlement.`),
    metricCard("Investor Profit", currency.format(result.investorProfit), `${percent.format(result.investorReturnRate)} weekly return.`),
    metricCard("Annualized ROI", percent.format(result.annualizedInvestorRoi), "Simple annualized return."),
    metricCard("Platform Fee", currency.format(result.platformFee), `${percent.format(result.feeRate)} fee rate.`),
    metricCard(
      "Merchant Net Profit",
      currency.format(result.merchantNetProfit),
      result.merchantRoi === null ? "ROI undefined when merchant invests $0." : `${percent.format(result.merchantRoi)} ROI.`
    )
  ].join("");
}

function renderStakeholders() {
  document.getElementById("stakeholders").innerHTML = stakeholders
    .map((item) => `
      <article class="stack-item">
        <h3>${item.stakeholder}</h3>
        <p>${item.benefit}</p>
      </article>
    `)
    .join("");
}

function renderBidt() {
  document.getElementById("bidt").innerHTML = bidtModel
    .map((section) => `
      <article class="bidt-item">
        <h3>${section.title}</h3>
        <ul class="compact-list">${section.points.map((point) => `<li>${point}</li>`).join("")}</ul>
      </article>
    `)
    .join("");
}

function renderWalletStatus() {
  const container = document.getElementById("wallet-status");
  const feedback = document.getElementById("wallet-feedback");
  const targetField = document.getElementById("target-address-field");

  if (!walletState.provider) {
    container.innerHTML = `
      <h3>Wallet status</h3>
      <p>No injected wallet detected. Install MetaMask to use the dApp.</p>
    `;
    feedback.textContent = "This frontend reads contracts directly from the blockchain.";
    return;
  }

  if (!walletState.account) {
    container.innerHTML = `
      <h3>Wallet status</h3>
      <p>Wallet detected. Connect it to read compliance status and send transactions.</p>
    `;
    return;
  }

  targetField.value = walletState.account;
  container.innerHTML = `
    <h3>Wallet connected</h3>
    <p>Address: <strong>${shortAddress(walletState.account)}</strong></p>
    <p>Network: <strong>${chainLabel(walletState.chainIdHex)}</strong></p>
  `;
  feedback.textContent = "Wallet connected. Purchase and redeem will only work after the wallet has an on-chain compliance record.";
}

function renderContractStatus() {
  const container = document.getElementById("contract-status");
  const config = walletState.contractConfig;

  if (!config || !config.settlementContractAddress || !config.complianceRegistryAddress) {
    container.innerHTML = `
      <h3>Contract status</h3>
      <p>Contracts not deployed yet. Compile and deploy both contracts first.</p>
    `;
    return;
  }

  container.innerHTML = `
    <h3>Contracts ready</h3>
    <p>Settlement: <strong>${shortAddress(config.settlementContractAddress)}</strong></p>
    <p>Compliance: <strong>${shortAddress(config.complianceRegistryAddress)}</strong></p>
    <p>Network: <strong>${config.networkName}</strong></p>
  `;
}

function renderComplianceStatus() {
  const container = document.getElementById("compliance-status");
  const feedback = document.getElementById("compliance-feedback");
  const record = chainState.complianceRecord;

  if (!walletState.account) {
    container.innerHTML = `
      <h3>Compliance status</h3>
      <p>Connect a wallet to query or manage compliance permissions.</p>
    `;
    return;
  }

  if (!record || !record.approved || record.expiry <= Math.floor(Date.now() / 1000)) {
    container.innerHTML = `
      <h3>Compliance status</h3>
      <p>Wallet <strong>${shortAddress(walletState.account)}</strong> is not currently approved.</p>
    `;
    feedback.textContent = "A compliance admin must grant a screening result before this wallet can purchase or redeem.";
    return;
  }

  container.innerHTML = `
    <h3>Compliance active</h3>
    <p>Wallet: <strong>${shortAddress(walletState.account)}</strong></p>
    <p>Method: <strong>${record.methodText}</strong></p>
    <p>Expires: <strong>${formatTimestamp(record.expiry)}</strong></p>
  `;
  feedback.textContent = "This wallet is permissioned to transact on the public chain.";
}

function renderMetrics(metrics) {
  document.getElementById("metrics").innerHTML = [
    metricCard("Coupons Issued", metrics.couponCount, "Total coupons minted on-chain."),
    metricCard("Coupons Redeemed", metrics.totalCouponsRedeemed, "Redemptions finalized by the contract."),
    metricCard("Coupons Expired", metrics.totalCouponsExpired, "Expiry settlements released by merchant action."),
    metricCard("Platform Fees", currency.format(metrics.totalPlatformFeesCollected), "On-chain fee accumulation."),
    metricCard("Merchant Release", currency.format(metrics.totalMerchantReleased), "Value released to florist."),
    metricCard("Supplier Release", currency.format(metrics.totalSupplierReleased), "Supplier distribution."),
    metricCard("Courier Release", currency.format(metrics.totalCourierReleased), "Courier distribution.")
  ].join("");
}

function renderCoupons(coupons) {
  const container = document.getElementById("coupon-list");
  if (!coupons.length) {
    container.innerHTML = `<div class="stack-item"><p>No coupons issued on-chain yet.</p></div>`;
    return;
  }

  container.innerHTML = coupons
    .slice()
    .reverse()
    .map((coupon) => `
      <div class="coupon-row">
        <div>
          <strong>${coupon.buyerName}</strong>
          <p>Coupon #${coupon.id}</p>
        </div>
        <div>
          <strong>${shortAddress(coupon.owner)}</strong>
          <p>${coupon.redeemed ? "redeemed" : coupon.expiredProcessed ? "expired" : "issued"}</p>
        </div>
        <div>
          <strong>${currency.format(15)}</strong>
          <p>Issued ${formatTimestamp(coupon.issuedAt)}</p>
        </div>
        <div>
          <strong>${formatTimestamp(coupon.expiresAt)}</strong>
          <p>${coupon.redeemed ? "Redeemed" : coupon.expiredProcessed ? "Expired settled" : "Active"}</p>
        </div>
        <button ${coupon.redeemed || coupon.expiredProcessed ? "disabled" : ""} data-redeem="${coupon.id}">
          Redeem
        </button>
      </div>
    `)
    .join("");
}

function renderTransactions(events) {
  const container = document.getElementById("transactions");
  if (!events.length) {
    container.innerHTML = `<div class="stack-item"><p>No blockchain events yet.</p></div>`;
    return;
  }

  container.innerHTML = events
    .slice()
    .reverse()
    .map((event) => `
      <article class="stack-item">
        <h3>${event.type}</h3>
        <p>${event.details}</p>
        <p>Block ${event.blockNumber} | Tx ${shortAddress(event.transactionHash)}</p>
      </article>
    `)
    .join("");
}

async function loadContractConfig() {
  const response = await fetch("./contract-config.json");
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
    await instantiateContracts();
  }

  renderWalletStatus();
}

async function instantiateContracts() {
  const config = walletState.contractConfig;
  if (
    !walletState.browserProvider ||
    !walletState.signer ||
    !config?.settlementContractAddress ||
    !config?.complianceRegistryAddress ||
    !config?.settlementAbi?.length ||
    !config?.complianceRegistryAbi?.length
  ) {
    walletState.settlementContract = null;
    walletState.complianceContract = null;
    return;
  }

  walletState.settlementContract = new window.ethers.Contract(
    config.settlementContractAddress,
    config.settlementAbi,
    walletState.signer
  );
  walletState.complianceContract = new window.ethers.Contract(
    config.complianceRegistryAddress,
    config.complianceRegistryAbi,
    walletState.signer
  );
}

async function connectWallet() {
  const feedback = document.getElementById("wallet-feedback");
  if (!window.ethereum) {
    feedback.textContent = "No EVM wallet detected. Install MetaMask first.";
    return;
  }

  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    await syncWalletState();
    await refreshOnChainData();
  } catch (error) {
    feedback.textContent = error.message || "Wallet connection was rejected.";
  }
}

function disconnectWallet() {
  walletState.browserProvider = null;
  walletState.signer = null;
  walletState.account = null;
  walletState.settlementContract = null;
  walletState.complianceContract = null;
  walletState.chainIdHex = null;
  chainState.complianceRecord = null;
  renderWalletStatus();
  renderComplianceStatus();
  document.getElementById("wallet-feedback").textContent = "Local wallet session cleared.";
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
          chainName: walletState.contractConfig.networkName,
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
  await refreshOnChainData();
}

async function ensureReadyForContractAction() {
  if (!walletState.account) {
    throw new Error("Connect your wallet before using on-chain actions.");
  }

  if (!walletState.settlementContract || !walletState.complianceContract) {
    throw new Error("Contracts not deployed or not loaded yet.");
  }

  const expectedHex = `0x${Number(walletState.contractConfig.chainId).toString(16)}`;
  if (walletState.chainIdHex?.toLowerCase() !== expectedHex.toLowerCase()) {
    throw new Error(`Switch wallet network to ${walletState.contractConfig.networkName} before continuing.`);
  }
}

async function loadComplianceRecord() {
  if (!walletState.account || !walletState.complianceContract) {
    chainState.complianceRecord = null;
    renderComplianceStatus();
    return;
  }

  const record = await walletState.complianceContract.getRecord(walletState.account);
  chainState.complianceRecord = {
    approved: record.approved,
    expiry: Number(record.expiry),
    method: record.method,
    methodText: record.method === "0x0000000000000000000000000000000000000000000000000000000000000000"
      ? "NONE"
      : window.ethers.decodeBytes32String(record.method),
    updatedAt: Number(record.updatedAt)
  };
  renderComplianceStatus();
}

async function loadChainMetrics() {
  if (!walletState.settlementContract) {
    renderMetrics({
      couponCount: 0,
      totalCouponsRedeemed: 0,
      totalCouponsExpired: 0,
      totalPlatformFeesCollected: 0,
      totalMerchantReleased: 0,
      totalSupplierReleased: 0,
      totalCourierReleased: 0
    });
    return;
  }

  const [
    couponCount,
    totalCouponsRedeemed,
    totalCouponsExpired,
    totalPlatformFeesCollected,
    totalMerchantReleased,
    totalSupplierReleased,
    totalCourierReleased
  ] = await Promise.all([
    walletState.settlementContract.couponCount(),
    walletState.settlementContract.totalCouponsRedeemed(),
    walletState.settlementContract.totalCouponsExpired(),
    walletState.settlementContract.totalPlatformFeesCollected(),
    walletState.settlementContract.totalMerchantReleased(),
    walletState.settlementContract.totalSupplierReleased(),
    walletState.settlementContract.totalCourierReleased()
  ]);

  renderMetrics({
    couponCount: Number(couponCount),
    totalCouponsRedeemed: Number(totalCouponsRedeemed),
    totalCouponsExpired: Number(totalCouponsExpired),
    totalPlatformFeesCollected: Number(window.ethers.formatEther(totalPlatformFeesCollected)) * 1000,
    totalMerchantReleased: Number(window.ethers.formatEther(totalMerchantReleased)) * 1000,
    totalSupplierReleased: Number(window.ethers.formatEther(totalSupplierReleased)) * 1000,
    totalCourierReleased: Number(window.ethers.formatEther(totalCourierReleased)) * 1000
  });
}

async function loadCoupons() {
  if (!walletState.settlementContract) {
    chainState.coupons = [];
    renderCoupons(chainState.coupons);
    return;
  }

  const count = Number(await walletState.settlementContract.couponCount());
  const coupons = [];
  for (let index = 1; index <= count; index += 1) {
    const coupon = await walletState.settlementContract.getCoupon(index);
    coupons.push({
      id: Number(coupon.id),
      owner: coupon.owner,
      buyerName: coupon.buyerName,
      redeemed: coupon.redeemed,
      expiredProcessed: coupon.expiredProcessed,
      issuedAt: Number(coupon.issuedAt),
      expiresAt: Number(coupon.expiresAt)
    });
  }

  chainState.coupons = coupons;
  renderCoupons(coupons);
}

async function loadEvents() {
  if (!walletState.settlementContract || !walletState.complianceContract) {
    chainState.events = [];
    renderTransactions([]);
    return;
  }

  const [purchaseEvents, redeemEvents, expiryEvents, grantEvents, revokeEvents] = await Promise.all([
    walletState.settlementContract.queryFilter(walletState.settlementContract.filters.CouponPurchased()),
    walletState.settlementContract.queryFilter(walletState.settlementContract.filters.CouponRedeemed()),
    walletState.settlementContract.queryFilter(walletState.settlementContract.filters.CouponExpiredProcessed()),
    walletState.complianceContract.queryFilter(walletState.complianceContract.filters.ComplianceGranted()),
    walletState.complianceContract.queryFilter(walletState.complianceContract.filters.ComplianceRevoked())
  ]);

  const eventRows = [
    ...purchaseEvents.map((event) => ({
      type: "coupon_purchase",
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      details: `${event.args.buyerName} purchased coupon #${Number(event.args.couponId)} from ${shortAddress(event.args.buyer)}`
    })),
    ...redeemEvents.map((event) => ({
      type: "coupon_redeemed",
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      details: `Wallet ${shortAddress(event.args.buyer)} redeemed coupon #${Number(event.args.couponId)}`
    })),
    ...expiryEvents.map((event) => ({
      type: "coupon_expiry_processed",
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      details: `Merchant processed expiry for coupon #${Number(event.args.couponId)}`
    })),
    ...grantEvents.map((event) => ({
      type: "compliance_granted",
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      details: `${shortAddress(event.args.user)} approved via ${window.ethers.decodeBytes32String(event.args.method)}`
    })),
    ...revokeEvents.map((event) => ({
      type: "compliance_revoked",
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      details: `${shortAddress(event.args.user)} compliance revoked`
    }))
  ].sort((a, b) => a.blockNumber - b.blockNumber);

  chainState.events = eventRows;
  renderTransactions(eventRows);
}

async function refreshOnChainData() {
  await Promise.all([
    loadComplianceRecord(),
    loadChainMetrics(),
    loadCoupons(),
    loadEvents()
  ]);
}

async function handleScenarioSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  renderScenario(
    calculateScenarioSettlement({
      scenario: form.get("scenario"),
      dozensSold: Number(form.get("dozensSold")),
      feeRate: Number(form.get("feeRate"))
    })
  );
}

async function handleGrantCompliance(event) {
  event.preventDefault();
  const feedback = document.getElementById("compliance-feedback");
  const form = new FormData(event.currentTarget);

  try {
    await ensureReadyForContractAction();
    const targetAddress = String(form.get("targetAddress")).trim();
    const validDays = Number(form.get("validDays"));
    const expiry = Math.floor(Date.now() / 1000) + validDays * 24 * 60 * 60;
    const method = window.ethers.encodeBytes32String(String(form.get("method")));
    const tx = await walletState.complianceContract.grantCompliance(targetAddress, expiry, method);
    await tx.wait();
    feedback.textContent = `Compliance granted to ${shortAddress(targetAddress)}.`;
    await refreshOnChainData();
  } catch (error) {
    feedback.textContent = error.message;
  }
}

async function handleRevokeCompliance() {
  const feedback = document.getElementById("compliance-feedback");
  try {
    await ensureReadyForContractAction();
    const targetAddress = document.getElementById("target-address-field").value.trim();
    const tx = await walletState.complianceContract.revokeCompliance(targetAddress);
    await tx.wait();
    feedback.textContent = `Compliance revoked for ${shortAddress(targetAddress)}.`;
    await refreshOnChainData();
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
    const tx = await walletState.settlementContract.purchaseCoupon(quantity, buyerName, {
      value: BigInt(walletState.contractConfig.tokenPriceWei) * BigInt(quantity)
    });
    await tx.wait();
    feedback.textContent = `On-chain purchase confirmed in ${shortAddress(tx.hash)}.`;
    await refreshOnChainData();
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
  try {
    await ensureReadyForContractAction();
    const tx = await walletState.settlementContract.redeemCoupon(Number(button.dataset.redeem));
    await tx.wait();
    feedback.textContent = `On-chain redemption confirmed for coupon #${button.dataset.redeem}.`;
    await refreshOnChainData();
  } catch (error) {
    feedback.textContent = error.message;
  }
}

async function handleProcessExpiry() {
  const feedback = document.getElementById("coupon-feedback");
  try {
    await ensureReadyForContractAction();
    const now = Math.floor(Date.now() / 1000);
    const expiredIds = chainState.coupons
      .filter((coupon) => !coupon.redeemed && !coupon.expiredProcessed && coupon.expiresAt < now)
      .map((coupon) => coupon.id);

    if (!expiredIds.length) {
      feedback.textContent = "No expired coupons need processing right now.";
      return;
    }

    const tx = await walletState.settlementContract.processExpiredCoupons(expiredIds);
    await tx.wait();
    feedback.textContent = `Processed ${expiredIds.length} expired coupon(s) on-chain.`;
    await refreshOnChainData();
  } catch (error) {
    feedback.textContent = error.message;
  }
}

function bindWalletEvents() {
  if (!window.ethereum) {
    return;
  }

  window.ethereum.on("accountsChanged", async (accounts) => {
    walletState.account = accounts[0] || null;
    walletState.browserProvider = walletState.account ? new window.ethers.BrowserProvider(window.ethereum) : null;
    walletState.signer = walletState.account ? await walletState.browserProvider.getSigner() : null;
    await instantiateContracts();
    renderWalletStatus();
    await refreshOnChainData();
  });

  window.ethereum.on("chainChanged", async (chainId) => {
    walletState.chainIdHex = chainId;
    if (walletState.account) {
      walletState.browserProvider = new window.ethers.BrowserProvider(window.ethereum);
      walletState.signer = await walletState.browserProvider.getSigner();
      await instantiateContracts();
    }
    renderWalletStatus();
    await refreshOnChainData();
  });
}

document.getElementById("scenario-form").addEventListener("submit", handleScenarioSubmit);
document.getElementById("compliance-form").addEventListener("submit", handleGrantCompliance);
document.getElementById("purchase-form").addEventListener("submit", handlePurchase);
document.getElementById("coupon-list").addEventListener("click", handleCouponActions);
document.getElementById("process-expiry").addEventListener("click", handleProcessExpiry);
document.getElementById("refresh-chain").addEventListener("click", refreshOnChainData);
document.getElementById("refresh-compliance").addEventListener("click", loadComplianceRecord);
document.getElementById("revoke-compliance").addEventListener("click", handleRevokeCompliance);
document.getElementById("connect-wallet").addEventListener("click", connectWallet);
document.getElementById("disconnect-wallet").addEventListener("click", disconnectWallet);
document.getElementById("switch-network").addEventListener("click", switchToLocalChain);

Promise.all([loadContractConfig(), syncWalletState()])
  .then(async () => {
    renderStakeholders();
    renderBidt();
    renderScenario(calculateScenarioSettlement({ scenario: "A", dozensSold: 100, feeRate: 0.015 }));
    bindWalletEvents();
    renderWalletStatus();
    renderContractStatus();
    renderComplianceStatus();
    await refreshOnChainData();
  })
  .catch((error) => {
    document.getElementById("coupon-feedback").textContent = error.message;
  });
