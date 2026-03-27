const fs = require("fs");
const path = require("path");
const solc = require("solc");

const contractPath = path.resolve(__dirname, "..", "contracts", "SBIFCouponSettlement.sol");
const source = fs.readFileSync(contractPath, "utf8");

const input = {
  language: "Solidity",
  sources: {
    "SBIFCouponSettlement.sol": {
      content: source
    }
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"]
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
if (output.errors) {
  const fatalErrors = output.errors.filter((entry) => entry.severity === "error");
  output.errors.forEach((entry) => console.log(entry.formattedMessage));
  if (fatalErrors.length > 0) {
    process.exit(1);
  }
}

const artifact = output.contracts["SBIFCouponSettlement.sol"].SBIFCouponSettlement;
const artifactDir = path.resolve(__dirname, "..", "artifacts");
fs.mkdirSync(artifactDir, { recursive: true });
const artifactPath = path.join(artifactDir, "SBIFCouponSettlement.json");

fs.writeFileSync(
  artifactPath,
  JSON.stringify(
    {
      contractName: "SBIFCouponSettlement",
      abi: artifact.abi,
      bytecode: `0x${artifact.evm.bytecode.object}`
    },
    null,
    2
  )
);

console.log(`Compiled contract artifact written to ${artifactPath}`);
