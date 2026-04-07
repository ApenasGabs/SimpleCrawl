import * as cheerio from "cheerio";
import type { RawData, ScrapedRecord } from "../../domain/types";
import { logger } from "../../utils/logger";

export interface HttpScraperConfig {
  userAgent: string;
  maxDurationMs: number;
  /** Headers extras além do User-Agent */
  headers?: Record<string, string>;
}

/**
 * Base para scrapers de sites SSR (server-side rendered).
 * Usa fetch + cheerio em vez de browser — mais rápido e leve.
 * Mesmo contrato de saída que BaseScraper (Playwright).
 */
export abstract class BaseHttpScraper<T extends RawData = RawData> {
  abstract name: string;
  abstract baseUrl: string;

  constructor(protected readonly config: HttpScraperConfig) {}

  /** Faz GET e retorna o cheerio `$` pronto para queries */
  protected fetch = async (url: string): Promise<cheerio.CheerioAPI> => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.maxDurationMs,
    );

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": this.config.userAgent,
          ...this.config.headers,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} when accessing ${url}`);
      }

      const html = await res.text();
      return cheerio.load(html);
    } finally {
      clearTimeout(timeout);
    }
  };

  protected abstract scrape($: cheerio.CheerioAPI): Promise<T[]>;
  protected abstract map(raw: T[]): Promise<ScrapedRecord[]>;
  protected abstract validate(data: ScrapedRecord[]): Promise<ScrapedRecord[]>;

  process = async (
    $: cheerio.CheerioAPI,
    sourceUrl: string = this.baseUrl,
  ): Promise<ScrapedRecord[]> => {
    const start = Date.now();
    try {
      logger.info("http-scraper.start", {
        scraper: this.name,
        sourceUrl,
      });
      const raw = await this.scrape($);
      const mapped = await this.map(raw);
      const validated = await this.validate(mapped);
      logger.info("http-scraper.done", {
        scraper: this.name,
        count: validated.length,
        ms: Date.now() - start,
      });
      return validated;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      logger.error("http-scraper.error", {
        scraper: this.name,
        sourceUrl,
        error: message,
      });
      throw error;
    }
  };

  /**
   * Executa o pipeline completo: fetch → scrape → map → validate.
   * Não precisa de BrowserContext — roda standalone.
   */
  run = async (): Promise<ScrapedRecord[]> => {
    return this.runAt(this.baseUrl);
  };

  runAt = async (url: string): Promise<ScrapedRecord[]> => {
    try {
      const $ = await this.fetch(url);
      return await this.process($, url);
    } catch (error) {
      throw error;
    }
  };
}
