# Deliverable 2 C20 — deployment identity verification

Implemented locally on 2026-10-09. This is the Deliverable 2 verifier, not the Deliverable 1 C20 state-guard tests.

## Command and inputs

Run `pnpm contracts:verify:identity --scope <backend-scope.json> --build <build-provenance.json>`. The command prints a JSON record and exits 0 only for a match, 1 for a mismatch, and 2 for unknown/unavailable evidence. `pnpm contracts:test:identity` runs its isolated Node tests.

The scope JSON must contain the intended backend's `STELLAR_NETWORK`, `STELLAR_RPC_URL`, `ESCROW_CONTRACT_ID`, and `REPUTATION_CONTRACT_ID`. Use the actual backend scope, not an assumed default deployment artifact. `testnet` and `mainnet` map to the same passphrases as the backend; other supported values are literal passphrases. If supplied, `STELLAR_NETWORK_PASSPHRASE` must agree. HTTPS is required except for loopback test/local endpoints. Keep credential-bearing scope files outside tracked source.

The build JSON requires:

- `sourceRevision`: full 40-character lowercase commit hash.
- `sourceState`: `clean` or `dirty`; dirty builds also require a 64-character lowercase `sourceDiffSha256`.
- `toolchain`, `buildCommand`, `testCommand`: nonempty descriptions of the actual build and tests.
- `buildMode`: `release` or `optimized`, matching the actual deployed build pipeline.
- `testResult`: `passed`, and `testedAt`: an ISO timestamp from the actual test run.
- `escrow` and `reputation`: each contains `wasmPath` and a lowercase SHA-256 `sha256`. Relative paths resolve beside the build JSON.

Build/test provenance is an **operator-supplied attestation**. The verifier independently hashes the selected local bytes, but cannot certify that the reported source revision produced them or that the reported tests ran. Do not fill this record from historical test claims or manufacture a passing attestation. Build and test the selected source first, using the same optimization pipeline as deployment.

## What the verifier proves

`scripts/verify-deployment-identity.mjs` uses the backend's installed Stellar SDK and only RPC `getNetwork` and `getLedgerEntries`. It compares network identity, exact contract IDs/ledger keys, WASM executable hashes, actual remote code bytes, reciprocal escrow/reputation links, and a second instance read to detect changes during verification. Expired, missing, malformed, unexpected, and regressing-ledger responses fail closed. Active deployments may have an escrow counter greater than one. No signing identity, transaction, simulation, restoration, deployment, or artifact rewrite is used.

The output identifies source revision/state, contract IDs, byte hashes, observation ledger, timestamp, and hashes of the supplied scope/provenance. It suppresses endpoint credentials, passphrases, file paths, commands, and raw upstream errors. A match is a point-in-time identity observation, not a promise about subsequent upgrades or a complete application readiness result.

The older `contracts:verify:testnet` remains a separate post-deployment wiring check. Its contract invocations require an identity and must not be assumed read-only; it was not executed here.

## Validation and limits

- `node --test scripts/verify-deployment-identity.test.mjs`: 49 tests passed, including real SDK decoding against a loopback HTTP JSON-RPC fixture. Tests use synthetic WASM/XDR, not production build artifacts.
- Syntax checks, scoped oxlint, and oxfmt checks passed.
- Repository `pnpm lint:fix` passed with existing warnings. The local pnpm launcher required a wrapper around the installed 12.5.1 Node entry point, with automatic dependency installation disabled. An earlier automatic install was interrupted and the dependency environment restored from cache using pnpm 10.33.2; tracked manifests and lockfile were preserved. Installed versions within declared ranges were re-resolved, so prior test totals are not treated as current evidence.
- C19 baseline rechecked before this work: 31 backend tests and 27 recovery-route tests passed; existing commit `cc779dd` is retained.

**Production WASM build/test provenance and live Testnet verification are blocked.** This host has no discovered Rust/Stellar executable or built production WASM, and no confirmed matching backend scope was available. No live-match record, deployment, or transaction was produced. The verifier implementation is complete; live identity acceptance remains pending those inputs.
