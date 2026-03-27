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
  const artifactPath = path.resolve("artifacts", "SBIFCouponSettlement.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const ganache = Ganache.server({
    wallet: { mnemonic },
    chain: { chainId: 1337 },
    logging: { quiet: true }
  });

  await ganache.listen(8545);
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const merchant = deriveWallet(0, provider);
  const supplier = deriveWallet(1, provider);
  const courier = deriveWallet(2, provider);
  const platformTreasury = deriveWallet(3, provider);
  const buyer = deriveWallet(4, provider);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, merchant);
  const contract = await factory.deploy(
    supplier.address,
    courier.address,
    platformTreasury.address
  );
  await contract.waitForDeployment();

  return { ganache, provider, contract, merchant, supplier, courier, platformTreasury, buyer };
}

test("contract purchase and redeem distribute value on-chain", async () => {
  const { ganache, provider, contract, buyer, supplier, courier, platformTreasury, merchant } = await deployFixture();

  try {
    const tokenPrice = await contract.TOKEN_PRICE();
    await (await contract.connect(buyer).purchaseCoupon(1, "John", { value: tokenPrice })).wait();

    const supplierBefore = await provider.getBalance(supplier.address);
    const courierBefore = await provider.getBalance(courier.address);
    const platformBefore = await provider.getBalance(platformTreasury.address);
    const merchantBefore = await provider.getBalance(merchant.address);

    await (await contract.connect(buyer).redeemCoupon(1)).wait();

    assert.ok((await provider.getBalance(supplier.address)) > supplierBefore);
    assert.ok((await provider.getBalance(courier.address)) > courierBefore);
    assert.ok((await provider.getBalance(platformTreasury.address)) > platformBefore);
    assert.ok((await provider.getBalance(merchant.address)) > merchantBefore);
  } finally {
    await ganache.close();
  }
});

test("merchant can process expired coupons on-chain", async () => {
  const { ganache, provider, contract, buyer } = await deployFixture();

  try {
    const tokenPrice = await contract.TOKEN_PRICE();
    await (await contract.connect(buyer).purchaseCoupon(1, "Alice", { value: tokenPrice })).wait();

    await provider.send("evm_increaseTime", [366 * 24 * 60 * 60]);
    await provider.send("evm_mine", []);

    await (await contract.processExpiredCoupons([1])).wait();
    const coupon = await contract.getCoupon(1);
    assert.equal(coupon.expiredProcessed, true);
  } finally {
    await ganache.close();
  }
});
