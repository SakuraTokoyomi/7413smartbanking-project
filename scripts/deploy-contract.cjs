const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const mnemonic = "test test test test test test test test test test test junk";

function deriveWallet(index, provider) {
  return ethers.HDNodeWallet.fromPhrase(
    mnemonic,
    undefined,
    `m/44'/60'/0'/0/${index}`
  ).connect(provider);
}

async function main() {
  const artifactPath = path.resolve(__dirname, "..", "artifacts", "SBIFCouponSettlement.json");
  if (!fs.existsSync(artifactPath)) {
    throw new Error("Contract artifact not found. Run `npm.cmd run compile:contract` first.");
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  const merchant = deriveWallet(0, provider);
  const supplier = deriveWallet(1, provider);
  const courier = deriveWallet(2, provider);
  const platformTreasury = deriveWallet(3, provider);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, merchant);
  const contract = await factory.deploy(
    supplier.address,
    courier.address,
    platformTreasury.address
  );
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const network = await provider.getNetwork();
  const outputPath = path.resolve(__dirname, "..", "public", "contract-config.json");

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        contractAddress,
        chainId: Number(network.chainId),
        networkName: "Ganache Localhost",
        merchant: merchant.address,
        supplier: supplier.address,
        courier: courier.address,
        platformTreasury: platformTreasury.address,
        tokenPriceWei: ethers.parseEther("0.015").toString(),
        abi: artifact.abi
      },
      null,
      2
    )
  );

  console.log(`Contract deployed to ${contractAddress}`);
  console.log(`Contract config written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
