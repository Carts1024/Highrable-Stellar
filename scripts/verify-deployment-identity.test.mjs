import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { test } from "node:test";

import {
  createReadOnlyRpc,
  exitCode,
  validateInputs,
  verifyDeploymentIdentity,
} from "./verify-deployment-identity.mjs";

const require = createRequire(new URL("../packages/backend/package.json", import.meta.url));
const { Address, Contract, StrKey, xdr } = require("@stellar/stellar-sdk");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const escrowId = StrKey.encodeContract(Buffer.alloc(32, 1));
const reputationId = StrKey.encodeContract(Buffer.alloc(32, 2));
// Minimal valid modules with different custom sections, not production contracts.
const escrowBytes = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0, 0, 2, 1, 101]);
const reputationBytes = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0, 0, 2, 1, 114]);
const scope = {
  STELLAR_NETWORK: "testnet",
  STELLAR_RPC_URL: "https://rpc.example/secret-path?token=SECRET",
  ESCROW_CONTRACT_ID: escrowId,
  REPUTATION_CONTRACT_ID: reputationId,
};
const provenance = {
  sourceRevision: "a".repeat(40),
  sourceState: "clean",
  toolchain: "stellar 22; rustc 1.84",
  buildMode: "release",
  buildCommand: "stellar contract build",
  testCommand: "cargo test",
  testResult: "passed",
  testedAt: "2026-10-08T15:00:00Z",
  escrow: { wasmPath: "escrow.wasm", sha256: hash(escrowBytes) },
  reputation: { wasmPath: "reputation.wasm", sha256: hash(reputationBytes) },
};

function instanceEntry(id, bytes, linkName, linkId) {
  const key = new Contract(id).getFootprint();
  const instance = new xdr.ScContractInstance({
    executable: xdr.ContractExecutable.contractExecutableWasm(Buffer.from(hash(bytes), "hex")),
    storage: [
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(linkName)]),
        val: new Address(linkId).toScVal(),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("NextEscrowId")]),
        val: xdr.ScVal.scvU64(xdr.Uint64.fromString("99")),
      }),
    ],
  });
  const val = xdr.LedgerEntryData.contractData(
    new xdr.ContractDataEntry({
      ext: new xdr.ExtensionPoint(0),
      contract: new Address(id).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
      val: xdr.ScVal.scvContractInstance(instance),
    }),
  );
  return { key, val, liveUntilLedgerSeq: 1000 };
}
function codeEntry(bytes) {
  const digest = Buffer.from(hash(bytes), "hex");
  return {
    key: xdr.LedgerKey.contractCode(new xdr.LedgerKeyContractCode({ hash: digest })),
    val: xdr.LedgerEntryData.contractCode(
      new xdr.ContractCodeEntry({
        ext: new xdr.ContractCodeEntryExt(0),
        hash: digest,
        code: bytes,
      }),
    ),
    liveUntilLedgerSeq: 1000,
  };
}
function fixture() {
  const instances = [
    instanceEntry(escrowId, escrowBytes, "ReputationContract", reputationId),
    instanceEntry(reputationId, reputationBytes, "AuthorizedEscrowContract", escrowId),
  ];
  const codes = [codeEntry(escrowBytes), codeEntry(reputationBytes)];
  const calls = [];
  const reader = new Proxy(
    {
      async getNetwork() {
        calls.push("getNetwork");
        return { passphrase: "Test SDF Network ; September 2015" };
      },
      async getLedgerEntries(...keys) {
        calls.push("getLedgerEntries");
        return {
          latestLedger: 100,
          entries: keys[0].switch().name === "contractCode" ? codes : instances,
        };
      },
    },
    {
      get(target, key) {
        assert.ok(
          ["getNetwork", "getLedgerEntries"].includes(key),
          `Non-read method requested: ${String(key)}`,
        );
        return target[key];
      },
    },
  );
  return {
    instances,
    codes,
    calls,
    reader,
    scope: structuredClone(scope),
    build: structuredClone(provenance),
    readBytes: async (path) => (path.endsWith("escrow.wasm") ? escrowBytes : reputationBytes),
  };
}

test("matches both identities and reciprocal links in an active deployment using only reads", async () => {
  const f = fixture();
  const result = await verifyDeploymentIdentity(f);
  assert.equal(result.status, "matched");
  assert.equal(exitCode(result), 0);
  assert.equal(result.ledger, 100);
  assert.equal(result.contracts.escrow.remoteSha256, hash(escrowBytes));
  assert.deepEqual(f.calls, [
    "getNetwork",
    "getLedgerEntries",
    "getLedgerEntries",
    "getLedgerEntries",
  ]);
  assert.match(result.provenanceBasis, /operator-supplied/);
  assert.doesNotMatch(JSON.stringify(result), /SECRET|secret-path|rpc.example/);
});

test("RPC adapter exposes only network and ledger reads", () => {
  assert.deepEqual(Object.keys(createReadOnlyRpc("https://rpc.example")), [
    "getNetwork",
    "getLedgerEntries",
  ]);
});

test("deduplicates code reads when distinct contract IDs use identical WASM", async () => {
  const f = fixture();
  f.build.reputation.sha256 = hash(escrowBytes);
  f.readBytes = async () => escrowBytes;
  f.instances[1] = instanceEntry(reputationId, escrowBytes, "AuthorizedEscrowContract", escrowId);
  f.codes.pop();
  assert.equal((await verifyDeploymentIdentity(f)).status, "matched");
});

test("installed SDK decodes XDR through a local RPC transport that rejects all non-read methods", async (t) => {
  const f = fixture();
  const methods = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const rpcRequest = JSON.parse(body);
    methods.push(rpcRequest.method);
    let result;
    if (rpcRequest.method === "getNetwork")
      result = { passphrase: "Test SDF Network ; September 2015", protocolVersion: "22" };
    else if (rpcRequest.method === "getLedgerEntries") {
      const key = xdr.LedgerKey.fromXDR(rpcRequest.params.keys[0], "base64");
      const entries = key.switch().name === "contractCode" ? f.codes : f.instances;
      result = {
        latestLedger: 100,
        entries: entries.map((entry) => ({
          key: entry.key.toXDR("base64"),
          xdr: entry.val.toXDR("base64"),
          lastModifiedLedgerSeq: 99,
          liveUntilLedgerSeq: entry.liveUntilLedgerSeq,
        })),
      };
    } else {
      response.writeHead(400);
      response.end("Non-read method rejected");
      return;
    }
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ jsonrpc: "2.0", id: rpcRequest.id, result }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  f.scope.STELLAR_RPC_URL = `http://127.0.0.1:${server.address().port}`;
  delete f.reader;
  const result = await verifyDeploymentIdentity(f);
  assert.equal(result.status, "matched", result.code);
  assert.deepEqual(methods, [
    "getNetwork",
    "getLedgerEntries",
    "getLedgerEntries",
    "getLedgerEntries",
  ]);
});

for (const [label, change, status, code] of [
  [
    "wrong network",
    (f) => {
      f.scope.STELLAR_NETWORK = "mainnet";
    },
    "mismatch",
    "network_mismatch",
  ],
  [
    "wrong contract response",
    (f) => {
      f.scope.ESCROW_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 3));
    },
    "unknown",
    "unexpected_ledger_key",
  ],
  [
    "wrong deployed executable",
    (f) => {
      f.instances[0].val
        .contractData()
        .val()
        .instance()
        .executable(xdr.ContractExecutable.contractExecutableWasm(Buffer.alloc(32, 8)));
    },
    "mismatch",
    "escrow_deployed_code_mismatch",
  ],
  [
    "unsupported asset executable",
    (f) => {
      f.instances[0].val
        .contractData()
        .val()
        .instance()
        .executable(xdr.ContractExecutable.contractExecutableStellarAsset());
    },
    "unknown",
    "unsupported_contract_executable",
  ],
  [
    "wrong local artifact",
    (f) => {
      f.build.escrow.sha256 = "0".repeat(64);
    },
    "mismatch",
    "escrow_local_build_hash_mismatch",
  ],
  [
    "missing contract",
    (f) => {
      f.instances.pop();
    },
    "unavailable",
    "ledger_entry_absent_or_archived",
  ],
  [
    "missing deployed WASM",
    (f) => {
      f.codes.pop();
    },
    "unavailable",
    "ledger_entry_absent_or_archived",
  ],
  [
    "duplicate RPC entries",
    (f) => {
      f.instances[1] = f.instances[0];
    },
    "unknown",
    "unexpected_ledger_key",
  ],
  [
    "expired instance",
    (f) => {
      f.instances[0].liveUntilLedgerSeq = 99;
    },
    "unknown",
    "unreadable_or_expired_entry",
  ],
  [
    "missing TTL",
    (f) => {
      delete f.instances[0].liveUntilLedgerSeq;
    },
    "unknown",
    "unreadable_or_expired_entry",
  ],
  [
    "malformed ledger data",
    (f) => {
      f.instances[0].val = {};
    },
    "unknown",
    "malformed_verification_data",
  ],
  [
    "wrong data address behind matching key",
    (f) => {
      f.instances[0].val.contractData().contract(new Address(reputationId).toScAddress());
    },
    "unknown",
    "unexpected_contract_data",
  ],
  [
    "wrong linked contract",
    (f) => {
      f.instances[0] = instanceEntry(escrowId, escrowBytes, "ReputationContract", escrowId);
    },
    "mismatch",
    "contract_link_mismatch",
  ],
  [
    "missing link",
    (f) => {
      f.instances[0].val.contractData().val().instance().storage([]);
    },
    "unknown",
    "missing_or_ambiguous_contract_link",
  ],
  [
    "wrong remote code bytes",
    (f) => {
      f.codes[0].val.contractCode().code(reputationBytes);
    },
    "mismatch",
    "escrow_remote_bytes_mismatch",
  ],
  [
    "wrong remote code hash",
    (f) => {
      f.codes[0].val.contractCode().hash(Buffer.alloc(32, 9));
    },
    "mismatch",
    "escrow_remote_bytes_mismatch",
  ],
  [
    "missing WASM",
    (f) => {
      f.readBytes = async () => {
        throw new Error("SECRET");
      };
    },
    "unknown",
    "unreadable_escrow_wasm",
  ],
  [
    "invalid WASM",
    (f) => {
      f.readBytes = async () => Buffer.from("not wasm");
    },
    "unknown",
    "invalid_escrow_wasm",
  ],
])
  test(label, async () => {
    const f = fixture();
    change(f);
    const result = await verifyDeploymentIdentity(f);
    assert.equal(result.status, status);
    assert.equal(result.code, code);
    assert.notEqual(exitCode(result), 0);
    assert.doesNotMatch(JSON.stringify(result), /SECRET/);
  });

for (const [label, reader, status, code] of [
  [
    "unavailable network",
    {
      getNetwork: async () => {
        throw new Error("https://user:SECRET@host/private");
      },
    },
    "unavailable",
    "network_rpc_unavailable",
  ],
  ["malformed network", { getNetwork: async () => ({}) }, "unknown", "malformed_network_response"],
  [
    "unavailable ledger",
    {
      getNetwork: async () => ({ passphrase: "Test SDF Network ; September 2015" }),
      getLedgerEntries: async () => {
        throw new Error("SECRET");
      },
    },
    "unavailable",
    "ledger_rpc_unavailable",
  ],
  [
    "malformed ledger envelope",
    {
      getNetwork: async () => ({ passphrase: "Test SDF Network ; September 2015" }),
      getLedgerEntries: async () => ({ entries: [] }),
    },
    "unknown",
    "malformed_ledger_response",
  ],
])
  test(label, async () => {
    const result = await verifyDeploymentIdentity({ ...fixture(), reader });
    assert.equal(result.status, status);
    assert.equal(result.code, code);
    assert.doesNotMatch(JSON.stringify(result), /SECRET|private/);
  });

test("fails unknown if instance changes while code is read", async () => {
  const f = fixture();
  let reads = 0;
  f.reader.getLedgerEntries = async () => ({
    latestLedger: 100,
    entries:
      ++reads === 2
        ? f.codes
        : reads === 3
          ? [instanceEntry(escrowId, escrowBytes, "ReputationContract", escrowId), f.instances[1]]
          : f.instances,
  });
  assert.equal((await verifyDeploymentIdentity(f)).code, "contract_changed_during_verification");
});

for (const field of [
  "STELLAR_NETWORK",
  "STELLAR_RPC_URL",
  "ESCROW_CONTRACT_ID",
  "REPUTATION_CONTRACT_ID",
])
  test(`requires backend ${field} before RPC`, async () => {
    const f = fixture();
    delete f.scope[field];
    assert.equal((await verifyDeploymentIdentity(f)).code, `missing_${field}`);
    assert.deepEqual(f.calls, []);
  });

for (const [label, change, code] of [
  [
    "duplicate contract IDs",
    (f) => {
      f.scope.REPUTATION_CONTRACT_ID = escrowId;
    },
    "duplicate_contract_ids",
  ],
  [
    "prototype network label",
    (f) => {
      f.scope.STELLAR_NETWORK = "constructor";
    },
    "invalid_backend_network",
  ],
  [
    "invalid contract ID",
    (f) => {
      f.scope.ESCROW_CONTRACT_ID = "C".repeat(56);
    },
    "invalid_escrow_contract_id",
  ],
  [
    "invalid endpoint",
    (f) => {
      f.scope.STELLAR_RPC_URL = "SECRET";
    },
    "invalid_rpc_url",
  ],
  [
    "remote insecure endpoint",
    (f) => {
      f.scope.STELLAR_RPC_URL = "http://example.com";
    },
    "insecure_rpc_url",
  ],
  [
    "conflicting unused backend passphrase variable",
    (f) => {
      f.scope.STELLAR_NETWORK_PASSPHRASE = "other";
    },
    "conflicting_network_passphrase",
  ],
  [
    "missing revision",
    (f) => {
      delete f.build.sourceRevision;
    },
    "invalid_source_revision",
  ],
  [
    "unknown source state",
    (f) => {
      delete f.build.sourceState;
    },
    "missing_source_state",
  ],
  [
    "dirty source without diff hash",
    (f) => {
      f.build.sourceState = "dirty";
    },
    "missing_source_diff_hash",
  ],
  [
    "missing test proof",
    (f) => {
      f.build.testResult = "unknown";
    },
    "unverified_local_tests",
  ],
  [
    "missing toolchain",
    (f) => {
      delete f.build.toolchain;
    },
    "missing_toolchain",
  ],
  [
    "missing build command",
    (f) => {
      delete f.build.buildCommand;
    },
    "missing_buildCommand",
  ],
  [
    "missing test command",
    (f) => {
      delete f.build.testCommand;
    },
    "missing_testCommand",
  ],
  [
    "missing build mode",
    (f) => {
      delete f.build.buildMode;
    },
    "missing_build_mode",
  ],
  [
    "missing test timestamp",
    (f) => {
      delete f.build.testedAt;
    },
    "missing_test_timestamp",
  ],
  [
    "missing WASM input",
    (f) => {
      delete f.build.escrow.wasmPath;
    },
    "missing_escrow_wasm",
  ],
  [
    "malformed build hash",
    (f) => {
      f.build.escrow.sha256 = "bad";
    },
    "missing_escrow_build_hash",
  ],
])
  test(label, async () => {
    const f = fixture();
    change(f);
    const result = await verifyDeploymentIdentity(f);
    assert.equal(result.status, "unknown");
    assert.equal(result.code, code);
    assert.equal(exitCode(result), 2);
    assert.deepEqual(f.calls, []);
  });

test("supports literal backend network passphrases and explicitly dirty provenance", async () => {
  const f = fixture();
  f.scope.STELLAR_NETWORK = "Standalone Network ; February 2017";
  f.scope.STELLAR_RPC_URL = "http://localhost:8000";
  f.build.sourceState = "dirty";
  f.build.sourceDiffSha256 = "b".repeat(64);
  assert.equal(validateInputs(f.scope, f.build).passphrase, f.scope.STELLAR_NETWORK);
  f.reader.getNetwork = async () => ({ passphrase: f.scope.STELLAR_NETWORK });
  const result = await verifyDeploymentIdentity(f);
  assert.equal(result.status, "matched");
  assert.equal(result.sourceState, "dirty");
  assert.equal(result.sourceDiffSha256, f.build.sourceDiffSha256);
});
