import { summarizeStakeholderBenefits } from "./calculations.js";

export const bidtModel = {
  business: {
    title: "Business Idea / Model / Problem",
    points: [
      "Raise working capital for a florist shop using investment pools and prepaid coupon tokens.",
      "Match investors, sponsors, and buyers with the merchant through an SBIF platform.",
      "Reduce merchant cash-flow pressure while preserving transparent profit-sharing logic."
    ]
  },
  information: {
    title: "Information / Data",
    points: [
      "Track coupon issuance, ownership, redemption status, expiry date, and settlement records.",
      "Store scenario-level revenue, COGS, OPEX, investor return, merchant profit, and platform fee data.",
      "Prepare identity and compliance evidence for SSI, ZKP, AML, and business-proof workflows."
    ]
  },
  digital: {
    title: "Digital Technology / Analytics",
    points: [
      "Accept configurable payment instruments such as CBDC, stablecoins, bank transfer, and card rails.",
      "Use analytics to compare Scenario A and B outcomes, fee sensitivity, and token redemption patterns.",
      "Create audit logs to support RegTech checks and operational reporting."
    ]
  },
  technology: {
    title: "Technology / Integration",
    points: [
      "Expose API-driven settlement logic that simulates smart-contract behavior for token purchase, redemption, and expiry.",
      "Integrate open banking, wallets, oracle delivery confirmation, and modular compliance checks.",
      "Provide a Web dashboard for ecosystem stakeholders to observe token flows and settlement outcomes."
    ]
  }
};

export const ecosystem = {
  title: "SBIF Florist Ecosystem",
  stakeholders: summarizeStakeholderBenefits(),
  flows: [
    "Investors or supporters provide capital or buy coupons through the SBIF platform.",
    "The platform records token issuance and financing commitments on a ledger-like transaction log.",
    "When flowers are sold or coupons are redeemed, settlement rules split value to investor, supplier, courier, merchant, and platform.",
    "When a coupon expires, the remaining value is released to the florist after deducting the platform fee."
  ]
};
