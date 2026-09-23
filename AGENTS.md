# Highrable Agent Guidance

Highrable is a Stellar-native freelance marketplace. Preserve the existing repository instructions in `GEMINI.md`; this file adds the navigation workflow for coding agents.

## Highrable Knowledge Vault

The repository contains a source-grounded Obsidian knowledge vault at `docs/obsidian/`.

For non-trivial tasks:

1. Read `docs/obsidian/Home.md`.
2. Read `docs/obsidian/Repository Map.md`.
3. Read the notes relevant to the requested domain.
4. Use those notes to identify likely source files.
5. Inspect only relevant source files first.

Do not recursively scan the entire repository by default. Expand exploration only when the relevant notes or implementation require it.

After meaningful changes, update affected vault notes when architecture, data flow, routes, schemas, contracts, Stellar behavior, authentication, environment configuration, commands, or important implementation behavior changes. Do not update every note after every code change.

Source code, tests, deployment artifacts, and current configuration are authoritative. If vault documentation conflicts with implementation, verify the implementation and correct the vault. Never copy secrets, private keys, seed phrases, tokens, or sensitive environment values into the vault.
