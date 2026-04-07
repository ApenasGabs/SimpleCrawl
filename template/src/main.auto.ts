import {
  CheerioCrawler,
  Dataset,
  PlaywrightCrawler,
  RequestQueue,
} from "crawlee";
import fs from "node:fs";
import path from "node:path";
import type { ScrapedRecord } from "./domain/types";
import { browserScraperEntries, httpScraperEntries } from "./scrapers/registry";
import { logger } from "./utils/logger";

type AutoProfile = "auto-infer" | "ssr-first" | "csr-first" | "hybrid";
const AUTO_CONFIG_PATH = path.resolve(process.cwd(), "simplecrawl.auto.json");

const isAutoProfile = (value: unknown): value is AutoProfile =>
  value === "auto-infer" ||
  value === "ssr-first" ||
  value === "csr-first" ||
  value === "hybrid";

const readAutoProfile = (): AutoProfile => {
  const envProfile = process.env.SIMPLECRAWL_AUTO_PROFILE;
  if (isAutoProfile(envProfile)) {
    return envProfile;
  }

  try {
    if (fs.existsSync(AUTO_CONFIG_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(AUTO_CONFIG_PATH, "utf-8")) as {
        profile?: unknown;
      };
      if (isAutoProfile(parsed.profile)) {
        return parsed.profile;
      }
    }
  } catch {
    // fall back to default profile
  }

  return "hybrid";
};

interface CrawlResult {
  source: string;
  data: ScrapedRecord[];
  engine: "ssr" | "csr";
}

const outputDir = path.resolve("data/scrapers");

const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const ssrQueueName = `simplecrawl-auto-ssr-${runId}`;
const csrQueueName = `simplecrawl-auto-csr-${runId}`;

const writeResults = (results: CrawlResult[]): void => {
  fs.mkdirSync(outputDir, { recursive: true });

  for (const result of results) {
    fs.writeFileSync(
      path.join(outputDir, `${result.source}.json`),
      JSON.stringify(result.data, null, 2),
    );
  }
};

const runHttpPhase = async (): Promise<CrawlResult[]> => {
  if (httpScraperEntries.length === 0) {
    return [];
  }

  logger.info("auto.phase.start", {
    phase: "ssr",
    count: httpScraperEntries.length,
  });

  const queue = await RequestQueue.open(ssrQueueName);
  for (const { scraper, metadata } of httpScraperEntries) {
    for (const [index, seedUrl] of metadata.seedUrls.entries()) {
      await queue.addRequest({
        url: seedUrl,
        uniqueKey: `${metadata.name}:${index}`,
        label: metadata.labels[0] ?? "SSR_LIST",
        userData: {
          source: metadata.name,
          labels: metadata.labels,
        },
      });
    }
  }

  const results = new Map<string, ScrapedRecord[]>();
  const scraperByName = new Map(
    httpScraperEntries.map(({ scraper }) => [scraper.name, scraper]),
  );

  const crawler = new CheerioCrawler({
    requestQueue: queue,
    useSessionPool: true,
    async requestHandler({ request }) {
      const source = String(request.userData.source);
      const scraper = scraperByName.get(source);
      if (!scraper) {
        throw new Error(`Scraper SSR nao encontrado: ${source}`);
      }

      const data = await scraper.runAt(request.loadedUrl ?? request.url);
      results.set(source, data);
      await Dataset.pushData({ source, engine: "ssr", items: data.length });
    },
  });

  await crawler.run();

  return Array.from(results.entries()).map(([source, data]) => ({
    source,
    data,
    engine: "ssr",
  }));
};

const runBrowserPhase = async (): Promise<CrawlResult[]> => {
  if (browserScraperEntries.length === 0) {
    return [];
  }

  logger.info("auto.phase.start", {
    phase: "csr",
    count: browserScraperEntries.length,
  });

  const queue = await RequestQueue.open(csrQueueName);
  for (const { scraper, metadata } of browserScraperEntries) {
    for (const [index, seedUrl] of metadata.seedUrls.entries()) {
      await queue.addRequest({
        url: seedUrl,
        uniqueKey: `${metadata.name}:${index}`,
        label: metadata.labels[0] ?? "CSR_DETAIL",
        userData: {
          source: metadata.name,
          labels: metadata.labels,
        },
      });
    }
  }

  const results = new Map<string, ScrapedRecord[]>();
  const scraperByName = new Map(
    browserScraperEntries.map(({ scraper }) => [scraper.name, scraper]),
  );

  const crawler = new PlaywrightCrawler({
    requestQueue: queue,
    useSessionPool: true,
    launchContext: {
      launchOptions: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    },
    preNavigationHooks: [
      async ({ page, request }) => {
        const source = String(request.userData.source);
        const scraper = scraperByName.get(source);
        if (!scraper) {
          throw new Error(`Scraper CSR nao encontrado: ${source}`);
        }
        await scraper.configurePage(page);
      },
    ],
    async requestHandler({ page, request }) {
      const source = String(request.userData.source);
      const scraper = scraperByName.get(source);
      if (!scraper) {
        throw new Error(`Scraper CSR nao encontrado: ${source}`);
      }

      const data = await scraper.process(page);
      results.set(source, data);
      await Dataset.pushData({ source, engine: "csr", items: data.length });
    },
  });

  await crawler.run();

  return Array.from(results.entries()).map(([source, data]) => ({
    source,
    data,
    engine: "csr",
  }));
};

const run = async (): Promise<void> => {
  const results: CrawlResult[] = [];
  const profile = readAutoProfile();

  logger.info("auto.profile.selected", { profile });

  const phases =
    profile === "csr-first"
      ? [runBrowserPhase, runHttpPhase]
      : [runHttpPhase, runBrowserPhase];

  for (const phase of phases) {
    const phaseResults = await phase();
    results.push(...phaseResults);
  }

  writeResults(results);

  logger.info("auto.scraping.done", {
    sources: results.length,
    items: results.reduce((acc, result) => acc + result.data.length, 0),
  });
};

void run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error("auto.scraping.failed", { error: message });
  process.exitCode = 1;
});
