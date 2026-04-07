import type { BaseHttpScraper } from "./base/BaseHttpScraper";
import type { BaseScraper } from "./base/BaseScraper";
import { SiteAScraper } from "./siteA/SiteAScraper";
import { SiteBScraper } from "./siteB/SiteBScraper";
import { SiteCScraper } from "./siteC/SiteCScraper";

type EnginePreferred = "ssr" | "csr";

interface ScraperMetadata {
  name: string;
  enginePreferred: EnginePreferred;
  seedUrls: string[];
  labels: string[];
}

interface RegistryEntry<TScraper> {
  scraper: TScraper;
  metadata: ScraperMetadata;
}

const siteA = new SiteAScraper({
  userAgent: "crawler/1.0",
  maxDurationMs: 2 * 60 * 60 * 1000,
});

const siteB = new SiteBScraper({
  userAgent: "crawler/1.0",
  maxDurationMs: 2 * 60 * 60 * 1000,
});

const siteC = new SiteCScraper({
  userAgent: "crawler/1.0",
  maxDurationMs: 60_000,
});

export const browserScraperEntries: RegistryEntry<BaseScraper>[] = [
  {
    scraper: siteA,
    metadata: {
      name: siteA.name,
      enginePreferred: "csr",
      seedUrls: [siteA.baseUrl],
      labels: ["CSR_DETAIL"],
    },
  },
  {
    scraper: siteB,
    metadata: {
      name: siteB.name,
      enginePreferred: "csr",
      seedUrls: [siteB.baseUrl],
      labels: ["CSR_DETAIL"],
    },
  },
];

export const httpScraperEntries: RegistryEntry<BaseHttpScraper>[] = [
  {
    scraper: siteC,
    metadata: {
      name: siteC.name,
      enginePreferred: "ssr",
      seedUrls: [siteC.baseUrl],
      labels: ["SSR_LIST"],
    },
  },
];

export const scraperMetadataByName: Record<string, ScraperMetadata> = {
  ...Object.fromEntries(
    browserScraperEntries.map(({ metadata }) => [metadata.name, metadata]),
  ),
  ...Object.fromEntries(
    httpScraperEntries.map(({ metadata }) => [metadata.name, metadata]),
  ),
};

/** Scrapers CSR - precisam de BrowserContext (Playwright) */
export const browserScraperRegistry: BaseScraper[] = browserScraperEntries.map(
  (entry) => entry.scraper,
);

/** Scrapers SSR - rodam com fetch + cheerio, sem browser */
export const httpScraperRegistry: BaseHttpScraper[] = httpScraperEntries.map(
  (entry) => entry.scraper,
);

/**
 * @deprecated Use browserScraperRegistry / httpScraperRegistry.
 * Mantido para compatibilidade com main.ts existente.
 */
export const scraperRegistry: BaseScraper[] = browserScraperRegistry;

export type { EnginePreferred, RegistryEntry, ScraperMetadata };
