const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateScenarioSettlement({
  scenario,
  dozensSold,
  feeRate = 0.015
}) {
  const normalizedScenario = String(scenario).toUpperCase();
  const sold = Number(dozensSold);
  const platformFeeRate = Number(feeRate);

  if (!["A", "B"].includes(normalizedScenario)) {
    throw new Error("Scenario must be A or B.");
  }

  if (!Number.isFinite(sold) || sold < 0) {
    throw new Error("Dozens sold must be a non-negative number.");
  }

  if (!Number.isFinite(platformFeeRate) || platformFeeRate < 0 || platformFeeRate > 0.03) {
    throw new Error("Platform fee rate must be between 0 and 0.03.");
  }

  const principal = normalizedScenario === "A" ? 200 : 1200;
  const payoutPerDozen = normalizedScenario === "A" ? 2.1 : 12.6;
  const retailPricePerDozen = 20;
  const weeklyOpex = 700;
  const merchantCogs = normalizedScenario === "A" ? sold * 10 : 0;
  const investorGrossEntitlement = sold * payoutPerDozen;
  const investorProfit = investorGrossEntitlement - principal;
  const investorReturnRate = principal === 0 ? 0 : investorProfit / principal;
  const platformFee = Math.max(0, investorGrossEntitlement * platformFeeRate);
  const investorNetPayout = investorGrossEntitlement - platformFee;
  const grossRevenue = sold * retailPricePerDozen;
  const merchantNetProfit = grossRevenue - merchantCogs - investorGrossEntitlement - weeklyOpex;
  const merchantFundingRelief = principal;
  const annualizedInvestorRoi = investorReturnRate * 52;
  const merchantRoiBase = normalizedScenario === "A" ? principal : 0;
  const merchantRoi = merchantRoiBase > 0 ? merchantNetProfit / merchantRoiBase : null;

  return {
    scenario: normalizedScenario,
    dozensSold: sold,
    principal: round(principal),
    payoutPerDozen: round(payoutPerDozen),
    grossRevenue: round(grossRevenue),
    cogs: round(merchantCogs),
    weeklyOpex: round(weeklyOpex),
    investorGrossEntitlement: round(investorGrossEntitlement),
    investorProfit: round(investorProfit),
    investorReturnRate: round(investorReturnRate),
    annualizedInvestorRoi: round(annualizedInvestorRoi),
    platformFeeRate: round(platformFeeRate),
    platformFee: round(platformFee),
    investorNetPayout: round(investorNetPayout),
    merchantNetProfit: round(merchantNetProfit),
    merchantFundingRelief: round(merchantFundingRelief),
    merchantRoi: merchantRoi === null ? null : round(merchantRoi)
  };
}

export function calculateCouponSettlement({
  tokenPrice = 15,
  supplierRelease = 5,
  courierRelease = 2,
  platformFeeRate = 0.03,
  quantity = 1
}) {
  const count = Number(quantity);

  if (!Number.isFinite(count) || count <= 0) {
    throw new Error("Quantity must be greater than 0.");
  }

  const unitTokenPrice = Number(tokenPrice);
  const unitSupplierRelease = Number(supplierRelease);
  const unitCourierRelease = Number(courierRelease);
  const feeRate = Number(platformFeeRate);
  const unitFee = unitTokenPrice * feeRate;
  const unitMerchantRelease = unitTokenPrice - unitSupplierRelease - unitCourierRelease - unitFee;

  if (unitMerchantRelease < 0) {
    throw new Error("Settlement leaves a negative merchant release.");
  }

  return {
    quantity: count,
    tokenPrice: round(unitTokenPrice),
    supplierRelease: round(unitSupplierRelease * count),
    courierRelease: round(unitCourierRelease * count),
    platformFee: round(unitFee * count),
    merchantRelease: round(unitMerchantRelease * count),
    totalPurchaseValue: round(unitTokenPrice * count)
  };
}

export function summarizeStakeholderBenefits() {
  return [
    {
      stakeholder: "Investors / Sponsors",
      benefit: "Earn programmable returns tied to actual flower sales while seeing transparent settlement records."
    },
    {
      stakeholder: "Florist Merchant",
      benefit: "Receives working capital, prepaid demand visibility, and automated payout routing to suppliers and couriers."
    },
    {
      stakeholder: "Buyers / Supporters",
      benefit: "Purchase redeemable flower coupons and track redemption value and expiry conditions digitally."
    },
    {
      stakeholder: "Suppliers",
      benefit: "Receive direct conditional payment when a coupon is redeemed, reducing receivable risk."
    },
    {
      stakeholder: "Courier / Logistics",
      benefit: "Gets auto-released delivery payment after oracle-style delivery confirmation."
    },
    {
      stakeholder: "SBIF Platform",
      benefit: "Charges transaction fees for BaaS/BaaP orchestration, auditability, analytics, and compliance tooling."
    },
    {
      stakeholder: "Bank / Wallet / Payment Rails",
      benefit: "Processes eHKD, eCNY, stablecoins, cards, or FPS-style transfers through open APIs."
    }
  ];
}
