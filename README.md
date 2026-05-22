<div align="center">
  <img src="apps/web/public/logo/highrable-icon.jpg" alt="Highrable logo" width="96" />

  # Highrable

  **A Stellar-native freelance marketplace where work, escrow, and reputation are verifiable by default.**

  [Live App](https://www.highrable.work) | [Demo Assets](https://drive.google.com/drive/folders/1SNSxRG1NNy0hip1uO_nbwKSQipTo3hV4?usp=drive_link) | [Mainnet Readiness](docs/mainnet-smart-account-readiness.md)

  ![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square)
  ![React](https://img.shields.io/badge/React-19-149eca?style=flat-square)
  ![Convex](https://img.shields.io/badge/Convex-Backend-f3b01c?style=flat-square)
  ![Stellar](https://img.shields.io/badge/Stellar-Soroban-7d00ff?style=flat-square)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square)
  ![Rust](https://img.shields.io/badge/Rust-Smart_Contracts-b7410e?style=flat-square)
</div>

## Table of Contents

- [Overview](#overview)
- [Why Highrable Exists](#why-highrable-exists)
- [Feature Overview](#feature-overview)
- [Product Workflows](#product-workflows)
- [Smart Contracts](#smart-contracts)
- [Backend Model](#backend-model)
- [Application Routes](#application-routes)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Common Commands](#common-commands)
- [Deployment](#deployment)
- [Current Status](#current-status)
- [Team](#team)

## Overview

Highrable is a full-stack freelance marketplace built around Stellar and Soroban. It combines a Next.js web app, a Convex operational backend, and Rust smart contracts for escrow and reputation.

The product goal is simple: make freelance work safer by replacing opaque platform promises with contract-backed payment protection, wallet-linked identity, and portable proof of completed work.

Highrable supports the full job lifecycle:

1. A client posts a job or milestone project.
2. Freelancers browse, evaluate safety signals, and apply.
3. The client selects a freelancer and funds escrow on Stellar.
4. The freelancer submits work and proof.
5. The client releases payment.
6. The release can create a verified on-chain reputation record.
7. If something goes wrong, cancellation, revision, dispute, and admin workflows keep the case auditable.

## Why Highrable Exists

Traditional freelance platforms often rely on private ledgers, locked-in profiles, and platform-controlled trust. Highrable takes a different approach:

| Problem | Highrable approach |
| --- | --- |
| Client funds are held inside opaque platform systems. | Funds are locked in Soroban escrow contracts with explicit lifecycle states. |
| Reputation is platform-owned and hard to verify. | Completed escrow releases can write portable reputation records on-chain. |
| Cross-border payouts can be slow and expensive. | Stellar assets enable fast, low-friction settlement. |
| Freelancers need stronger protection before starting work. | Marketplace listings surface funding, trust, safety, and scam-signal context. |
| Disputes and proof often live outside the platform. | Work submissions, attachments, chat, agreement versions, disputes, and admin notes are modeled in Convex. |

## Feature Overview

| Area | Features |
| --- | --- |
| Marketplace | Job posting, job browsing, search, safety-first sorting, budget sorting, funded-job filtering, job detail pages, application dialogs, proposal submission, showcased work selection. |
| Job lifecycle | Micro-gig jobs, milestone projects, client freelancer selection, open escrow assignment, job status tracking, selected/funded/submitted/completed/cancelled/disputed states. |
| Escrow payments | Soroban escrow creation, create-and-fund flow, asset allowlist, funding, work submission, payment release, cancellation, dispute marking, dispute resolution payout splitting. |
| Stablecoin support | USDC-style asset configuration, Stellar Asset Contract support, stablecoin balance panels, trustline readiness, optional XLM escrow support, XLM-to-USDC top-up flow. |
| Wallets | Stellar Wallets Kit integration, wallet persistence, Stellar challenge/verify auth, wallet session cookies, wallet-required route guards. |
| Passkey smart accounts | Passkey account creation and restore flows, smart-account readiness checks, WebAuthn verifier config, relayer/channel config, smart-account escrow execution paths. |
| Profiles | Freelancer public profiles, client trust profiles, identity/profile editing, avatar display, reputation sections, client reliability badges, recent jobs/payments/escrows. |
| Dashboards | Freelancer mode, client mode, income metrics, pending balance, recent payouts, applied jobs, ongoing jobs, posted jobs, deadline notifications, admin auto-routing for admin wallets. |
| Work delivery | Work agreements, agreement versions, review route, work submissions, proof hashes, revision requests, deadline reminders, notifications. |
| Attachments | Attachment records, protected viewer, visibility controls, access logging, evidence support for disputes and work delivery. |
| Chat | Parent-linked conversations, messages, system events, read tracking, unread state support. |
| Proof pages | Public escrow proof pages, work details, reputation context, timeline, share actions, proof status explanation. |
| Trust and safety | Job report button/dialog, scam-signal detection, safety badges, freelancer safety checklist, trust warnings, off-platform risk handling, admin dispute review. |
| Cancellations | Cancellation request records, cancellation events, cancellation eligibility, cancellation status panels, cancellation action hooks. |
| Disputes | User dispute list/detail pages, open dispute dialog, dispute timeline, evidence attachments, response composer, on-chain dispute retry, on-chain status badges. |
| Admin operations | Admin wallet gate, metrics dashboard, dispute queue, dispute detail pages, moderation notes, status updates, settlement recording APIs. |
| SEO and public app polish | Metadata helpers, sitemap, robots, JSON-LD helpers, shared app shell, responsive marketing/landing pages. |
| Shared UI | Reusable UI components, highrable-branded marketing sections, loading states, rich text components, date/time controls, sidebar components. |

## Product Workflows

### Client workflow

Clients can post work, define budgets and assets, review applications, select freelancers, fund escrow, approve submitted work, release payments, request cancellation, or open disputes. Client profile pages also expose trust indicators such as recent jobs, funded escrows, completed payments, reports, and work breakdowns.

### Freelancer workflow

Freelancers can browse marketplace jobs, filter for safer funded work, submit proposals, showcase previous verified work, track applied and ongoing jobs, submit proof of work, respond to disputes, and build wallet-linked public reputation.

### Marketplace safety workflow

Highrable includes safety indicators before a freelancer applies. The app sorts jobs by safety, highlights verified funded opportunities, warns about risky listings, blocks high-risk job posts that ask for seed phrases or private keys, and lets users report suspicious jobs.

### Work agreement workflow

Work agreements and agreement versions create an auditable collaboration record around jobs, milestones, escrows, and disputes. The app includes a dedicated agreement review route at `/work-agreements/[agreementId]/review`.

### Dispute workflow

Users can open disputes, attach evidence, view timeline events, respond inside the case, and retry on-chain dispute marking when needed. Admins can review the dispute queue, add moderation notes, update case status, and record settlements.

### Reputation workflow

When an escrow is approved and released, the escrow contract calls the reputation contract. The reputation contract stores one completion per escrow and updates freelancer aggregate stats. The app mirrors reputation records in Convex for fast display on profiles and proof pages.

## Smart Contracts

Highrable has two Soroban contracts in `contracts/`.

### Escrow contract

Path: `contracts/escrow`

The escrow contract owns the payment lifecycle.

| Entrypoint | Purpose |
| --- | --- |
| `initialize` | Sets the reputation contract and platform admin. |
| `create_escrow` | Creates an escrow for a known freelancer. |
| `create_open_escrow` | Creates an escrow before freelancer assignment. |
| `create_and_fund_open_escrow` | Creates and funds an open escrow in one flow. |
| `fund_escrow` | Transfers the configured token from the client into the contract. |
| `assign_freelancer` | Assigns a freelancer to an open escrow. |
| `submit_work` | Lets the assigned freelancer submit a proof hash. |
| `approve_and_release` | Pays the freelancer and records reputation. |
| `cancel_escrow` | Cancels created/funded escrows and returns funds when applicable. |
| `mark_disputed` | Moves funded/submitted escrows into disputed state. |
| `resolve_dispute` | Lets the platform admin split disputed funds by basis points. |
| `add_allowed_asset` / `remove_allowed_asset` | Manages the escrow asset allowlist. |

Escrow statuses:

```text
Created -> Funded -> Submitted -> Released
                    -> Disputed -> Released or Cancelled
Created/Funded -> Cancelled
```

### Reputation contract

Path: `contracts/reputation`

The reputation contract stores verified completion records. Only the authorized escrow contract can call `record_completion`.

It tracks:

- Completion records by escrow id.
- Client wallet.
- Freelancer wallet.
- Asset and amount paid.
- Job hash.
- Rating and review hash.
- Completion timestamp.
- Aggregated freelancer stats: completed jobs, total earned, total rating, and average rating.

## Backend Model

Convex lives in `packages/backend/convex` and acts as the operational state layer for fast product reads, collaboration state, moderation state, and transaction tracking.

Implemented tables include:

| Table | Purpose |
| --- | --- |
| `users` | Wallet-linked identity, role, wallet type, profile data. |
| `jobs` | Job postings, budgets, assets, ownership, status. |
| `milestones` | Multi-phase project records and milestone lifecycle. |
| `applications` | Freelancer proposals for jobs and milestones. |
| `escrows` | Off-chain mirror of escrow status, ids, tx hashes, sync state. |
| `transactions` | Pending/success/failed wallet transaction audit trail. |
| `reputationRecords` | App-readable verified completion and review records. |
| `workAgreements` | Agreement lifecycle records for jobs/milestones/escrows. |
| `workAgreementVersions` | Immutable agreement snapshots and hashes. |
| `workAgreementEvents` | Agreement audit events. |
| `workSubmissions` | Deliverable submissions, proof hashes, on-chain metadata. |
| `revisionRequests` | Revision loops attached to active work. |
| `attachments` | Work/evidence files and links with visibility controls. |
| `attachmentAccessLogs` | Attachment access audit trail. |
| `conversations` / `messages` | Chat threads, messages, and system events. |
| `conversationReads` | Read receipts and unread tracking. |
| `deadlineReminders` | Scheduled reminder queue for due work. |
| `notifications` | User-facing notification feed. |
| `deadlineAuditEvents` | Deadline change history. |
| `cancellationRequests` | Cancellation workflow and eligibility snapshots. |
| `cancellationEvents` | Cancellation timeline records. |
| `disputes` | Dispute cases, evidence, status, settlement metadata. |
| `disputeEvents` | Dispute timeline and moderation events. |
| `jobReports` | User reports for scams, spam, off-platform requests, and unsafe listings. |

## Application Routes

| Route | Purpose |
| --- | --- |
| `/` and `/home` | Landing and marketing entry points. |
| `/marketplace` | Browse jobs, search, filter, sort, post jobs, and apply. |
| `/marketplace/jobs/[jobId]` | Job detail, applications, escrow actions, milestones, trust notices. |
| `/post-job` | Focused job posting workflow. |
| `/jobs` | Jobs surface. |
| `/talent` | Talent directory placeholder surface. |
| `/dashboard` | Freelancer/client dashboard, admin auto-routing for admin wallets. |
| `/onboarding` | Wallet-linked onboarding and profile setup. |
| `/freelancers/[walletAddress]` | Public freelancer profile and reputation view. |
| `/clients/[walletAddress]` | Public client trust profile. |
| `/proof/[escrowId]` | Public escrow proof and reputation page. |
| `/disputes` | User dispute list. |
| `/disputes/[disputeId]` | User dispute detail and response workflow. |
| `/work-agreements/[agreementId]/review` | Work agreement review flow. |
| `/admin` | Admin operations dashboard. |
| `/admin/disputes` | Admin dispute queue. |
| `/admin/disputes/[disputeId]` | Admin dispute detail and settlement workflow. |

API routes include Stellar wallet authentication and admin dispute/metrics endpoints under `apps/web/app/api`.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, App Router |
| Styling/UI | Shared `@repo/ui`, Tailwind-style globals, lucide-react, Heroicons, Framer Motion |
| Data/backend | Convex 1.38, typed generated API, shared `@repo/convex-client` |
| Blockchain | Stellar, Soroban, Stellar RPC, Horizon, `@stellar/stellar-sdk` |
| Wallets | Stellar Wallets Kit, wallet auth challenge/verify, passkey smart-account support |
| Smart contracts | Rust, `soroban-sdk`, Stellar CLI |
| Tooling | pnpm workspaces, Turborepo, TypeScript 5.9, oxlint, oxfmt, Husky |

## Repository Structure

```text
Highrable-Stellar/
|-- apps/
|   `-- web/                         # Next.js web app
|       |-- app/                     # App Router routes and API routes
|       |-- core/                    # Config, wallet, Stellar, SEO, providers
|       `-- features/                # Product feature modules
|-- contracts/
|   |-- escrow/                      # Soroban escrow contract
|   `-- reputation/                  # Soroban reputation contract
|-- packages/
|   |-- backend/convex/              # Convex schema, queries, mutations, crons
|   |-- convex-client/               # Shared Convex API exports
|   |-- typescript-config/           # Shared TypeScript config
|   `-- ui/                          # Shared UI components and providers
|-- deployments/                     # Testnet/mainnet deployment artifacts
|-- docs/                            # Product, deployment, and implementation docs
|-- scripts/                         # Contract deploy/verify helpers
|-- turbo.json                       # Turborepo task graph
`-- pnpm-workspace.yaml              # Workspace package layout
```

## Getting Started

### Prerequisites

- Node.js `>=20.9.0`
- pnpm `11.1.2`
- Rust toolchain
- Stellar CLI
- Convex account/project
- A Stellar testnet wallet for end-to-end escrow testing

### Install dependencies

```bash
pnpm install
```

### Configure environment files

```bash
cp apps/web/.env.example apps/web/.env.local
cp packages/backend/.env.example packages/backend/.env.local
```

Fill in the contract ids, Convex URL, wallet/admin settings, and Stellar network settings described below.

### Run development services

Run all workspace development tasks:

```bash
pnpm dev
```

Or run the app and backend separately:

```bash
cd packages/backend
pnpm dev
```

```bash
cd apps/web
pnpm dev
```

The web app runs on `http://localhost:3000` by default.

## Environment Variables

### Web app

Template: `apps/web/.env.example`

Core required variables:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL used by the web app. |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `local`, `testnet`, `mainnet`, or `public`. |
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | Stellar network passphrase. |
| `NEXT_PUBLIC_STELLAR_RPC_URL` | Soroban/Stellar RPC endpoint. |
| `NEXT_PUBLIC_STELLAR_HORIZON_URL` | Horizon endpoint for balances and path payments. |
| `NEXT_PUBLIC_APP_DOMAIN` | App origin used by passkeys and auth flows. |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID` | Deployed escrow contract id. |
| `NEXT_PUBLIC_REPUTATION_CONTRACT_ID` | Deployed reputation contract id. |
| `NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID` | SAC contract id or classic asset issuer for escrow token support. |
| `NEXT_PUBLIC_USDC_ASSET_CODE` / `NEXT_PUBLIC_USDC_ASSET_ISSUER` | Classic USDC-style asset config for top-up flows. |
| `NEXT_PUBLIC_PASSKEY_RP_NAME` | Human-readable passkey relying party name. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project id when WalletConnect is enabled. |

Server-only variables:

| Variable | Purpose |
| --- | --- |
| `WALLET_SESSION_SECRET` | Signs wallet auth sessions in production. |
| `HIGHRABLE_ADMIN_WALLET_ADDRESS` | Stellar public key for the platform admin wallet. |
| `HIGHRABLE_ADMIN_CONVEX_SECRET` | Shared secret for admin API routes calling Convex admin functions. |
| `SMART_ACCOUNT_RELAYER_PRIVATE_KEY` | Private key for a custom self-hosted smart-account relayer. |
| `SMART_ACCOUNT_CHANNELS_API_KEY` | OpenZeppelin Channels key when that relayer mode is used. |
| `SMART_ACCOUNT_ALLOWED_TARGET_CONTRACTS` | Comma-separated contract allowlist for sponsored-fee controls. |

### Convex backend

Template: `packages/backend/.env.example`

| Variable | Purpose |
| --- | --- |
| `STELLAR_NETWORK` | Backend network name. |
| `STELLAR_RPC_URL` | RPC endpoint used for Stellar reads. |
| `STELLAR_HORIZON_URL` | Horizon endpoint used for account/asset reads. |
| `REPUTATION_CONTRACT_ID` | Reputation contract id for sync/read operations. |
| `ESCROW_CONTRACT_ID` | Escrow contract id for sync/read operations. |
| `STELLAR_READ_SOURCE_ACCOUNT` | Funded account used for contract read simulation. |
| `HIGHRABLE_ADMIN_WALLET_ADDRESS` | Admin wallet address. |
| `HIGHRABLE_ADMIN_CONVEX_SECRET` | Admin shared secret. |

## Common Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Run all dev tasks through Turborepo. |
| `pnpm build` | Build all workspace packages/apps. |
| `pnpm lint:fix` | Run oxlint, oxfmt, typegen, and TypeScript checks where configured. |
| `pnpm contracts:build` | Build Soroban contracts with Stellar CLI. |
| `pnpm contracts:deploy:testnet` | Deploy contracts to Stellar testnet. |
| `pnpm contracts:verify:testnet` | Verify the recorded testnet deployment. |
| `pnpm contracts:deploy:mainnet` | Deploy contracts to Stellar mainnet with guarded confirmation. |
| `cd contracts && cargo test` | Run smart contract tests. |
| `cd packages/backend && pnpm dev` | Run Convex development backend. |
| `cd apps/web && pnpm dev` | Run the Next.js web app on port 3000. |

## Deployment

### Testnet contracts

```bash
DEPLOYER=<stellar_identity> \
PLATFORM_ADMIN=<stellar_public_key> \
pnpm contracts:deploy:testnet
```

Verify testnet deployment:

```bash
DEPLOYER=<stellar_identity> pnpm contracts:verify:testnet
```

Testnet artifacts live in `deployments/testnet.json`.

### Mainnet contracts

Mainnet deployment is guarded by an explicit confirmation token:

```bash
MAINNET_DEPLOY_CONFIRM=deploy-highrable-mainnet \
DEPLOYER=<stellar_cli_identity> \
PLATFORM_ADMIN=<G...> \
STELLAR_RPC_URL=<https_mainnet_rpc_url> \
pnpm contracts:deploy:mainnet
```

Before mainnet deployment, review:

- [Mainnet smart-account readiness](docs/mainnet-smart-account-readiness.md)
- [Deployment notes](docs/deployments.md)
- [Stablecoin payments](docs/stablecoin-payments.md)
- [Passkey smart-account implementation](docs/passkey-smart-account-implementation.md)

Current mainnet contract artifact:

| Contract | ID |
| --- | --- |
| Reputation | `CBHF3FE2EVSU6MAPJIR3PQES3QKOUXMWYERNYTC4YOU2E6G3INAE22VQ` |
| Escrow | `CBUFSKNQ7PRNP27KKQ3BDDQHP5HYOU36O73P3JGHWUWOZLD37TFCNALL` |

Artifact file: `deployments/mainnet.json`

## Current Status

Implemented:

- Escrow and reputation Soroban contracts with Rust tests.
- Next.js marketplace, job detail, dashboard, profiles, proof pages, onboarding, disputes, admin, and work agreement routes.
- Convex product model for jobs, applications, milestones, escrows, transactions, reputation records, attachments, chat, deadlines, revisions, cancellations, disputes, reports, and work agreements.
- Stellar wallet auth, Stellar Wallets Kit integration, passkey smart-account support, stablecoin readiness, and top-up flows.
- Admin dispute and metrics APIs.

Partial or planned:

- The talent directory route exists, but the codebase currently treats it as a placeholder surface rather than a complete live directory.
- Deadline reminders are modeled and scheduled, while some chain sync paths are still action-driven instead of fully automated indexer flows.
- Marketing copy may mention broader AI-assisted hiring ideas, but the implemented product workflows are the marketplace, escrow, reputation, wallet, profile, dispute, and admin systems described above.

## Team

| Name | Role |
| --- | --- |
| Bette Anjanelle Cabarles | Frontend Developer |
| Carl Aldrey Bergado | Smart Contract and Fullstack Developer |
| Christelle Anne Dacapias | Social Media Manager |
| Crystalyn Danga | Business Analyst, Researcher, Project Manager |
| Sherwin Limosnero | Public Relations, Pitcher |

## License

MIT
