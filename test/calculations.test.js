import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCouponSettlement,
  calculateScenarioSettlement
} from "../lib/calculations.js";

test("Scenario A matches the florist case numbers before platform fee", () => {
  const result = calculateScenarioSettlement({
    scenario: "A",
    dozensSold: 100,
    feeRate: 0
  });

  assert.equal(result.investorGrossEntitlement, 210);
  assert.equal(result.investorProfit, 10);
  assert.equal(result.merchantNetProfit, 90);
  assert.equal(result.annualizedInvestorRoi, 2.6);
});

test("Scenario B gives zero merchant ROI base and correct profit", () => {
  const result = calculateScenarioSettlement({
    scenario: "B",
    dozensSold: 100,
    feeRate: 0
  });

  assert.equal(result.investorGrossEntitlement, 1260);
  assert.equal(result.investorProfit, 60);
  assert.equal(result.merchantNetProfit, 40);
  assert.equal(result.merchantRoi, null);
});

test("Coupon redemption splits the token value correctly", () => {
  const result = calculateCouponSettlement({ quantity: 2 });

  assert.equal(result.totalPurchaseValue, 30);
  assert.equal(result.supplierRelease, 10);
  assert.equal(result.courierRelease, 4);
  assert.equal(result.platformFee, 0.9);
  assert.equal(result.merchantRelease, 15.1);
});
