import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getChangedFormatFiles } from "./check-changed-format.mjs";

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function createRepo() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "highrable-format-check-"));
  git(cwd, "init", "--quiet");
  git(cwd, "config", "user.name", "CI Test");
  git(cwd, "config", "user.email", "ci@example.invalid");
  return cwd;
}

function commit(cwd, message) {
  git(cwd, "add", "--all");
  git(cwd, "commit", "--quiet", "-m", message);
  return git(cwd, "rev-parse", "HEAD");
}

test("includes added and modified supported files with spaces in their names", () => {
  const cwd = createRepo();
  try {
    writeFileSync(path.join(cwd, "existing.tsx"), "export const value = 1;\n");
    const base = commit(cwd, "base");
    writeFileSync(path.join(cwd, "existing.tsx"), "export const value = 2;\n");
    writeFileSync(path.join(cwd, "new page.tsx"), "export const page = true;\n");
    const head = commit(cwd, "web changes");

    assert.deepEqual(
      getChangedFormatFiles({ base, head, cwd }).sort(),
      ["./existing.tsx", "./new page.tsx"].sort(),
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("checks a renamed destination and excludes the deleted source", () => {
  const cwd = createRepo();
  try {
    writeFileSync(path.join(cwd, "old name.ts"), "export const stable = true;\n");
    const base = commit(cwd, "base");
    const renamedPath = path.join(cwd, "new name.ts");
    mkdirSync(path.dirname(renamedPath), { recursive: true });
    writeFileSync(renamedPath, readFileSync(path.join(cwd, "old name.ts")));
    rmSync(path.join(cwd, "old name.ts"));
    const head = commit(cwd, "rename");

    assert.deepEqual(getChangedFormatFiles({ base, head, cwd }), ["./new name.ts"]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("ignores deletions and unsupported files and accepts empty change sets", () => {
  const cwd = createRepo();
  try {
    writeFileSync(path.join(cwd, "removed.ts"), "export const removed = true;\n");
    writeFileSync(path.join(cwd, "contract.rs"), "pub fn contract() {}\n");
    const base = commit(cwd, "base");
    rmSync(path.join(cwd, "removed.ts"));
    writeFileSync(path.join(cwd, "contract.rs"), "pub fn contract() { /* changed */ }\n");
    const head = commit(cwd, "non-format files");

    assert.deepEqual(getChangedFormatFiles({ base, head, cwd }), []);
    assert.deepEqual(getChangedFormatFiles({ base: head, head, cwd }), []);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
