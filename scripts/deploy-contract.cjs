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
  const registryArtifactPath = path.resolve(__dirname, "..", "artifacts", "ComplianceRegistry.json");
  const settlementArtifactPath = path.resolve(__dirname, "..", "artifacts", "SBIFCouponSettlement.json");
  if (!fs.existsSync(registryArtifactPath) || !fs.existsSync(settlementArtifactPath)) {
    throw new Error("Contract artifact not found. Run `npm.cmd run compile:contract` first.");
  }

  const registryArtifact = JSON.parse(fs.readFileSync(registryArtifactPath, "utf8"));
  const settlementArtifact = JSON.parse(fs.readFileSync(settlementArtifactPath, "utf8"));
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  const merchant = deriveWallet(0, provider);
  const supplier = deriveWallet(1, provider);
  const courier = deriveWallet(2, provider);
  const platformTreasury = deriveWallet(3, provider);
  const complianceAdmin = merchant;

  const registryFactory = new ethers.ContractFactory(registryArtifact.abi, registryArtifact.bytecode, complianceAdmin);
  const registryContract = await registryFactory.deploy(complianceAdmin.address);
  await registryContract.waitForDeployment();

  const settlementFactory = new ethers.ContractFactory(
    settlementArtifact.abi,
    settlementArtifact.bytecode,
    merchant
  );
  const settlementContract = await settlementFactory.deploy(
    supplier.address,
    courier.address,
    platformTreasury.address,
    await registryContract.getAddress()
  );
  await settlementContract.waitForDeployment();

  const contractAddress = await settlementContract.getAddress();
  const registryAddress = await registryContract.getAddress();
  const network = await provider.getNetwork();
  const outputPath = path.resolve(__dirname, "..", "public", "contract-config.json");

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        settlementContractAddress: contractAddress,
        complianceRegistryAddress: registryAddress,
        chainId: Number(network.chainId),
        networkName: "Ganache Localhost",
        merchant: merchant.address,
        supplier: supplier.address,
        courier: courier.address,
        platformTreasury: platformTreasury.address,
        complianceAdmin: complianceAdmin.address,
        tokenPriceWei: ethers.parseEther("0.015").toString(),
        settlementAbi: settlementArtifact.abi,
        complianceRegistryAbi: registryArtifact.abi
      },
      null,
      2
    )
  );

  console.log(`Compliance registry deployed to ${registryAddress}`);
  console.log(`Settlement contract deployed to ${contractAddress}`);
  console.log(`Contract config written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
