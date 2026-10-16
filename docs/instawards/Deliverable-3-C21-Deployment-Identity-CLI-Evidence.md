# Deliverable 3 C21 — Deployment Identity CLI Acceptance Evidence

Implemented locally on 2026-10-15. C21 extends the existing C20 deployment-identity verifier tests across the actual CLI and file-input boundary. The verifier command, schemas, and exit-code contract are unchanged.

## Coverage

- Runs the verifier as a child process from a separate working directory, with temporary input and artifact paths containing spaces.
- Uses synthetic WASM and a loopback Stellar RPC fixture that accepts only `getNetwork` and `getLedgerEntries`.
- Verifies matching Testnet passphrase, escrow/reputation IDs, local and remote code hashes, reciprocal links, JSON output, and exit code `0` across repeat runs.
- Verifies network, executable hash, reciprocal link, and remote byte mismatches return exit code `1`.
- Verifies missing arguments, malformed/unreadable JSON, missing WASM, and local hash mismatch fail before any RPC request.
- Verifies RPC errors and missing ledger entries return exit code `2`; output omits synthetic endpoint credentials, paths, build command text, and upstream error details.
- Confirms repeated runs leave scope and provenance inputs unchanged.

## Validation

- Baseline before C21: `pnpm contracts:test:identity` passed 49 tests when loopback socket access was permitted.
- After C21: `pnpm contracts:test:identity` passed 57 tests (57 passed, 0 failed).
- `node --check scripts/verify-deployment-identity.mjs` and `node --check scripts/verify-deployment-identity.test.mjs` passed.
- `pnpm exec oxlint scripts/verify-deployment-identity.test.mjs` passed.
- `pnpm exec oxfmt --check scripts/verify-deployment-identity.test.mjs` passed.
- `git diff --check` passed.

The sandboxed test invocation initially could not bind the existing loopback fixture (`listen EPERM`). Re-running the suite with local socket access allowed passed; the fixture makes no external network calls.

## Limits

All RPC responses and WASM files are synthetic. This verifies repeatable local CLI behavior and read-only RPC method selection, not production source-to-WASM provenance, a live Testnet deployment, or any participant flow. The build provenance remains operator-supplied. No deployment, transaction, contract change, environment change, or live identity check was performed; live deployment identity remains unverified.
