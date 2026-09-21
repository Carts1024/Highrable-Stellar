---
type: reference
area: repository
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Repository Map

Highrable is a pnpm workspace coordinated by Turborepo. The main architectural boundary is between the browser product, Convex product state, and direct Stellar/Soroban execution.

| Area | Responsibility and entry points | Common change locations and boundaries | Related notes |
| --- | --- | --- | --- |
| `apps/web` | Next.js 16 App Router application; route pages compose feature slices and core providers. | `app/`, `core/`, `features/`; UI code should not move contract-building logic into page files. | [[frontend/Frontend Overview]], [[frontend/Feature Slices]] |
| `apps/web/app` | URL routes, layouts, metadata, and server API routes. | Add a route under the matching path; auth and admin server routes live under `app/api`. | [[frontend/Routes and API]], [[backend/Admin and Server Routes]] |
| `apps/web/core` | Cross-cutting configuration, providers, wallet, passkey, Stellar, admin, SEO, and debugger code. | `core/config`, `core/wallet`, `core/passkeys`, `core/stellar`; keep provider and transaction concerns here. | [[frontend/Wallet and Stellar Client Layer]], [[stellar/Stellar Integration]] |
| `apps/web/features` | Feature-sliced product behavior and UI. | `marketplace`, `jobs`, `post-job`, `work-agreements`, `work-submissions`, `disputes`, `cancellations`, `dashboard`, `profile`, `proof`, `admin`, and related slices. | [[frontend/Feature Slices]], [[modules/README]] |
| `packages/backend/convex` | Convex schema, queries, mutations, actions, domain helpers, and internal functions. | Domain folders contain `schema.ts`, `queries.ts`, `mutations.ts`, and helpers; top-level files re-export public functions. | [[backend/Convex Overview]], [[data/Convex Schema]] |
| `packages/convex-client` | Typed Convex client and generated API re-export layer consumed by the web app. | `src/index.ts` for browser client/types; `src/server.ts` for server route use. It is not a separate product SDK or indexer. | [[backend/Convex Overview]], [[architecture/Integration Boundaries]] |
| `packages/ui` | Shared UI primitives, Highrable-specific components, theme/providers, email templates, and utilities. | `src/components/ui` is generic; `src/components/highrable` is product-specific; exports are package subpaths. | [[architecture/Frontend Architecture]] |
| `packages/typescript-config` | Shared TypeScript presets (`base`, `nextjs`, `react-library`). | Change presets only when the workspace-wide compiler contract changes. | [[Development Guide]] |
| `contracts/escrow` | Rust/Soroban escrow contract and unit tests. | `src/lib.rs` is authoritative for public methods, storage, auth, status transitions, transfers, and reputation calls; `src/test.rs` covers behavior. | [[contracts/Escrow Contract]], [[data/State Machines]] |
| `contracts/reputation` | Rust/Soroban completion record and freelancer aggregate statistics contract. | `src/lib.rs` and `src/test.rs`; it is authorized by the escrow contract rather than by arbitrary users. | [[contracts/Reputation Contract]] |
| `deployments` | Tracked deployment metadata for escrow/reputation and smart-account readiness metadata. | `testnet.json` and `mainnet.json` record contract deployments; `smart-accounts/*.json` are currently placeholders with empty verified fields. | [[contracts/Deployment Artifacts]], [[stellar/Mainnet Readiness and Relayers]] |
| `scripts` | Contract deployment, verification, mainnet cost/readiness, and environment helper scripts. | `deploy-contracts.sh` contains the shared deployment workflow; wrapper scripts select network. These commands can change external chain state. | [[operations/Deployment]] |
| `docs` | Human-authored project documentation, plans, debug reports, and operational notes. | Link useful documents from the vault; do not assume older phase notes match source. | [[Current System State]], [[Home]] |
| Root configuration | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.oxlintrc.json`, `.oxfmtrc.jsonc`, `.husky/pre-commit`, `.npmrc`, `GEMINI.md`. | Package manager/version, build graph, lint/format rules, and repository instructions are authoritative here. | [[Development Guide]], [[operations/Local Development]] |

## Boundaries to Keep in Mind

- Convex records product workflow state, but Soroban owns the escrow contract state and on-chain completion record.
- The browser uses `@repo/convex-client` for Convex calls and `apps/web/core/stellar` for direct Stellar calls.
- Generated Convex files under `packages/backend/convex/_generated` are outputs, not primary design notes.
- `node_modules`, `.next`, `dist`, `build`, `out`, `contracts/target`, screenshots, PDFs, lockfiles, and agent-support libraries are not default exploration targets.
