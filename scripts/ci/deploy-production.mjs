import { spawn } from "node:child_process";
import { appendFileSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export class ReleaseGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReleaseGuardError";
  }
}

export function assertMainReleaseRef({ ref, sourceSha, headSha }) {
  if (ref !== "refs/heads/main") {
    throw new ReleaseGuardError("Production releases can run only from main.");
  }
  if (!/^[a-f0-9]{40}$/iu.test(sourceSha || "")) {
    throw new ReleaseGuardError("The release source SHA is missing or invalid.");
  }
  if (headSha && sourceSha.toLowerCase() !== headSha.toLowerCase()) {
    throw new ReleaseGuardError("The checked out commit does not match the release source SHA.");
  }
}

function parseConvexTarget(deployKey) {
  const match = /^prod:([a-z0-9-]+)\|(.+)$/iu.exec(deployKey || "");
  if (!match) {
    throw new ReleaseGuardError("CONVEX_DEPLOY_KEY must be a production deploy key.");
  }
  return match[1].toLowerCase();
}

function normalizeConvexUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new ReleaseGuardError("EXPECTED_CONVEX_URL must be a valid HTTPS Convex deployment URL.");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new ReleaseGuardError("EXPECTED_CONVEX_URL must be a valid HTTPS Convex deployment URL.");
  }
  return parsed;
}

export function validateReleaseConfiguration(env, { headSha } = {}) {
  assertMainReleaseRef({ ref: env.GITHUB_REF, sourceSha: env.GITHUB_SHA, headSha });
  if (env.RELEASE_CI_RESULT !== "success") {
    throw new ReleaseGuardError("The reusable CI workflow did not succeed for this source commit.");
  }

  const required = [
    "VERCEL_TOKEN",
    "VERCEL_ORG_ID",
    "VERCEL_PROJECT_ID",
    "CONVEX_DEPLOY_KEY",
    "EXPECTED_CONVEX_URL",
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
  ];
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new ReleaseGuardError(
      `Production release configuration is missing: ${missing.join(", ")}.`,
    );
  }

  const deploymentName = parseConvexTarget(env.CONVEX_DEPLOY_KEY.trim());
  const expectedUrl = normalizeConvexUrl(env.EXPECTED_CONVEX_URL.trim());
  if (expectedUrl.hostname !== `${deploymentName}.convex.cloud`) {
    throw new ReleaseGuardError("CONVEX_DEPLOY_KEY does not target EXPECTED_CONVEX_URL.");
  }

  return { deploymentName, expectedConvexUrl: expectedUrl.origin };
}

function parseDotEnv(contents) {
  const values = new Map();
  for (const line of contents.split(/\r?\n/u)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/u.exec(line);
    if (!match) {
      continue;
    }

    let value = match[2];
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        value = value.slice(1, -1);
      }
    } else if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    values.set(match[1], value);
  }
  return values;
}

export function validatePulledVercelConfiguration(contents, expectedConvexUrl) {
  const values = parseDotEnv(contents);
  const network = values.get("NEXT_PUBLIC_STELLAR_NETWORK")?.trim().toLowerCase();
  if (network !== "testnet") {
    throw new ReleaseGuardError(
      "Pulled Vercel production configuration must select Stellar Testnet.",
    );
  }

  const configuredConvexUrl = values.get("NEXT_PUBLIC_CONVEX_URL")?.trim();
  if (!configuredConvexUrl) {
    throw new ReleaseGuardError(
      "Pulled Vercel production configuration is missing NEXT_PUBLIC_CONVEX_URL.",
    );
  }
  const pulledUrl = normalizeConvexUrl(configuredConvexUrl);
  if (pulledUrl.origin !== expectedConvexUrl) {
    throw new ReleaseGuardError("Pulled Vercel configuration does not match EXPECTED_CONVEX_URL.");
  }
}

export function parseVercelDeploymentUrl(output) {
  const urls = [...output.matchAll(/https:\/\/[^\s"'<>]+/giu)].map((match) =>
    match[0].replace(/[),.;\]]+$/u, ""),
  );
  const productionLine = output.match(/Production:\s*(https:\/\/[^\s"'<>]+)/iu)?.[1];
  const candidate = productionLine?.replace(/[),.;\]]+$/u, "") || urls.at(-1);
  if (!candidate) {
    throw new ReleaseGuardError("Vercel did not return a valid deployment URL.");
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new ReleaseGuardError("Vercel did not return a valid deployment URL.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new ReleaseGuardError("Vercel returned a deployment URL that was not HTTPS.");
  }
  return parsed.origin;
}

function runProcess(command, args, { cwd, env, captureStdout = false }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["inherit", "pipe", "inherit"],
    });
    let stdout = "";

    child.stdout.on("data", (chunk) => {
      const value = chunk.toString();
      stdout += value;
      if (!captureStdout) {
        process.stdout.write(value);
      }
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve({ stdout });
        return;
      }
      reject(
        new Error(
          `${command} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`,
        ),
      );
    });
  });
}

function appendOutputs(filePath, state) {
  if (!filePath) {
    return;
  }
  appendFileSync(
    filePath,
    [
      `convex_result=${state.convex}`,
      `vercel_result=${state.vercel}`,
      `deployment_url=${state.deploymentUrl}`,
      "",
    ].join("\n"),
  );
}

function getHeadSha(cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["rev-parse", "HEAD"], { cwd, stdio: ["ignore", "pipe", "ignore"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new ReleaseGuardError("Unable to identify the checked out release commit."));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export async function runProductionRelease({
  env = process.env,
  cwd = repositoryRoot,
  execute = runProcess,
} = {}) {
  const headSha = await getHeadSha(cwd);
  const { expectedConvexUrl } = validateReleaseConfiguration(env, { headSha });
  const projectDirectory = env.VERCEL_PROJECT_DIR || path.join(cwd, "apps/web");
  const pulledEnvironment = path.join(projectDirectory, ".vercel", ".env.production.local");
  const state = { convex: "not_started", vercel: "not_started", deploymentUrl: "" };

  try {
    await execute(
      env.VERCEL_CLI || "vercel",
      [
        "pull",
        "--yes",
        "--environment=production",
        "--cwd",
        "apps/web",
        "--token",
        env.VERCEL_TOKEN,
      ],
      { cwd, env },
    );

    let pulledContents;
    try {
      pulledContents = readFileSync(pulledEnvironment, "utf8");
    } catch {
      throw new ReleaseGuardError(
        "Vercel pull did not create the expected production environment file.",
      );
    }
    validatePulledVercelConfiguration(pulledContents, expectedConvexUrl);

    const buildCommand =
      'cd ../.. && vercel build --prod --yes --cwd apps/web --token="$VERCEL_TOKEN"';
    await execute(
      env.PNPM_CLI || "pnpm",
      [
        "--filter",
        "@repo/backend",
        "exec",
        "convex",
        "deploy",
        "--cmd-url-env-var-name",
        "NEXT_PUBLIC_CONVEX_URL",
        "--cmd",
        buildCommand,
      ],
      { cwd, env },
    );
    state.convex = "success";

    const deployment = await execute(
      env.VERCEL_CLI || "vercel",
      ["deploy", "--prebuilt", "--prod", "--yes", "--cwd", "apps/web", "--token", env.VERCEL_TOKEN],
      { cwd, env, captureStdout: true },
    );
    state.vercel = "success";
    state.deploymentUrl = parseVercelDeploymentUrl(deployment.stdout);
    process.stdout.write(`Published production deployment: ${state.deploymentUrl}\n`);
  } catch (error) {
    if (state.convex === "success") {
      state.vercel = "failure";
    } else if (state.vercel === "not_started") {
      state.vercel = "not_started";
    }
    throw error;
  } finally {
    rmSync(pulledEnvironment, { force: true });
    appendOutputs(env.GITHUB_OUTPUT, state);
  }
}

async function main() {
  if (process.argv.includes("--check-ref")) {
    const headSha = await getHeadSha(repositoryRoot);
    assertMainReleaseRef({
      ref: process.env.GITHUB_REF,
      sourceSha: process.env.GITHUB_SHA,
      headSha,
    });
    process.stdout.write("Release source is the immutable main commit.\n");
    return;
  }
  await runProductionRelease();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
