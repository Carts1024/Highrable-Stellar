---
type: operations
area: development
status: current
last_updated: 2026-09-28
source_of_truth: repository
---

# Development Guide

## Toolchain

- Package manager: pnpm workspace; root `package.json` declares `packageManager: pnpm@12.5.1`.
- Node: root `package.json` declares `>=20.9.0`.
- Build orchestration: Turborepo via `turbo.json`.
- TypeScript: root and shared configuration declare TypeScript `5.9.2`.
- Lint/format: `oxlint` and `oxfmt`.
- Git hooks: Husky is configured at the root.
- Contracts: Rust workspace in `contracts/`, Soroban SDK `22.0.0`, built with the Stellar CLI.
- GitHub Actions: CI uses Node `24`, the manifest-pinned pnpm version, Rust `1.98.1`, and Stellar CLI `28.0.0`.

Use `GEMINI.md` for the repository’s existing conventions. Its older Node/pnpm prerequisite text is superseded by the root manifest.

## Install and Run

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
cp packages/backend/.env.example packages/backend/.env.local
pnpm dev
```

The web package uses Next.js on port 3000. The root dev task runs the Turborepo development graph; the frontend and backend can also be run from their package directories with their package `dev` scripts.

## Build and Lint

```bash
pnpm build
pnpm lint:fix
pnpm --filter web build
pnpm --filter web lint:fix
pnpm --filter web test
pnpm --filter @repo/backend lint:fix
pnpm --filter @repo/backend test
pnpm --filter web lint:check
pnpm --filter web typecheck
pnpm --filter @repo/backend lint:check
pnpm --filter @repo/backend typecheck
pnpm --filter @repo/ui lint:check
pnpm --filter @repo/ui typecheck
pnpm --filter @repo/convex-client lint:check
pnpm --filter @repo/convex-client typecheck
pnpm exec tsc --project packages/backend/convex/tsconfig.json --noEmit
pnpm exec tsc --project packages/backend/tests/tsconfig.json --noEmit
```

`web` tests use Vitest. Backend linting also type-checks `packages/backend/convex/tsconfig.json`.
Backend dispute tests use `convex-test` and Vitest in `packages/backend/tests/`; they run against the real composed Convex schema in an Edge Runtime in-memory database. Keep fixtures deterministic and seed prerequisite records directly rather than calling unrelated production setup functions. Use synthetic administrator environment values only inside tests.

The read-only `lint:check` and `typecheck` scripts are used by CI. Web typechecking generates Next.js route types first; backend typechecking checks both Convex source and tests. Changed-file formatting runs `node scripts/ci/check-changed-format.mjs` with `FORMAT_BASE_SHA` and `FORMAT_HEAD_SHA`; it skips deletions and unsupported extensions and safely handles renamed paths and spaces. CI does not run the mutating `lint:fix` scripts.

## Contracts

```bash
cargo test --workspace --locked --manifest-path contracts/Cargo.toml
stellar contract build --manifest-path contracts/Cargo.toml --package highrable-escrow --locked
stellar contract build --manifest-path contracts/Cargo.toml --package highrable-reputation --locked
stellar contract build --manifest-path contracts/Cargo.toml --package highrable-registry --locked
```

CI runs the locked workspace test and builds all three WASM contracts. It uploads the three WASM files, SHA-256 checksums, and source/toolchain metadata for 14 days. These commands do not deploy contracts. Deployment and verification commands are network-changing or chain-reading operations; see [[operations/Deployment]].

## Focused Exploration

1. Read [[Home]] and [[Repository Map]].
2. Read the relevant module, data, frontend, backend, or Stellar notes.
3. Inspect the listed common change locations.
4. Use generated Convex API output only after identifying the source domain files.
5. Update affected vault notes when the change changes repository knowledge.

## Safety

Do not run deployment scripts, submit transactions, start long-lived servers, or change external services for a documentation-only task. Never copy `.env.local` values, keys, credentials, or tokens into documentation.
