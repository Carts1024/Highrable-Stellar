# Highrable Smart Contract Integration

## Freelance Escrow on Stellar

Highrable is a freelance marketplace where payments are handled through Stellar Soroban smart contracts.

Instead of only tracking payments in an application database, Highrable locks client funds in an on-chain escrow contract. When work is approved, the contract releases payment to the freelancer and records reputation through a second contract.

```text
Client posts job
  -> Client funds escrow on Stellar
  -> Freelancer submits work
  -> Client releases payment
  -> Freelancer gets paid
  -> Reputation is recorded on-chain
```

---

## Why Smart Contracts Matter Here

The escrow contract enforces the payment rules.

- Funds are held by the contract, not silently by the platform.
- Only valid actions can move the escrow forward.
- The right wallet must approve each important step.
- Payment release and reputation are connected.

The result is a marketplace flow where trust is supported by code running on Stellar.

---

## The Two Contracts

Highrable uses two Soroban contracts.

| Contract | Purpose |
| --- | --- |
| Escrow contract | Handles job payment, funding, release, cancellation, and disputes |
| Reputation contract | Records completed paid work and freelancer stats |

The key idea:

```text
Payment release creates reputation.
Reputation is not just a frontend review form.
```

---

## Escrow Lifecycle

The main escrow path is:

```text
Created -> Funded -> Submitted -> Released
```

Other possible paths:

```text
Created -> Cancelled
Funded -> Cancelled
Funded or Submitted -> Disputed
Disputed -> Released or Cancelled after admin resolution
```

---

## Escrow Contract Actions

| Action | What it means |
| --- | --- |
| Create escrow | A client creates a paid job agreement |
| Fund escrow | Client deposits tokens into the contract |
| Submit work | Freelancer marks the work as submitted |
| Approve and release | Client approves the work and payment is released |
| Cancel escrow | Escrow is cancelled when allowed |
| Mark disputed | Escrow enters dispute state |
| Resolve dispute | Admin resolves a disputed escrow |

---

## Important Contract Rules

- The client signs client actions.
- The freelancer signs work submission.
- The client and freelancer cannot be the same wallet.
- The escrow amount must be positive.
- The escrow can only move through valid statuses.
- Payment uses the token contract stored in the escrow.

These rules are enforced by the smart contract, not just the user interface.

---

## Reputation Contract

The reputation contract records completed paid work.

It stores:

- Completed escrow reference
- Freelancer address
- Client address
- Payment amount
- Rating
- Review or proof hash

Only the escrow contract can record a completion.

That prevents users from creating fake reputation directly.

---

## Frontend Integration Overview

The Highrable frontend is responsible for building and submitting contract transactions.

```text
UI button
  -> escrow action hook
  -> escrow contract wrapper
  -> transaction helper
  -> wallet signs
  -> Stellar RPC submits
  -> Backend syncs app state
```

---

## What the Frontend Needs

Before calling a smart contract, the frontend needs:

- Stellar network
- RPC URL
- Escrow contract ID
- Reputation contract ID
- Token contract ID
- Connected wallet address

These values tell the app which network and contracts to use.

---

## From User Action to Contract Call

When a user clicks an escrow action, the app does several steps.

```text
1. Read the connected wallet.
2. Convert frontend values into Soroban values.
3. Build a Stellar transaction.
4. Ask the wallet to sign the transaction.
5. Submit the signed transaction to Stellar RPC.
6. Wait for confirmation.
7. Sync the result back into the app database.
```

---

## Type Conversion

Soroban contracts expect specific value types.

| Frontend value | Soroban value |
| --- | --- |
| Wallet address | Address value |
| Escrow ID | `u64` |
| Rating | `u32` |
| Token amount | `i128` |
| Job, proof, or review hash | `BytesN<32>` |

The frontend wrapper translates normal TypeScript values into the exact format the contract expects.

---

## Transaction Flow

The transaction helper handles the repeated Stellar work.

```text
Connect to Stellar RPC
  -> Load source account
  -> Create contract call
  -> Build transaction
  -> Prepare transaction
  -> Request wallet signature
  -> Submit signed transaction
  -> Poll for result
```

The frontend does not directly change contract storage. It submits a signed transaction, and Stellar executes the contract.

---

## Wallet Signing

Highrable uses Stellar Wallets Kit for wallet connection and transaction signing.

The wallet does two important jobs:

- Proves which user is taking the action.
- Signs the transaction before it is sent to Stellar.

```text
The frontend builds the transaction.
The wallet signs it.
Stellar RPC submits it to the network.
```

---

## Example: Funding an Escrow

User action:

```text
Fund escrow
```

Frontend flow:

```text
Escrow action panel
  -> fund escrow function
  -> transaction helper
  -> wallet signature
  -> Stellar RPC
  -> Backend status update
```

On-chain result:

```text
Client token balance decreases
Escrow contract token balance increases
Escrow status changes from Created to Funded
```

---

## Example: Releasing Payment

User action:

```text
Release payment
```

The escrow contract does two things:

```text
1. Transfers escrowed tokens to the freelancer.
2. Calls the reputation contract to record completion.
```

This connects a freelancer review to a real paid escrow.

---

## Why the Backend Is Still Used

The blockchain is the source of truth for:

- Escrow status
- Token custody
- Released payments
- Completion records

The backend is used for fast product screens:

- Marketplace lists
- Job details
- Dashboards
- Profiles
- Proof pages
- Transaction history

---

## Chain Truth and App Speed

After a transaction succeeds, Highrable stores useful app data in the backend.

```text
Transaction hash
Escrow status
Job status
Sync timestamp
Reputation mirror
```

```text
Contracts hold the truth.
The backend makes the product fast and easy to query.
```

---

## Key Terms

| Term | Meaning |
| --- | --- |
| Smart contract | Code deployed on Stellar that enforces escrow and reputation rules |
| Contract ID | The on-chain address of a deployed Soroban contract |
| RPC | API used to prepare, submit, and confirm Stellar transactions |
| XDR | Encoded Stellar transaction data that the wallet signs |
| Stellar Wallets Kit | Library for wallet connection and signing |
| ScVal | Soroban value format used for contract arguments |
| Backend mirror | Fast app database copy of important on-chain state |

---

## Common Questions

### Does the frontend directly change contract storage?

No. The frontend builds and submits a signed Stellar transaction. The contract changes storage only when Stellar executes that transaction.

### Why does the wallet need to sign?

The wallet proves that the client or freelancer approved the action.

### Why not let the backend sign everything?

Escrow actions should be authorized by the user wallet that owns the funds or role.

---

## Main Integration Pattern

```text
UI
  -> action hook
  -> contract wrapper
  -> transaction helper
  -> wallet signature
  -> Stellar RPC
  -> Backend sync
```

This pattern keeps the user interface simple while still connecting it to real on-chain escrow behavior.

---

## Strongest Demo Flow

```text
Create escrow
  -> Fund escrow
  -> Submit work
  -> Release payment
  -> Show reputation or proof update
```

This demo shows the full value of Highrable:

- Escrowed payment
- Wallet authorization
- Smart contract enforcement
- On-chain reputation
- Fast app state through the backend
