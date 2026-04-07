#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const mode = (process.env.SCRAPE_ORCHESTRATION ?? "manual").toLowerCase();
const fallbackToManual = process.env.SCRAPE_FALLBACK_TO_MANUAL !== "false";

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true });
  return typeof result.status === "number" ? result.status : 1;
};

if (mode !== "manual" && mode !== "auto") {
  console.error(`Invalid SCRAPE_ORCHESTRATION: ${mode}. Use manual or auto.`);
  process.exit(1);
}

if (mode === "manual") {
  process.exit(run("npm", ["run", "scrape:parallel"]));
}

const autoCode = run("npm", ["run", "scrape:auto"]);
if (autoCode === 0) {
  process.exit(0);
}

if (!fallbackToManual) {
  process.exit(autoCode);
}

console.warn("Auto mode failed; falling back to manual scraping.");
const manualCode = run("npm", ["run", "scrape:parallel"]);
process.exit(manualCode);
