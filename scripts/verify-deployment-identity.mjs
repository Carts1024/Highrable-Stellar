import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Resolve the existing backend SDK dependency; no separate root dependency needed.
const require = createRequire(new URL("../packages/backend/package.json", import.meta.url));
const { Address, Contract, StrKey, rpc, xdr } = require("@stellar/stellar-sdk");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hex = /^[a-f0-9]{64}$/;

class VerificationError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
const fail = (status, code) => {
  throw new VerificationError(status, code);
};
const requireInput = (condition, code) => {
  if (!condition) fail("unknown", code);
};

export function validateInputs(scope, build) {
  requireInput(scope && typeof scope === "object", "missing_backend_scope");
  for (const key of [
    "STELLAR_NETWORK",
    "STELLAR_RPC_URL",
    "ESCROW_CONTRACT_ID",
    "REPUTATION_CONTRACT_ID",
  ]) {
    requireInput(typeof scope[key] === "string" && scope[key].trim().length > 0, `missing_${key}`);
  }
  const network = scope.STELLAR_NETWORK.trim();
  // Exact mapping used by packages/backend/convex/lib/stellarReads.ts.
  const passphrase =
    new Map([
      ["testnet", "Test SDF Network ; September 2015"],
      ["mainnet", "Public Global Stellar Network ; September 2015"],
    ]).get(network) ?? network;
  requireInput(!Object.hasOwn(Object.prototype, network), "invalid_backend_network");
  if (scope.STELLAR_NETWORK_PASSPHRASE !== undefined) {
    requireInput(scope.STELLAR_NETWORK_PASSPHRASE === passphrase, "conflicting_network_passphrase");
  }
  let endpoint;
  try {
    endpoint = new URL(scope.STELLAR_RPC_URL.trim());
  } catch {
    fail("unknown", "invalid_rpc_url");
  }
  requireInput(
    endpoint.protocol === "https:" ||
      (endpoint.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)),
    "insecure_rpc_url",
  );
  requireInput(!endpoint.hash, "invalid_rpc_url");
  for (const name of ["escrow", "reputation"]) {
    requireInput(
      StrKey.isValidContract(scope[`${name.toUpperCase()}_CONTRACT_ID`]),
      `invalid_${name}_contract_id`,
    );
  }
  requireInput(scope.ESCROW_CONTRACT_ID !== scope.REPUTATION_CONTRACT_ID, "duplicate_contract_ids");
  requireInput(build && typeof build === "object", "missing_build_provenance");
  requireInput(
    typeof build.sourceRevision === "string" && /^[a-f0-9]{40}$/.test(build.sourceRevision),
    "invalid_source_revision",
  );
  requireInput(["clean", "dirty"].includes(build.sourceState), "missing_source_state");
  requireInput(
    build.sourceState !== "dirty" ||
      (typeof build.sourceDiffSha256 === "string" && hex.test(build.sourceDiffSha256)),
    "missing_source_diff_hash",
  );
  for (const field of ["toolchain", "buildCommand", "testCommand"]) {
    requireInput(
      typeof build[field] === "string" && build[field].trim().length > 0,
      `missing_${field}`,
    );
  }
  requireInput(["release", "optimized"].includes(build.buildMode), "missing_build_mode");
  requireInput(build.testResult === "passed", "unverified_local_tests");
  requireInput(
    typeof build.testedAt === "string" &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(build.testedAt) &&
      Number.isFinite(Date.parse(build.testedAt)),
    "missing_test_timestamp",
  );
  for (const name of ["escrow", "reputation"]) {
    requireInput(
      typeof build[name]?.wasmPath === "string" && build[name].wasmPath.length > 0,
      `missing_${name}_wasm`,
    );
    requireInput(
      typeof build[name]?.sha256 === "string" && hex.test(build[name].sha256),
      `missing_${name}_build_hash`,
    );
  }
  return { endpoint: endpoint.href, passphrase };
}

// This adapter exposes only the two read methods. No transaction construction,
// simulation, signing, TTL extension, restoration, or submission is performed.
export function createReadOnlyRpc(endpoint) {
  const server = new rpc.Server(endpoint, {
    allowHttp: endpoint.startsWith("http:"),
    timeout: 30_000,
  });
  return Object.freeze({
    getNetwork: () => server.getNetwork(),
    getLedgerEntries: (...keys) => server.getLedgerEntries(...keys),
  });
}

async function readEntries(reader, keys) {
  let response;
  try {
    response = await reader.getLedgerEntries(...keys);
  } catch {
    fail("unavailable", "ledger_rpc_unavailable");
  }
  requireInput(
    Array.isArray(response?.entries) &&
      Number.isSafeInteger(response.latestLedger) &&
      response.latestLedger > 0,
    "malformed_ledger_response",
  );
  if (response.entries.length < keys.length) fail("unavailable", "ledger_entry_absent_or_archived");
  requireInput(response.entries.length === keys.length, "unexpected_ledger_entries");
  const matched = keys.map((key) => {
    const entries = response.entries.filter(
      (entry) => entry.key?.toXDR("base64") === key.toXDR("base64"),
    );
    requireInput(entries.length === 1, "unexpected_ledger_key");
    const entry = entries[0];
    requireInput(
      Number.isSafeInteger(entry.liveUntilLedgerSeq) &&
        entry.liveUntilLedgerSeq >= response.latestLedger,
      "unreadable_or_expired_entry",
    );
    return entry;
  });
  return { entries: matched, ledger: response.latestLedger };
}

function readInstance(entry, contractId) {
  const data = entry.val.contractData();
  requireInput(
    Address.fromScAddress(data.contract()).toString() === contractId &&
      data.key().switch().name === "scvLedgerKeyContractInstance" &&
      data.durability().name === "persistent",
    "unexpected_contract_data",
  );
  const instance = data.val().instance();
  requireInput(
    instance.executable().switch().name === "contractExecutableWasm",
    "unsupported_contract_executable",
  );
  return instance;
}

function linkedAddress(instance, name) {
  const key = xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(name)]).toXDR("base64");
  const entries = instance.storage()?.filter((entry) => entry.key().toXDR("base64") === key);
  requireInput(entries?.length === 1, "missing_or_ambiguous_contract_link");
  return Address.fromScVal(entries[0].val()).toString();
}

export async function verifyDeploymentIdentity({
  scope,
  build,
  buildDirectory = process.cwd(),
  reader,
  readBytes = readFile,
}) {
  const record = {
    schemaVersion: 1,
    status: "unknown",
    readOnly: true,
    checkedAt: new Date().toISOString(),
    provenanceBasis: "operator-supplied build/test attestation; local bytes independently hashed",
  };
  try {
    const config = validateInputs(scope, build);
    // Hash the exact scope including endpoint, but never publish a URL, path,
    // passphrase, command, or upstream exception that could contain credentials.
    record.scopeSha256 = sha256(JSON.stringify(scope));
    record.provenanceSha256 = sha256(JSON.stringify(build));
    record.sourceRevision = build.sourceRevision;
    record.sourceState = build.sourceState;
    if (build.sourceState === "dirty") record.sourceDiffSha256 = build.sourceDiffSha256;
    record.contracts = {};
    for (const name of ["escrow", "reputation"]) {
      let bytes;
      try {
        bytes = await readBytes(resolve(buildDirectory, build[name].wasmPath));
      } catch {
        fail("unknown", `unreadable_${name}_wasm`);
      }
      requireInput(
        Buffer.from(bytes)
          .subarray(0, 8)
          .equals(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])),
        `invalid_${name}_wasm`,
      );
      const localHash = sha256(bytes);
      if (localHash !== build[name].sha256) fail("mismatch", `${name}_local_build_hash_mismatch`);
      record.contracts[name] = {
        contractId: scope[`${name.toUpperCase()}_CONTRACT_ID`],
        localSha256: localHash,
      };
    }
    const reads = reader ?? createReadOnlyRpc(config.endpoint);
    let network;
    try {
      network = await reads.getNetwork();
    } catch {
      fail("unavailable", "network_rpc_unavailable");
    }
    requireInput(
      typeof network?.passphrase === "string" && network.passphrase.length > 0,
      "malformed_network_response",
    );
    if (network.passphrase !== config.passphrase) fail("mismatch", "network_mismatch");
    record.networkPassphraseSha256 = sha256(config.passphrase);
    const names = ["escrow", "reputation"];
    const instanceKeys = names.map((name) =>
      new Contract(record.contracts[name].contractId).getFootprint(),
    );
    const instancesResult = await readEntries(reads, instanceKeys);
    const instances = instancesResult.entries.map((entry, i) =>
      readInstance(entry, record.contracts[names[i]].contractId),
    );
    for (const [i, name] of names.entries()) {
      const hash = instances[i].executable().wasmHash().toString("hex");
      record.contracts[name].remoteSha256 = hash;
      if (hash !== record.contracts[name].localSha256)
        fail("mismatch", `${name}_deployed_code_mismatch`);
    }
    if (
      linkedAddress(instances[0], "ReputationContract") !== scope.REPUTATION_CONTRACT_ID ||
      linkedAddress(instances[1], "AuthorizedEscrowContract") !== scope.ESCROW_CONTRACT_ID
    )
      fail("mismatch", "contract_link_mismatch");
    const codeHashes = [...new Set(names.map((name) => record.contracts[name].localSha256))];
    const codeKeys = codeHashes.map((hash) =>
      xdr.LedgerKey.contractCode(new xdr.LedgerKeyContractCode({ hash: Buffer.from(hash, "hex") })),
    );
    const codes = await readEntries(reads, codeKeys);
    requireInput(codes.ledger >= instancesResult.ledger, "ledger_regressed");
    for (const name of names) {
      const code =
        codes.entries[codeHashes.indexOf(record.contracts[name].localSha256)].val.contractCode();
      if (
        code.hash().toString("hex") !== record.contracts[name].localSha256 ||
        sha256(code.code()) !== record.contracts[name].localSha256
      )
        fail("mismatch", `${name}_remote_bytes_mismatch`);
    }
    // Detect an upgrade or rewiring while code entries were read. This is a
    // point-in-time observation, not a guarantee about subsequent ledgers.
    const confirmed = await readEntries(reads, instanceKeys);
    requireInput(confirmed.ledger >= codes.ledger, "ledger_regressed");
    for (let i = 0; i < names.length; i++) {
      if (
        confirmed.entries[i].val.toXDR("base64") !== instancesResult.entries[i].val.toXDR("base64")
      )
        fail("unknown", "contract_changed_during_verification");
    }
    record.ledger = confirmed.ledger;
    record.status = "matched";
    record.code = "deployment_identity_matched";
  } catch (error) {
    record.status = error instanceof VerificationError ? error.status : "unknown";
    record.code = error instanceof VerificationError ? error.code : "malformed_verification_data";
  }
  return record;
}

export const exitCode = (record) =>
  record.status === "matched" ? 0 : record.status === "mismatch" ? 1 : 2;

export async function main(args = process.argv.slice(2)) {
  let result;
  try {
    requireInput(
      args.length === 4 && args[0] === "--scope" && args[2] === "--build",
      "usage_expected_scope_and_build_json_paths",
    );
    let scope, build;
    try {
      scope = JSON.parse(await readFile(args[1], "utf8"));
      build = JSON.parse(await readFile(args[3], "utf8"));
    } catch {
      fail("unknown", "unreadable_input_json");
    }
    result = await verifyDeploymentIdentity({
      scope,
      build,
      buildDirectory: dirname(resolve(args[3])),
    });
  } catch (error) {
    result = {
      schemaVersion: 1,
      status: "unknown",
      readOnly: true,
      code: error instanceof VerificationError ? error.code : "unreadable_input",
    };
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return exitCode(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  process.exitCode = await main();
