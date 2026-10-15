import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

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

const verifierPath = fileURLToPath(new URL("./verify-deployment-identity.mjs", import.meta.url));

async function runCli(args, cwd) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [verifierPath, ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, 15_000);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error("Deployment identity CLI exceeded its 15 second test timeout"));
        return;
      }
      resolve({
        code,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

async function withCliFixture(callback, { mode = "match" } = {}) {
  const rpcFixture = fixture();
  const methods = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const rpcRequest = JSON.parse(body);
    methods.push(rpcRequest.method);
    const send = (value) => {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ jsonrpc: "2.0", id: rpcRequest.id, ...value }));
    };

    if (rpcRequest.method === "getNetwork") {
      if (mode === "rpc-error") {
        send({ error: { code: -32000, message: "UPSTREAM_SECRET rpc.internal/private" } });
      } else {
        send({
          result: {
            passphrase:
              mode === "network-mismatch"
                ? "Public Global Stellar Network ; September 2015"
                : "Test SDF Network ; September 2015",
          },
        });
      }
      return;
    }

    if (rpcRequest.method !== "getLedgerEntries") {
      send({ error: { code: -32601, message: "Unexpected non-read RPC method" } });
      return;
    }
    const firstKey = xdr.LedgerKey.fromXDR(rpcRequest.params.keys[0], "base64");
    let entries;
    if (mode === "missing-ledger" && firstKey.switch().name !== "contractCode") {
      entries = [];
    } else if (firstKey.switch().name === "contractCode") {
      entries = rpcFixture.codes;
    } else {
      entries = rpcFixture.instances;
    }
    send({
      result: {
        latestLedger: 100,
        entries: entries.map((entry) => ({
          key: entry.key.toXDR("base64"),
          xdr: entry.val.toXDR("base64"),
          lastModifiedLedgerSeq: 99,
          liveUntilLedgerSeq: entry.liveUntilLedgerSeq,
        })),
      },
    });
  });

  let root;
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    root = await mkdtemp(join(tmpdir(), "highrable C21 LOCAL_PATH_SECRET "));
    const inputDirectory = join(root, "input files with spaces");
    const artifactDirectory = join(inputDirectory, "artifacts");
    const cwd = join(root, "different working directory with spaces");
    await Promise.all([mkdir(artifactDirectory, { recursive: true }), mkdir(cwd)]);
    const scopePath = join(inputDirectory, "backend scope.json");
    const buildPath = join(inputDirectory, "build provenance.json");
    const wasmPaths = {
      escrow: join(artifactDirectory, "escrow local fixture.wasm"),
      reputation: join(artifactDirectory, "reputation local fixture.wasm"),
    };
    await Promise.all([
      writeFile(wasmPaths.escrow, escrowBytes),
      writeFile(wasmPaths.reputation, reputationBytes),
    ]);
    const scopeData = {
      ...structuredClone(scope),
      STELLAR_RPC_URL: `http://127.0.0.1:${server.address().port}/rpc?token=RPC_TOKEN_SECRET`,
    };
    const buildData = {
      ...structuredClone(provenance),
      buildCommand: "stellar contract build --token BUILD_COMMAND_SECRET",
      escrow: { ...provenance.escrow, wasmPath: "artifacts/escrow local fixture.wasm" },
      reputation: { ...provenance.reputation, wasmPath: "artifacts/reputation local fixture.wasm" },
    };
    const writeScope = (value = scopeData) =>
      writeFile(scopePath, typeof value === "string" ? value : JSON.stringify(value));
    const writeBuild = (value = buildData) =>
      writeFile(buildPath, typeof value === "string" ? value : JSON.stringify(value));
    await Promise.all([writeScope(), writeBuild()]);

    if (mode === "deployed-code-mismatch") {
      rpcFixture.instances[0].val
        .contractData()
        .val()
        .instance()
        .executable(xdr.ContractExecutable.contractExecutableWasm(Buffer.alloc(32, 8)));
    } else if (mode === "contract-link-mismatch") {
      rpcFixture.instances[0] = instanceEntry(
        escrowId,
        escrowBytes,
        "ReputationContract",
        escrowId,
      );
    } else if (mode === "remote-bytes-mismatch") {
      rpcFixture.codes[0].val.contractCode().code(reputationBytes);
    }

    const run = (args = ["--scope", scopePath, "--build", buildPath]) => runCli(args, cwd);
    const captureInputs = async () =>
      await Promise.all([readFile(scopePath, "utf8"), readFile(buildPath, "utf8")]);
    await callback({
      root,
      cwd,
      scopePath,
      buildPath,
      buildValue: buildData,
      methods,
      run,
      writeScope,
      writeBuild,
      captureInputs,
    });
  } finally {
    if (server.listening)
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          server.closeAllConnections();
          resolve();
        }, 5_000);
        server.close(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    if (root) await rm(root, { recursive: true, force: true });
  }
}

function parseCliResult(result, expectedExitCode) {
  assert.equal(result.code, expectedExitCode, result.stderr || result.stdout);
  assert.equal(result.signal, null);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

test("CLI matches the selected identity from files and repeats without modifying inputs", async () => {
  await withCliFixture(async ({ root, methods, run, captureInputs }) => {
    const before = await captureInputs();
    const first = parseCliResult(await run(), 0);
    const second = parseCliResult(await run(), 0);
    const stableFields = (record) => ({
      status: record.status,
      readOnly: record.readOnly,
      code: record.code,
      ledger: record.ledger,
      scopeSha256: record.scopeSha256,
      provenanceSha256: record.provenanceSha256,
      sourceRevision: record.sourceRevision,
      networkPassphraseSha256: record.networkPassphraseSha256,
      contracts: record.contracts,
    });
    assert.equal(first.status, "matched");
    assert.equal(first.code, "deployment_identity_matched");
    assert.equal(first.readOnly, true);
    assert.equal(first.contracts.escrow.contractId, escrowId);
    assert.equal(first.contracts.reputation.contractId, reputationId);
    assert.equal(first.contracts.escrow.localSha256, hash(escrowBytes));
    assert.equal(first.contracts.escrow.remoteSha256, hash(escrowBytes));
    assert.equal(first.contracts.reputation.localSha256, hash(reputationBytes));
    assert.equal(first.contracts.reputation.remoteSha256, hash(reputationBytes));
    assert.deepEqual(stableFields(second), stableFields(first));
    assert.deepEqual(methods, [
      "getNetwork",
      "getLedgerEntries",
      "getLedgerEntries",
      "getLedgerEntries",
      "getNetwork",
      "getLedgerEntries",
      "getLedgerEntries",
      "getLedgerEntries",
    ]);
    const output = JSON.stringify([first, second]);
    for (const secret of [
      "LOCAL_PATH_SECRET",
      "RPC_TOKEN_SECRET",
      "BUILD_COMMAND_SECRET",
      "UPSTREAM_SECRET",
      root,
      "rpc.internal/private",
    ])
      assert.equal(output.includes(secret), false, `CLI output leaked ${secret}`);
    assert.deepEqual(await captureInputs(), before);
  });
});

for (const [mode, expectedCode] of [
  ["network-mismatch", "network_mismatch"],
  ["deployed-code-mismatch", "escrow_deployed_code_mismatch"],
  ["contract-link-mismatch", "contract_link_mismatch"],
  ["remote-bytes-mismatch", "escrow_remote_bytes_mismatch"],
])
  test(`CLI reports ${expectedCode} with mismatch exit status`, async () => {
    await withCliFixture(
      async ({ methods, run }) => {
        const result = parseCliResult(await run(), 1);
        assert.equal(result.status, "mismatch");
        assert.equal(result.code, expectedCode);
        assert.ok(methods.every((method) => ["getNetwork", "getLedgerEntries"].includes(method)));
      },
      { mode },
    );
  });

test("CLI rejects arguments and local files before making RPC calls", async () => {
  const cases = [
    {
      name: "missing arguments",
      args: [],
      expectedCode: "usage_expected_scope_and_build_json_paths",
    },
    {
      name: "malformed JSON",
      prepare: ({ writeScope }) => writeScope("{"),
      expectedCode: "unreadable_input_json",
    },
    {
      name: "unreadable scope file",
      args: ({ buildPath }) => [
        "--scope",
        join(tmpdir(), "missing C21 scope file.json"),
        "--build",
        buildPath,
      ],
      expectedCode: "unreadable_input_json",
    },
    {
      name: "missing WASM",
      prepare: ({ buildValue, writeBuild }) =>
        writeBuild({
          ...buildValue,
          escrow: { ...buildValue.escrow, wasmPath: "artifacts/absent local fixture.wasm" },
        }),
      expectedCode: "unreadable_escrow_wasm",
    },
    {
      name: "local hash mismatch",
      prepare: ({ buildValue, writeBuild }) =>
        writeBuild({
          ...buildValue,
          escrow: { ...buildValue.escrow, sha256: "0".repeat(64) },
        }),
      expectedCode: "escrow_local_build_hash_mismatch",
      expectedStatus: "mismatch",
      expectedExitCode: 1,
    },
  ];

  for (const scenario of cases) {
    await withCliFixture(async (fixtureData) => {
      if (scenario.prepare) await scenario.prepare(fixtureData);
      const args = typeof scenario.args === "function" ? scenario.args(fixtureData) : scenario.args;
      const result = parseCliResult(await fixtureData.run(args), scenario.expectedExitCode ?? 2);
      assert.equal(result.code, scenario.expectedCode, scenario.name);
      assert.equal(result.status, scenario.expectedStatus ?? "unknown", scenario.name);
      assert.deepEqual(fixtureData.methods, [], `${scenario.name} unexpectedly contacted RPC`);
    }).catch((error) => {
      error.message = `${scenario.name}: ${error.message}`;
      throw error;
    });
  }
});

for (const [mode, expectedCode, expectedStatus] of [
  ["rpc-error", "network_rpc_unavailable", "unavailable"],
  ["missing-ledger", "ledger_entry_absent_or_archived", "unavailable"],
])
  test(`CLI reports ${expectedCode} with unavailable exit status`, async () => {
    await withCliFixture(
      async ({ methods, run }) => {
        const result = parseCliResult(await run(), 2);
        assert.equal(result.status, expectedStatus);
        assert.equal(result.code, expectedCode);
        const output = JSON.stringify(result);
        assert.equal(output.includes("UPSTREAM_SECRET"), false);
        assert.equal(output.includes("rpc.internal/private"), false);
        assert.ok(methods.every((method) => ["getNetwork", "getLedgerEntries"].includes(method)));
      },
      { mode },
    );
  });

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
