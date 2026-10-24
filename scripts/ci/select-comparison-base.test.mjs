import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { selectComparisonBase } from "./select-comparison-base.mjs";

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function createRepo() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "highrable-comparison-base-"));
  git(cwd, "init", "--quiet");
  git(cwd, "config", "user.name", "CI Test");
  git(cwd, "config", "user.email", "ci@example.invalid");
  return cwd;
}

function commit(cwd, name, contents) {
  writeFileSync(path.join(cwd, name), contents);
  git(cwd, "add", "--all");
  git(cwd, "commit", "--quiet", "-m", name);
  return git(cwd, "rev-parse", "HEAD");
}

test("pull requests compare against the merge base with the target branch", () => {
  const cwd = createRepo();
  try {
    const mergeBase = commit(cwd, "base.ts", "export const base = true;\n");
    git(cwd, "checkout", "--quiet", "-b", "target");
    const targetTip = commit(cwd, "target.ts", "export const target = true;\n");
    git(cwd, "checkout", "--quiet", "-b", "feature", mergeBase);
    const head = commit(cwd, "feature.ts", "export const feature = true;\n");

    assert.equal(
      selectComparisonBase({
        eventName: "pull_request",
        headSha: head,
        prBaseSha: targetTip,
        cwd,
      }),
      mergeBase,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("pushes compare against the previous commit and first pushes use the empty tree", () => {
  const cwd = createRepo();
  try {
    const previous = commit(cwd, "first.ts", "export const first = true;\n");
    const head = commit(cwd, "second.ts", "export const second = true;\n");
    assert.equal(
      selectComparisonBase({ eventName: "push", headSha: head, pushBeforeSha: previous, cwd }),
      previous,
    );

    const firstPushBase = selectComparisonBase({
      eventName: "push",
      headSha: head,
      pushBeforeSha: "0".repeat(40),
      cwd,
    });
    assert.equal(git(cwd, "cat-file", "-t", firstPushBase), "tree");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("reusable CI compares against an explicit base or the selected commit parent", () => {
  const cwd = createRepo();
  try {
    const parent = commit(cwd, "parent.ts", "export const parent = true;\n");
    const head = commit(cwd, "head.ts", "export const head = true;\n");
    assert.equal(
      selectComparisonBase({ eventName: "workflow_dispatch", sourceSha: head, headSha: head, cwd }),
      parent,
    );
    assert.equal(
      selectComparisonBase({
        eventName: "workflow_dispatch",
        sourceSha: head,
        inputBaseSha: parent,
        headSha: head,
        cwd,
      }),
      parent,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
