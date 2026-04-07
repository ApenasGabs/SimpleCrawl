import fs from "fs";
import Joi from "joi";
import path from "path";
import type { ScrapedRecord } from "../domain/types";

const schema = Joi.object<ScrapedRecord>({
  id: Joi.string().required(),
  source: Joi.string().required(),
  title: Joi.string().required(),
  url: Joi.string().uri().required(),
  // Campos opcionais — ajuste conforme seu domínio
  description: Joi.string().optional(),
  price: Joi.alternatives(Joi.number().min(0), Joi.string()).optional(),
  location: Joi.alternatives(Joi.string(), Joi.object()).optional(),
  metadata: Joi.object().optional(),
});

const scrapersDir = path.resolve("data/scrapers");
const inputFiles = fs.existsSync(scrapersDir)
  ? fs
      .readdirSync(scrapersDir)
      .filter((fileName) => fileName.endsWith(".json"))
      .sort()
      .map((fileName) => path.join(scrapersDir, fileName))
  : [];

const raw: ScrapedRecord[] = inputFiles.flatMap((filePath) => {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
  return Array.isArray(parsed) ? (parsed as ScrapedRecord[]) : [];
});

const canonicalUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    parsed.host = parsed.host.toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return parsed.toString();
  } catch {
    return value.trim();
  }
};

const stableKey = (item: ScrapedRecord): string => {
  const canonical = canonicalUrl(item.url);
  return `${item.id}::${canonical}`;
};

const seen = new Set<string>();
const deduped: ScrapedRecord[] = [];
for (const item of raw) {
  const key = stableKey(item);
  if (!seen.has(key)) {
    const { error } = schema.validate(item);
    if (!error) {
      deduped.push(item);
      seen.add(key);
    }
  }
}

fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/merged.json", JSON.stringify(deduped, null, 2));
console.log(`Merged ${deduped.length} items from ${inputFiles.length} files`);
