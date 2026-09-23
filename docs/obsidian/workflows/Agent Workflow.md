---
type: workflow
area: workflow
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Agent Workflow

This is the short path for a future coding agent entering Highrable.

## Before editing

1. Read [[Home]].
2. Read [[Repository Map]] and [[Current System State]].
3. Open the relevant module, architecture, data, contract, frontend, backend, Stellar, or operations note.
4. Inspect the actual source, tests, manifests, and deployment artifacts named by those notes.
5. Check `AGENTS.md` and preserve any existing user changes.

## While editing

- Treat source code, tests, schemas, manifests, and deployment scripts as authoritative over prose.
- Keep wallet identity, transaction actor, fee payer, RPC source, passkey signer, and verifier distinct.
- Preserve state-machine guards and participant/admin authorization at the backend/contract boundary.
- Do not add secrets, seed phrases, private keys, or credential values to source or notes.
- Avoid deploying, sending transactions, or changing external services unless the user explicitly asks and the operation is separately confirmed.

## After editing

- Run focused tests/checks appropriate to the changed layer.
- Update affected vault notes and the knowledge changelog when the repository’s behavior or status changes.
- Validate wiki links and referenced source paths.
- Review for stale implementation claims, contradictions, accidentally exposed values, and untracked files.
- Report what changed, what was verified, and what remains uncertain.

## Documentation status vocabulary

- **Implemented:** code and an identifiable integrated flow exist.
- **Incomplete:** a flow exists but has explicit operational/security/coverage gaps.
- **Experimental:** compatibility-sensitive or not production-hardened.
- **Placeholder:** UI/metadata exists without the full capability.
- **Planned / Not implemented:** source explicitly identifies future work or the capability is absent.

See [[workflows/Feature Development]], [[workflows/Debugging]], and [[Development Guide]].
