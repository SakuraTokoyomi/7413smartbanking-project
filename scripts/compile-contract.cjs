const fs = require("fs");
const path = require("path");
const solc = require("solc");

const contractsDir = path.resolve(__dirname, "..", "contracts");
const sources = Object.fromEntries(
  fs.readdirSync(contractsDir)
    .filter((file) => file.endsWith(".sol"))
    .map((file) => [
      file,
      {
        content: fs.readFileSync(path.join(contractsDir, file), "utf8")
      }
    ])
);

const input = {
  language: "Solidity",
  sources,
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

const artifactDir = path.resolve(__dirname, "..", "artifacts");
fs.mkdirSync(artifactDir, { recursive: true });
for (const [sourceName, contracts] of Object.entries(output.contracts)) {
  for (const [contractName, artifact] of Object.entries(contracts)) {
    const artifactPath = path.join(artifactDir, `${contractName}.json`);
    fs.writeFileSync(
      artifactPath,
      JSON.stringify(
        {
          contractName,
          sourceName,
          abi: artifact.abi,
          bytecode: `0x${artifact.evm.bytecode.object}`
        },
        null,
        2
      )
    );
    console.log(`Compiled contract artifact written to ${artifactPath}`);
  }
}
