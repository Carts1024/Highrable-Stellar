import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function runGit(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed.`);
  }
  return result.stdout.trim();
}

function parentOrEmptyTree(headSha, cwd) {
  const parent = spawnSync("git", ["rev-parse", `${headSha}^`], { cwd, encoding: "utf8" });
  if (parent.status === 0) {
    return parent.stdout.trim();
  }
  return runGit(["hash-object", "-t", "tree", "/dev/null"], cwd);
}

export function selectComparisonBase({
  eventName,
  headSha,
  sourceSha = "",
  inputBaseSha = "",
  prBaseSha = "",
  pushBeforeSha = "",
  cwd = process.cwd(),
}) {
  if (!headSha) {
    throw new Error("HEAD_SHA is required.");
  }
  const actualHead = runGit(["rev-parse", "HEAD"], cwd);
  if (actualHead !== headSha) {
    throw new Error("Checked out commit does not match the requested immutable source SHA.");
  }

  if (sourceSha) {
    return inputBaseSha || parentOrEmptyTree(headSha, cwd);
  }

  if (eventName === "pull_request") {
    if (!prBaseSha) {
      throw new Error("PR_BASE_SHA is required for pull request formatting checks.");
    }
    return runGit(["merge-base", prBaseSha, headSha], cwd);
  }
  if (eventName === "push") {
    if (!pushBeforeSha || /^0+$/u.test(pushBeforeSha)) {
      return runGit(["hash-object", "-t", "tree", "/dev/null"], cwd);
    }
    return pushBeforeSha;
  }
  throw new Error(`Unsupported CI event: ${eventName || "unknown"}`);
}

function main() {
  const baseSha = selectComparisonBase({
    eventName: process.env.EVENT_NAME,
    headSha: process.env.HEAD_SHA,
    sourceSha: process.env.INPUT_SOURCE_SHA,
    inputBaseSha: process.env.INPUT_BASE_SHA,
    prBaseSha: process.env.PR_BASE_SHA,
    pushBeforeSha: process.env.PUSH_BEFORE_SHA,
  });
  if (!process.env.GITHUB_OUTPUT) {
    throw new Error("GITHUB_OUTPUT is required.");
  }
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `head_sha=${process.env.HEAD_SHA}\nbase_sha=${baseSha}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
