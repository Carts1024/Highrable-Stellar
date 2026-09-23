---
type: reference
area: navigation
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Highrable Knowledge Vault

Highrable is a Stellar-native freelance marketplace. Next.js and React provide the wallet-first product UI; Convex stores real-time product state and workflow history; Soroban contracts own escrow funds and immutable completion reputation. The browser can call Stellar directly, so the chain path and the Convex mirror must be understood together.

This vault is a navigation and context index for humans and coding agents. It reduces repeated repository-wide exploration; it does not replace source code, tests, generated APIs, or deployment artifacts.

## Start Here

- [[Repository Map]]
- [[Current System State]]
- [[Development Guide]]
- [[Glossary]]
- [[workflows/Agent Workflow]]

## Architecture

- [[architecture/Architecture Overview]]
- [[architecture/Frontend Architecture]]
- [[architecture/Convex Backend Architecture]]
- [[architecture/Stellar and Wallet Architecture]]
- [[architecture/Soroban Contract Architecture]]
- [[architecture/Data Flow]]
- [[architecture/Authentication Boundaries]]
- [[architecture/Integration Boundaries]]

## Highrable Domains

- [[modules/Marketplace and Jobs]]
- [[modules/Applications and Milestones]]
- [[modules/Escrow and Payments]]
- [[modules/Work Agreements]]
- [[modules/Work Submissions and Proof]]
- [[modules/Disputes and Cancellations]]
- [[modules/Profiles and Reputation]]
- [[modules/Collaboration]]
- [[modules/Deadlines and Notifications]]
- [[modules/Wallets and Passkeys]]
- [[modules/Admin Operations]]
- [[modules/Sync and Transactions]]

## Data and Contracts

- [[data/Convex Schema]]
- [[data/Domain Data Model]]
- [[data/State Machines]]
- [[contracts/Contracts Overview]]
- [[contracts/Escrow Contract]]
- [[contracts/Reputation Contract]]
- [[contracts/Deployment Artifacts]]

## Frontend and Backend

- [[frontend/Frontend Overview]]
- [[frontend/Routes and API]]
- [[frontend/Feature Slices]]
- [[frontend/Wallet and Stellar Client Layer]]
- [[backend/Convex Overview]]
- [[backend/Domain Functions]]
- [[backend/Sync and Scheduled Jobs]]
- [[backend/Admin and Server Routes]]

## Stellar Operations

- [[stellar/Stellar Integration]]
- [[stellar/Wallet Identity Model]]
- [[stellar/Transaction Lifecycle]]
- [[stellar/Payment Assets and Path Payments]]
- [[stellar/Smart Accounts and Passkeys]]
- [[stellar/Network Configuration]]
- [[stellar/Mainnet Readiness and Relayers]]

## Development and Operations

- [[operations/Environment Variables]]
- [[operations/Local Development]]
- [[operations/Testing]]
- [[operations/Deployment]]
- [[operations/Security and Secrets]]

## Existing Documentation

These documents remain useful but may be older than the implementation. Read source files when a detail matters.

- [Implementation inventory](../highrable-implementation-inventory.md)
- [Deployment notes](../deployments.md)
- [Stablecoin payments](../stablecoin-payments.md)
- [Passkey overview](../passkey.md)
- [Passkey smart-account implementation](../passkey-smart-account-implementation.md)
- [Passkey escrow debug progress](../passkey-escrow-debug-progress.md)
- [Mainnet smart-account readiness](../mainnet-smart-account-readiness.md)
- [Keyless README](../README-keyless.md)
- [Project plan](../PLAN.md)
- [Audience presentation](../HIGHRABLE_AUDIENCE_PRESENTATION.md)
- [Discussion guide](../HIGHRABLE_30_MIN_DISCUSSION_GUIDE.md)

`docs/deployments.md` contains a stale reference to `docs/passkey-smart-accounts.md`; that filename is absent. The vault links to the existing implementation guide instead.

## Agent Rule

Read this page, then the repository map and the relevant domain notes before broad exploration. After a meaningful implementation change, update only the affected notes and add a concise entry to [[changelog/Knowledge Changelog]] when the architectural or operational knowledge changed.
