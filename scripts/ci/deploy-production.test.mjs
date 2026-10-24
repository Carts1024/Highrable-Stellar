import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertMainReleaseRef,
  parseVercelDeploymentUrl,
  ReleaseGuardError,
  runProductionRelease,
  validatePulledVercelConfiguration,
  validateReleaseConfiguration,
} from "./deploy-production.mjs";

const sourceSha = "a".repeat(40);
const deployKey = "prod:steady-lemur-456|synthetic-test-key";
const expectedUrl = "https://steady-lemur-456.convex.cloud";

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function makeTestRepo() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "highrable-release-test-"));
  git(cwd, "init", "--quiet");
  git(cwd, "config", "user.name", "CI Test");
  git(cwd, "config", "user.email", "ci@example.invalid");
  writeFileSync(path.join(cwd, "README.md"), "release test fixture\n");
  git(cwd, "add", "README.md");
  git(cwd, "commit", "--quiet", "-m", "release fixture");
  return cwd;
}

function validEnvironment(cwd, extra = {}) {
  const output = path.join(cwd, "github-output.txt");
  appendFileSync(output, "");
  return {
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: git(cwd, "rev-parse", "HEAD"),
    RELEASE_CI_RESULT: "success",
    VERCEL_TOKEN: "synthetic-vercel-token",
    VERCEL_ORG_ID: "team_synthetic",
    VERCEL_PROJECT_ID: "prj_synthetic",
    CONVEX_DEPLOY_KEY: deployKey,
    EXPECTED_CONVEX_URL: expectedUrl,
    VERCEL_PROJECT_DIR: path.join(cwd, "apps/web"),
    GITHUB_OUTPUT: output,
    ...extra,
  };
}

function pulledEnv(network = "testnet", convexUrl = expectedUrl) {
  return `NEXT_PUBLIC_STELLAR_NETWORK="${network}"\nNEXT_PUBLIC_CONVEX_URL="${convexUrl}"\n`;
}

function installCliStubs(cwd) {
  const bin = path.join(cwd, "bin");
  const project = path.join(cwd, "apps/web/.vercel");
  mkdirSync(bin, { recursive: true });
  mkdirSync(project, { recursive: true });
  const log = path.join(cwd, "cli-log.txt");
  const vercel = path.join(bin, "vercel");
  const pnpm = path.join(bin, "pnpm");

  writeFileSync(
    vercel,
    `#!/usr/bin/env node\nconst fs=require('node:fs');\nconst path=require('node:path');\nconst args=process.argv.slice(2);\nfs.appendFileSync(${JSON.stringify(log)}, 'vercel:'+args[0]+'\\n');\nif(args[0]==='pull'){fs.writeFileSync(path.join(process.env.VERCEL_PROJECT_DIR,'.vercel','.env.production.local'), process.env.STUB_PULLED_ENV);process.exit(0)}\nif(args[0]==='deploy'){if(Number(process.env.STUB_PUBLISH_EXIT))process.exit(Number(process.env.STUB_PUBLISH_EXIT));process.stdout.write('https://highrable-release-test.vercel.app\\n');process.exit(0)}\nif(args[0]==='build'){if(Number(process.env.STUB_BUILD_EXIT))process.exit(Number(process.env.STUB_BUILD_EXIT));process.exit(0)}\nprocess.exit(2);\n`,
  );
  writeFileSync(
    pnpm,
    `#!/usr/bin/env node\nconst fs=require('node:fs');\nconst args=process.argv.slice(2);\nfs.appendFileSync(${JSON.stringify(log)}, 'pnpm:'+args.join(' ')+'\\n');\nconst command=args[args.indexOf('--cmd')+1];\nif(!command||!command.includes('vercel build --prod --yes --cwd apps/web')||!command.includes('$VERCEL_TOKEN'))process.exit(2);\nfs.appendFileSync(${JSON.stringify(log)}, 'build:vercel\\n');\nif(Number(process.env.STUB_BUILD_EXIT))process.exit(Number(process.env.STUB_BUILD_EXIT));\nif(Number(process.env.STUB_CONVEX_EXIT))process.exit(Number(process.env.STUB_CONVEX_EXIT));\nprocess.exit(0);\n`,
  );
  chmodSync(vercel, 0o755);
  chmodSync(pnpm, 0o755);
  return { bin, log, project };
}

function stubExecutor(bin, overrides = {}) {
  return async (command, args, options) => {
    const executable = command === "pnpm" ? path.join(bin, "pnpm") : path.join(bin, "vercel");
    const result = spawnSync(executable, args, {
      cwd: options.cwd,
      env: options.env,
      encoding: "utf8",
    });
    assert.equal(result.error, undefined);
    if (result.status !== 0) {
      throw new Error(`${command} failed in its test stub.`);
    }
    return { stdout: result.stdout };
  };
}

test("main release guard rejects another branch or a changed source commit", () => {
  assert.throws(
    () => assertMainReleaseRef({ ref: "refs/heads/feature", sourceSha, headSha: sourceSha }),
    ReleaseGuardError,
  );
  assert.throws(
    () => assertMainReleaseRef({ ref: "refs/heads/main", sourceSha, headSha: "b".repeat(40) }),
    ReleaseGuardError,
  );
});

test("release guard rejects failed CI, missing configuration, and mismatched deploy key", () => {
  const base = {
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: sourceSha,
    RELEASE_CI_RESULT: "success",
    VERCEL_TOKEN: "token",
    VERCEL_ORG_ID: "team",
    VERCEL_PROJECT_ID: "project",
    CONVEX_DEPLOY_KEY: deployKey,
    EXPECTED_CONVEX_URL: expectedUrl,
  };
  assert.throws(
    () => validateReleaseConfiguration({ ...base, RELEASE_CI_RESULT: "failure" }),
    /CI workflow/,
  );
  assert.throws(() => validateReleaseConfiguration({ ...base, VERCEL_TOKEN: "" }), /VERCEL_TOKEN/);
  assert.throws(
    () =>
      validateReleaseConfiguration({
        ...base,
        CONVEX_DEPLOY_KEY: "prod:another-deployment|synthetic-test-key",
      }),
    /does not target/,
  );
});

test("pulled Vercel settings must use Testnet and the expected Convex URL", () => {
  assert.doesNotThrow(() => validatePulledVercelConfiguration(pulledEnv(), expectedUrl));
  assert.throws(
    () => validatePulledVercelConfiguration(pulledEnv("mainnet"), expectedUrl),
    /Stellar Testnet/,
  );
  assert.throws(
    () =>
      validatePulledVercelConfiguration(
        pulledEnv("testnet", "https://other.convex.cloud"),
        expectedUrl,
      ),
    /does not match/,
  );
});

test("deployment URL parser selects the production URL from Vercel CLI output", () => {
  assert.equal(
    parseVercelDeploymentUrl(
      "Inspect: https://highrable-git-main.vercel.app\nProduction: https://highrable.vercel.app [copied to clipboard]\n",
    ),
    "https://highrable.vercel.app",
  );
  assert.throws(() => parseVercelDeploymentUrl("Deployment failed"), /valid deployment URL/);
});

test("release deploys Convex and builds before prebuilt Vercel publication", async () => {
  const cwd = makeTestRepo();
  try {
    const stubs = installCliStubs(cwd);
    const env = validEnvironment(cwd, {
      PATH: `${stubs.bin}:${process.env.PATH}`,
      STUB_PULLED_ENV: pulledEnv(),
    });
    await runProductionRelease({ cwd, env, execute: stubExecutor(stubs.bin) });

    const calls = readFileSync(stubs.log, "utf8").trim().split("\n");
    assert.equal(calls[0], "vercel:pull");
    assert.match(calls[1], /^pnpm:.* convex deploy /u);
    assert.equal(calls[2], "build:vercel");
    assert.equal(calls[3], "vercel:deploy");
    assert.equal(existsSync(path.join(stubs.project, ".env.production.local")), false);
    assert.match(readFileSync(env.GITHUB_OUTPUT, "utf8"), /convex_result=success/u);
    assert.match(readFileSync(env.GITHUB_OUTPUT, "utf8"), /vercel_result=success/u);
    assert.match(
      readFileSync(env.GITHUB_OUTPUT, "utf8"),
      /deployment_url=https:\/\/highrable-release-test\.vercel\.app/u,
    );
    assert.doesNotMatch(calls.join("\n"), /synthetic-vercel-token/u);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("Testnet or target mismatch stops before Convex deployment", async () => {
  for (const contents of [
    pulledEnv("mainnet"),
    pulledEnv("testnet", "https://wrong.convex.cloud"),
  ]) {
    const cwd = makeTestRepo();
    try {
      const stubs = installCliStubs(cwd);
      const env = validEnvironment(cwd, {
        PATH: `${stubs.bin}:${process.env.PATH}`,
        STUB_PULLED_ENV: contents,
      });
      await assert.rejects(runProductionRelease({ cwd, env, execute: stubExecutor(stubs.bin) }));
      assert.deepEqual(readFileSync(stubs.log, "utf8").trim().split("\n"), ["vercel:pull"]);
      assert.equal(existsSync(path.join(stubs.project, ".env.production.local")), false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }
});

test("build and Convex failures block Vercel publication", async () => {
  for (const failure of [{ STUB_BUILD_EXIT: "1" }, { STUB_CONVEX_EXIT: "1" }]) {
    const cwd = makeTestRepo();
    try {
      const stubs = installCliStubs(cwd);
      const env = validEnvironment(cwd, {
        PATH: `${stubs.bin}:${process.env.PATH}`,
        STUB_PULLED_ENV: pulledEnv(),
        ...failure,
      });
      await assert.rejects(runProductionRelease({ cwd, env, execute: stubExecutor(stubs.bin) }));
      const calls = readFileSync(stubs.log, "utf8");
      assert.match(calls, /build:vercel/u);
      assert.doesNotMatch(calls, /vercel:deploy/u);
      assert.match(readFileSync(env.GITHUB_OUTPUT, "utf8"), /vercel_result=not_started/u);
      assert.equal(existsSync(path.join(stubs.project, ".env.production.local")), false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }
});

test("Vercel publication failure records that Convex is already deployed", async () => {
  const cwd = makeTestRepo();
  try {
    const stubs = installCliStubs(cwd);
    const env = validEnvironment(cwd, {
      PATH: `${stubs.bin}:${process.env.PATH}`,
      STUB_PULLED_ENV: pulledEnv(),
      STUB_PUBLISH_EXIT: "1",
    });
    await assert.rejects(runProductionRelease({ cwd, env, execute: stubExecutor(stubs.bin) }));
    assert.match(readFileSync(env.GITHUB_OUTPUT, "utf8"), /convex_result=success/u);
    assert.match(readFileSync(env.GITHUB_OUTPUT, "utf8"), /vercel_result=failure/u);
    assert.match(readFileSync(stubs.log, "utf8"), /vercel:deploy/u);
    assert.equal(existsSync(path.join(stubs.project, ".env.production.local")), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
