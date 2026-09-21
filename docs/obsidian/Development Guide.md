---
type: operations
area: development
status: current
last_updated: 2026-09-21
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
```

`web` tests use Vitest. Backend linting also type-checks `packages/backend/convex/tsconfig.json`.

## Contracts

```bash
pnpm contracts:build
cd contracts && cargo test
```

These commands build/test locally. Deployment and verification commands are network-changing or chain-reading operations; see [[operations/Deployment]].

## Focused Exploration

1. Read [[Home]] and [[Repository Map]].
2. Read the relevant module, data, frontend, backend, or Stellar notes.
3. Inspect the listed common change locations.
4. Use generated Convex API output only after identifying the source domain files.
5. Update affected vault notes when the change changes repository knowledge.

## Safety

Do not run deployment scripts, submit transactions, start long-lived servers, or change external services for a documentation-only task. Never copy `.env.local` values, keys, credentials, or tokens into documentation.
