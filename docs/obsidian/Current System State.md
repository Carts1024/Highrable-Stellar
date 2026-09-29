---
type: reference
area: system
status: current
last_updated: 2026-09-29
source_of_truth: repository
---

# Current System State

This classification is based on current source, tests, manifests, deployment artifacts, and the existing implementation inventory. “Implemented” means code and an identifiable flow exist; it does not mean audited, fully automated, or production-ready.

## Functional / Implemented

- Soroban escrow creation, open escrow creation, create-and-fund open escrow, funding, assignment, submission, approval/release, cancellation, dispute marking, owner-only settlement for existing deployments, membership-enabled admin dispute settlement in current source, asset allowlisting, and read/configuration methods exist in `contracts/escrow/src/lib.rs`.
- Soroban reputation initialization, authorized completion recording, immutable completion lookup, existence checks, and freelancer aggregate statistics exist in `contracts/reputation/src/lib.rs`.
- The release path transfers the escrow asset to the freelancer and invokes reputation `record_completion`.
- Convex has a composed schema for users, jobs, milestones, applications, escrows, agreements, submissions, attachments, collaboration, deadlines, revisions, cancellations, disputes, reputation mirrors, transactions, reports, and waitlist entries.
- Convex dispute creation preserves C05 parent/participant authorization and now validates all related submissions, revisions, messages, deadline events, and evidence before writes; opening is canonical, deduplicated, atomic, and audited with one `dispute_opened` event while agreement context and notification/system-message side effects remain intact.
- The web app has marketplace, job, dashboard, onboarding, profile, proof, dispute, work-agreement review, admin, and wallet/passkey routes. `/talent` is intentionally not in this category; see below.
- External-wallet challenge/verify authentication creates signed HTTP-only session cookies. Admin APIs derive the actor from the verified wallet; Convex separately checks the server-only secret, owner/dispute-admin capability, scope, assignment, and participant conflicts.
- Owner-managed dispute-admin membership, assignment history, claim workflow, and signed settlement recovery are implemented in source. Platform metrics and team/assignment management remain owner-only; app dispute work is assignment-scoped.
- External-wallet and passkey smart-account execution both route through shared escrow helpers and a wallet-specific transaction executor.
- Deadline reminder scanning is scheduled by Convex every 15 minutes.

## Implemented but Operationally Incomplete

- Convex escrow and reputation synchronization exists, but it is action-driven (`syncEscrowStatus`, `syncReputationRecord`) and manually triggered from product flows. It is not a general chain indexer or fully scheduled mirror.
- `transactions` stores application transaction records, but historical wallet transaction indexing is explicitly post-MVP and absent from the repository.
- Passkey smart-account execution includes compatibility fallbacks and runtime WASM/signer checks. The current implementation is sensitive to the configured smart-account artifact and `smart-account-kit` behavior.
- XLM-to-USDC path-payment top-up exists for classic external wallets, but requires a USDC trustline, sufficient spendable XLM, and available path liquidity. XLM escrow is optional and requires a configured native XLM token contract.
- Mainnet readiness checks are extensive, but they do not constitute contract, relayer, backend, monitoring, or operational audits.
- The membership-enabled escrow source and frontend/backend workflow have not been deployed. Existing deployments retain owner-only settlement and do not enforce the new participant-conflict rule. Activation requires a fresh isolated contract/deployment database; existing ID lookup/synchronization is unsafe across overlapping escrow-ID spaces.
- Proof and agreement records carry hashes and protection metadata, but source-file and attachment content checksum TODOs remain in backend/client paths.

## Experimental or Compatibility-Sensitive

- Passkey smart accounts are Soroban contract accounts (`C...`), not ordinary classic wallets. Execution depends on `smart-account-kit@0.2.10`, `smart-account-kit-bindings@0.1.2`, WebAuthn context rules, a compatible account WASM hash, and a fee path.
- The passkey executor contains compatibility logic for legacy context-rule shapes and custom AuthPayload signing. Treat changes in this area as protocol-sensitive.
- Smart-account relayer support recognizes `none`, `custom`, `openzeppelin_channels`, and `sdk_source_account`; legacy Launchtube is explicitly unsupported.

## Placeholder

- `/talent` renders a planned discovery surface with preview cards and explicitly says live talent search is not available.
- `deployments/smart-accounts/testnet.json` and `deployments/smart-accounts/mainnet.json` contain placeholder metadata with empty artifact, verifier, factory, relayer, and verification fields.
- A dedicated historical chain transaction indexer and contract-event-driven indexing layer do not exist.

## Planned / Not Implemented

- Historical wallet transaction synchronization/indexing (`syncWalletTransactions` is marked post-MVP).
- Soroban event emission in the current escrow and reputation contracts.
- Strong signed-session enforcement across every public Convex mutation.
- Complete file-content hashing for agreement source uploads and work-submission attachments.
- A production-hardened, audited relayer and broader production operations around passkey fee sponsorship.
- A live talent directory/search experience.

## Known Technical Debt

- Several public Convex mutations explicitly document that they still trust a caller-supplied wallet address and should move to signed-session/auth enforcement.
- Dispute C09 validates caller-supplied wallet values against Convex participant records but does not prove wallet possession; signed-session enforcement remains future work.
- Source and docs disagree on runtime/tooling prerequisites: root `package.json` declares Node `>=20.9.0` and pnpm `12.5.1`, while `GEMINI.md` says Node 18+/pnpm 8.6+ and `README.md` says pnpm 11.1.2. Use the root manifest.
- The older implementation inventory does not list `resolve_dispute`, although the current escrow contract implements and tests it. This vault follows the Rust source.
- `docs/deployments.md` links to missing `docs/passkey-smart-accounts.md`; the existing `docs/passkey-smart-account-implementation.md` is the useful guide.
- Existing phase/roadmap documents can describe completed work as future work. Verify before using them as requirements.
