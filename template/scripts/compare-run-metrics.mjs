#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const historyPath = path.resolve("data/metrics/history.jsonl");
const requiredCycles = Number.parseInt(process.env.REQUIRED_CYCLES ?? "3", 10);

if (!fs.existsSync(historyPath)) {
  console.log("No metrics history found yet.");
  process.exit(0);
}

const lines = fs
  .readFileSync(historyPath, "utf-8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

const records = lines
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .filter((entry) => entry !== null);

const summarize = (mode) => {
  const byMode = records.filter((entry) => entry.primaryMode === mode);
  const latest = byMode.slice(-requiredCycles);
  const cycles = latest.length;
  const totalItems = latest.reduce(
    (acc, entry) => acc + (entry.mergedItems ?? 0),
    0,
  );
  const totalDuration = latest.reduce(
    (acc, entry) => acc + (entry.runDurationMs ?? 0),
    0,
  );
  return {
    mode,
    cycles,
    avgItems: cycles > 0 ? Math.round(totalItems / cycles) : 0,
    avgDurationMs: cycles > 0 ? Math.round(totalDuration / cycles) : 0,
    fallbackCount: latest.filter((entry) => entry.fallbackTriggered).length,
  };
};

const manual = summarize("manual");
const auto = summarize("auto");

console.log("Run metrics summary:");
console.log(JSON.stringify({ requiredCycles, manual, auto }, null, 2));

const ready = manual.cycles >= requiredCycles && auto.cycles >= requiredCycles;
if (ready) {
  console.log(
    "Promotion gate ready: enough cycles collected for manual and auto.",
  );
} else {
  console.log("Promotion gate pending: collect more cycles.");
}
