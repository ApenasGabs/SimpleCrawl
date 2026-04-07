import type { BrowserContext, Page } from "playwright";
import type { RawData, ScrapedRecord } from "../../domain/types";
import { logger } from "../../utils/logger";

export interface ScraperConfig {
  userAgent: string;
  maxDurationMs: number;
}

export abstract class BaseScraper<T extends RawData = RawData> {
  abstract name: string;
  abstract baseUrl: string;

  constructor(protected readonly config: ScraperConfig) {}

  protected setup = async (page: Page): Promise<void> => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.setExtraHTTPHeaders({ "User-Agent": this.config.userAgent });
  };

  configurePage = async (page: Page): Promise<void> => {
    await this.setup(page);
  };

  protected abstract scrape(page: Page): Promise<T[]>;
  protected abstract map(raw: T[]): Promise<ScrapedRecord[]>;
  protected abstract validate(data: ScrapedRecord[]): Promise<ScrapedRecord[]>;

  process = async (page: Page): Promise<ScrapedRecord[]> => {
    const start = Date.now();
    try {
      logger.info("scraper.start", { scraper: this.name });
      await this.setup(page);
      const raw = await this.scrape(page);
      const mapped = await this.map(raw);
      const validated = await this.validate(mapped);
      logger.info("scraper.done", {
        scraper: this.name,
        count: validated.length,
        ms: Date.now() - start,
      });
      return validated;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      logger.error("scraper.error", { scraper: this.name, error: message });
      throw error;
    }
  };

  run = async (context: BrowserContext): Promise<ScrapedRecord[]> => {
    const page = await context.newPage();
    try {
      return await this.process(page);
    } catch (error) {
      await page.screenshot({ path: `logs/${this.name}-error.png` });
      throw error;
    } finally {
      await page.close();
    }
  };
}
