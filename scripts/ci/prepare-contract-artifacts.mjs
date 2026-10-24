import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const artifactDirectory = path.resolve(process.env.ARTIFACT_DIR || "artifacts/contracts");
const wasmDirectory = path.join(root, "contracts/target/wasm32v1-none/release");
const contracts = ["highrable_escrow", "highrable_reputation", "highrable_registry"];

mkdirSync(artifactDirectory, { recursive: true });

const checksums = [];
for (const contract of contracts) {
  const fileName = `${contract}.wasm`;
  const source = path.join(wasmDirectory, fileName);
  const destination = path.join(artifactDirectory, fileName);
  const bytes = readFileSync(source);
  copyFileSync(source, destination);
  checksums.push(`${createHash("sha256").update(bytes).digest("hex")}  ${fileName}`);
}

writeFileSync(path.join(artifactDirectory, "SHA256SUMS"), `${checksums.join("\n")}\n`);
writeFileSync(
  path.join(artifactDirectory, "build-metadata.json"),
  `${JSON.stringify(
    {
      sourceSha: process.env.GITHUB_SHA || "local",
      rustc: process.env.RUSTC_VERSION || "unknown",
      cargo: process.env.CARGO_VERSION || "unknown",
      stellarCli: process.env.STELLAR_CLI_VERSION || "unknown",
      target: "wasm32v1-none",
      profile: "release",
      commands: [
        "cargo test --workspace --locked --manifest-path contracts/Cargo.toml",
        ...contracts.map(
          (contract) =>
            `stellar contract build --manifest-path contracts/Cargo.toml --package ${contract.replace("highrable_", "highrable-")} --locked`,
        ),
      ],
    },
    null,
    2,
  )}\n`,
);
