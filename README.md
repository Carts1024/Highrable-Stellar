# Highrable

## Project Description

Highrable is a next-generation freelance marketplace operating at the intersection of Agentic AI and Web3, built natively on the Stellar blockchain. Moving beyond the outdated high-commission models of Web2 platforms (like Upwork and Fiverr), Highrable provides a trustless, zero-border ecosystem. It leverages Stellar's fast, low-cost smart contract escrow for guaranteed payments, stablecoins for instant cross-border settlement, and AI-driven matching and interviewing to drastically reduce time-to-hire.

## What the Project Solves

### 1. Trust and Payment Integrity

Clients and freelancers struggle with trust due to risks of non-payment, fake accounts, fake reviews, missed deadlines, and scope changes. Highrable addresses this through:

- **Smart Contract Escrow** — Client funds are locked in a smart contract before work begins and automatically released after milestone approval, eliminating payment risk.
- **On-Chain Reviews & Ratings** — Reviews are tied to verified transactions and stored on the blockchain, making them tamper-proof and credible.

### 2. Inefficient and Costly Payment Systems

High platform commissions and unclear fee structures disproportionately lower freelancers' take-home pay. Highrable addresses this by:

- Charging a flat **5% escrow fee** — significantly undercutting the 10–20% industry standard.
- Ensuring freelancers keep **100% of their negotiated rate**.
- Using **stablecoin wallet payments** for fast, low-cost, cross-border transactions.

### 3. Payment Speed and Access

Cross-border payments are slow, expensive, and often inaccessible to workers in developing markets. Highrable enables:

- Near-instant stablecoin settlements with near-zero transaction fees on Stellar.
- Local fiat off-ramps to Philippine digital wallets (GCash, Maya, Coins.ph).
- Reduced dependence on traditional banking systems.

### 4. Geographic Bias and Global Access

Freelancers in developing markets are consistently underpaid and sidelined from global opportunities. Highrable levels the playing field by:

- Enabling borderless participation regardless of geographic location.
- Eliminating FX conversion fees and currency incompatibility barriers.
- Providing equal access to international clients for Filipino and Southeast Asian freelancers.

### 5. Hiring Flexibility and Quality Assurance

Clients struggle to find reliable freelancers efficiently. Highrable tackles this with:

- **AI Matching + AI Interview** — AI recommends the best candidates and conducts automated skill-based assessments, reducing average time-to-hire by up to 40%.
- **Milestone-based smart contract releases** — Enforces delivery accountability with no manual dispute bottlenecks.
- **Portable On-Chain Reputation** — Work history and ratings are owned by the freelancer, not locked to a single platform.

## Smart Contract Deployment (Testnet)

- Deploy contracts and generate `deployments/testnet.json`:
  - `DEPLOYER=<stellar_identity> PLATFORM_ADMIN=<stellar_public_key> pnpm contracts:deploy:testnet`
- Verify an existing deployment:
  - `DEPLOYER=<stellar_identity> pnpm contracts:verify:testnet`
- Full guide: `docs/deployment.md`
