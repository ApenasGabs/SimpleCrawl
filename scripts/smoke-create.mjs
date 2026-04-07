#!/usr/bin/env node

import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });

const assertExists = async (targetPath) => {
  await access(targetPath, fsConstants.F_OK);
};

const assertMissing = async (targetPath) => {
  let exists = true;
  try {
    await access(targetPath, fsConstants.F_OK);
    exists = true;
  } catch {
    exists = false;
  }

  if (exists) {
    throw new Error(`Expected path to be missing: ${targetPath}`);
  }
};

const scaffold = async (tempRoot, destinationName, args) => {
  await run(
    process.execPath,
    [path.join(repoRoot, "bin/index.mjs"), ...args, "--dest", destinationName],
    {
      cwd: tempRoot,
    },
  );
};

const tempRoot = await mkdtemp(path.join(tmpdir(), "simplecrawl-smoke-"));

try {
  const manualDest = path.join(tempRoot, "smoke-manual");
  await scaffold(tempRoot, "smoke-manual", [
    "--orchestration",
    "manual",
    "--engine",
    "hybrid",
    "--arch",
    "1-modular",
  ]);
  await assertExists(path.join(manualDest, "package.json"));
  await assertExists(path.join(manualDest, "README.md"));
  await assertExists(path.join(manualDest, "src", "main.ts"));
  await assertMissing(path.join(manualDest, "src", "main.auto.ts"));

  const autoDest = path.join(tempRoot, "smoke-auto");
  await scaffold(tempRoot, "smoke-auto", [
    "--orchestration",
    "auto",
    "--profile",
    "hybrid",
    "--arch",
    "1-modular",
  ]);
  await assertExists(path.join(autoDest, "package.json"));
  await assertExists(path.join(autoDest, "README.md"));
  await assertExists(path.join(autoDest, "src", "main.auto.ts"));
  await assertExists(path.join(autoDest, "src", "scrapers", "registry.ts"));
  await assertExists(path.join(autoDest, "simplecrawl.auto.json"));

  console.log(`Smoke scaffold verified in ${manualDest} and ${autoDest}`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
