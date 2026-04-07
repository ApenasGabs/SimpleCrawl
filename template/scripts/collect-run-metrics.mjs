#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const dataRoot = path.resolve("data");
const scrapersDir = path.join(dataRoot, "scrapers");
const mergedPath = path.join(dataRoot, "merged.json");
const metricsDir = path.join(dataRoot, "metrics");
const latestPath = path.join(metricsDir, "latest.json");
const historyPath = path.join(metricsDir, "history.jsonl");

const safeReadJson = (filePath, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
};

const scraperFiles = fs.existsSync(scrapersDir)
  ? fs
      .readdirSync(scrapersDir)
      .filter((name) => name.endsWith(".json"))
      .sort()
  : [];

const perSource = scraperFiles.map((fileName) => {
  const absolutePath = path.join(scrapersDir, fileName);
  const parsed = safeReadJson(absolutePath, []);
  const items = Array.isArray(parsed) ? parsed.length : 0;
  return {
    source: fileName.replace(/\.json$/, ""),
    items,
  };
});

const mergedData = safeReadJson(mergedPath, []);

const toInt = (rawValue, fallback = 0) => {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const record = {
  timestamp: new Date().toISOString(),
  gitRef: process.env.GITHUB_REF_NAME ?? "local",
  primaryMode: process.env.SCRAPE_PRIMARY_MODE ?? "unknown",
  fallbackTriggered: process.env.SCRAPE_FALLBACK_TRIGGERED === "true",
  shadowEnabled: process.env.SCRAPE_SHADOW_MODE === "true",
  shadowMode: process.env.SCRAPE_SHADOW_MODE_SELECTED ?? "none",
  runDurationMs: toInt(process.env.SCRAPE_RUN_DURATION_MS),
  shadowDurationMs: toInt(process.env.SCRAPE_SHADOW_DURATION_MS),
  files: scraperFiles.length,
  mergedItems: Array.isArray(mergedData) ? mergedData.length : 0,
  perSource,
};

fs.mkdirSync(metricsDir, { recursive: true });
fs.writeFileSync(latestPath, JSON.stringify(record, null, 2) + "\n");
fs.appendFileSync(historyPath, JSON.stringify(record) + "\n");

console.log(
  `Metrics recorded: mode=${record.primaryMode}, mergedItems=${record.mergedItems}, files=${record.files}`,
);
