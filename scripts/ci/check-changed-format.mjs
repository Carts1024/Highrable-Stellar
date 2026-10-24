import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SUPPORTED_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".scss",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml",
]);

function runGit(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed.`);
  }
  return result.stdout;
}

export function getChangedFormatFiles({ base, head, cwd = process.cwd() }) {
  if (!base || !head) {
    throw new Error("FORMAT_BASE_SHA and FORMAT_HEAD_SHA are required.");
  }

  const changedPaths = runGit(
    ["diff", "--no-ext-diff", "--name-only", "-z", "--diff-filter=ACMRT", base, head, "--"],
    cwd,
  )
    .split("\0")
    .filter(Boolean);

  return changedPaths
    .filter((filePath) => SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .map((filePath) => `./${filePath}`);
}

export function checkChangedFormat({
  base,
  head,
  cwd = process.cwd(),
  formatter = "pnpm",
  log = console.log,
}) {
  const files = getChangedFormatFiles({ base, head, cwd });
  if (files.length === 0) {
    log("No changed supported files need formatting checks.");
    return;
  }

  log(`Checking formatting for ${files.length} changed file(s).`);
  const args =
    formatter === "pnpm" ? ["exec", "oxfmt", "--check", ...files] : ["--check", ...files];
  const result = spawnSync(formatter, args, { cwd, stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`oxfmt --check failed with exit code ${result.status ?? "unknown"}.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    checkChangedFormat({
      base: process.env.FORMAT_BASE_SHA,
      head: process.env.FORMAT_HEAD_SHA,
      formatter: process.env.OXFMT_BIN || "pnpm",
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
