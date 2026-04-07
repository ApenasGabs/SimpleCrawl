import fs from "fs";
import type { ScrapedRecord } from "./domain/types";
import { BrowserPool } from "./pipeline/BrowserPool";
import { ParallelExecutor } from "./pipeline/ParallelExecutor";
import {
  browserScraperRegistry,
  httpScraperRegistry,
} from "./scrapers/registry";

const run = async (): Promise<void> => {
  const allResults: { source: string; data: ScrapedRecord[] }[] = [];
  const startedAt = Date.now();
  const metrics = {
    ssr: { success: 0, failed: 0, items: 0, durationMs: 0 },
    csr: { success: 0, failed: 0, items: 0, durationMs: 0 },
  };

  // ── 1. HTTP scrapers primeiro (SSR — mais rápido, sem browser) ───────────
  if (httpScraperRegistry.length > 0) {
    const phaseStart = Date.now();
    console.log(
      `\n⚡ Rodando ${httpScraperRegistry.length} scraper(s) HTTP (SSR)…`,
    );
    const httpResults = await Promise.allSettled(
      httpScraperRegistry.map((s) => s.run()),
    );

    httpResults.forEach((r, i) => {
      const name = httpScraperRegistry[i].name;
      if (r.status === "fulfilled") {
        allResults.push({ source: name, data: r.value });
        metrics.ssr.success += 1;
        metrics.ssr.items += r.value.length;
      } else {
        console.error(`❌ HTTP scraper ${name}: ${r.reason}`);
        metrics.ssr.failed += 1;
      }
    });
    metrics.ssr.durationMs = Date.now() - phaseStart;
  }

  // ── 2. Browser scrapers (CSR — Playwright) ──────────────────────────────
  if (browserScraperRegistry.length > 0) {
    const phaseStart = Date.now();
    console.log(
      `\n🌐 Rodando ${browserScraperRegistry.length} scraper(s) Playwright (CSR)…`,
    );
    const pool = new BrowserPool(3);
    await pool.initialize();
    try {
      const executor = new ParallelExecutor(pool, 5 * 60 * 60 * 1000);
      const results = await executor.runAll(browserScraperRegistry);

      results.forEach((r) => {
        if (r.status === "success" && r.data) {
          allResults.push({ source: r.scraper, data: r.data });
          metrics.csr.success += 1;
          metrics.csr.items += r.data.length;
        } else if (r.status === "failed") {
          console.error(`❌ Browser scraper ${r.scraper}: ${r.error}`);
          metrics.csr.failed += 1;
        }
      });
    } finally {
      await pool.cleanup();
    }
    metrics.csr.durationMs = Date.now() - phaseStart;
  }

  // ── 3. Persistir resultados ──────────────────────────────────────────────
  fs.mkdirSync("data/scrapers", { recursive: true });

  for (const { source, data } of allResults) {
    fs.writeFileSync(
      `data/scrapers/${source}.json`,
      JSON.stringify(data, null, 2),
    );
  }

  console.log("\n✅ Scraping finalizado:", {
    total: allResults.length,
    items: allResults.reduce((acc, r) => acc + r.data.length, 0),
    durationMs: Date.now() - startedAt,
    engines: metrics,
  });
};

void run();
