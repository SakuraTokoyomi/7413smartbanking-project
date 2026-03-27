import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Ganache from "ganache";
import { ethers } from "ethers";

const mnemonic = "test test test test test test test test test test test junk";

function deriveWallet(index, provider) {
  return ethers.HDNodeWallet.fromPhrase(
    mnemonic,
    undefined,
    `m/44'/60'/0'/0/${index}`
  ).connect(provider);
}

async function deployFixture() {
  const registryArtifact = JSON.parse(
    fs.readFileSync(path.resolve("artifacts", "ComplianceRegistry.json"), "utf8")
  );
  const settlementArtifact = JSON.parse(
    fs.readFileSync(path.resolve("artifacts", "SBIFCouponSettlement.json"), "utf8")
  );

  const ganache = Ganache.server({
    wallet: { mnemonic },
    chain: { chainId: 1337 },
    logging: { quiet: true }
  });

  await ganache.listen(8545);
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const merchant = await provider.getSigner(0);
  const supplier = await provider.getSigner(1);
  const courier = await provider.getSigner(2);
  const platformTreasury = await provider.getSigner(3);
  const buyer = await provider.getSigner(4);

  const registryFactory = new ethers.ContractFactory(
    registryArtifact.abi,
    registryArtifact.bytecode,
    merchant
  );
  const registry = await registryFactory.deploy(merchant.address);
  await registry.waitForDeployment();

  const settlementFactory = new ethers.ContractFactory(
    settlementArtifact.abi,
    settlementArtifact.bytecode,
    merchant
  );
  const settlement = await settlementFactory.deploy(
    supplier.address,
    courier.address,
    platformTreasury.address,
    await registry.getAddress()
  );
  await settlement.waitForDeployment();

  return {
    ganache,
    provider,
    registry,
    settlement,
    merchant,
    supplier,
    courier,
    platformTreasury,
    buyer
  };
}

async function grantCompliance(registry, merchant, user, method = "CHAINALYSIS", days = 30) {
  const latestBlock = await merchant.provider.getBlock("latest");
  const expiry = Number(latestBlock.timestamp) + days * 24 * 60 * 60;
  const tx = await registry
    .connect(merchant)
    .grantCompliance(await user.getAddress(), expiry, ethers.encodeBytes32String(method));
  await tx.wait();
}

test("non-compliant wallets cannot purchase coupons", async () => {
  const { ganache, settlement, buyer } = await deployFixture();

  try {
    const tokenPrice = await settlement.TOKEN_PRICE();
    await assert.rejects(
      settlement.connect(buyer).purchaseCoupon(1, "John", { value: tokenPrice }),
      /CALL_EXCEPTION|missing revert data/
    );
  } finally {
    await ganache.close();
  }
});

test("compliant wallet can purchase and redeem coupons", async () => {
  const { ganache, provider, registry, settlement, merchant, buyer, supplier, courier, platformTreasury } = await deployFixture();

  try {
    await grantCompliance(registry, merchant, buyer, "CHAINALYSIS");
    const tokenPrice = await settlement.TOKEN_PRICE();

    await (await settlement.connect(buyer).purchaseCoupon(1, "John", { value: tokenPrice })).wait();

    const supplierBefore = await provider.getBalance(supplier.address);
    const courierBefore = await provider.getBalance(courier.address);
    const platformBefore = await provider.getBalance(platformTreasury.address);

    await (await settlement.connect(buyer).redeemCoupon(1)).wait();

    assert.ok((await provider.getBalance(await supplier.getAddress())) > supplierBefore);
    assert.ok((await provider.getBalance(await courier.getAddress())) > courierBefore);
    assert.ok((await provider.getBalance(await platformTreasury.getAddress())) > platformBefore);
    assert.equal(Number(await settlement.totalCouponsRedeemed()), 1);
  } finally {
    await ganache.close();
  }
});

test("merchant can process expired compliant coupons", async () => {
  const { ganache, provider, registry, settlement, merchant, buyer } = await deployFixture();

  try {
    await grantCompliance(registry, merchant, buyer, "OPEN_BANKING");
    const tokenPrice = await settlement.TOKEN_PRICE();
    await (await settlement.connect(buyer).purchaseCoupon(1, "Alice", { value: tokenPrice })).wait();

    await provider.send("evm_increaseTime", [366 * 24 * 60 * 60]);
    await provider.send("evm_mine", []);

    await (await settlement.connect(merchant).processExpiredCoupons([1])).wait();
    const coupon = await settlement.getCoupon(1);
    assert.equal(coupon.expiredProcessed, true);
    assert.equal(Number(await settlement.totalCouponsExpired()), 1);
  } finally {
    await ganache.close();
  }
});
