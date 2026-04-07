import { promises as fs } from "fs";
import path from "path";
import readline from "readline/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AVAILABLE_ENGINES = ["ssr", "csr", "hybrid"] as const;
const AVAILABLE_ORCHESTRATIONS = ["manual", "auto"] as const;
const AVAILABLE_AUTO_PROFILES = [
  "auto-infer",
  "ssr-first",
  "csr-first",
  "hybrid",
] as const;
const AVAILABLE_ARCHITECTURES = [
  "1-modular",
  "2-ddd-lite",
  "3-plugin-based",
  "4-queue-based",
] as const;

type Engine = (typeof AVAILABLE_ENGINES)[number];
type Orchestration = (typeof AVAILABLE_ORCHESTRATIONS)[number];
type AutoProfile = (typeof AVAILABLE_AUTO_PROFILES)[number];

const isEngine = (value: string): value is Engine =>
  AVAILABLE_ENGINES.includes(value as Engine);

const isOrchestration = (value: string): value is Orchestration =>
  AVAILABLE_ORCHESTRATIONS.includes(value as Orchestration);

const isAutoProfile = (value: string): value is AutoProfile =>
  AVAILABLE_AUTO_PROFILES.includes(value as AutoProfile);

interface Options {
  orchestration: Orchestration | "";
  engine: Engine | "";
  profile: AutoProfile | "";
  architecture: string;
  destination: string;
  backup: boolean;
  interactive: boolean;
}

const ORCHESTRATION_DESCRIPTIONS: Record<Orchestration, string> = {
  manual: "Fluxo atual com controle manual de engine",
  auto: "Orquestracao autogerenciada com Crawlee",
};

const ORCHESTRATION_COLORS: Record<Orchestration, string> = {
  manual: "\u001b[36m",
  auto: "\u001b[33m",
};

const ENGINE_DESCRIPTIONS: Record<Engine, string> = {
  ssr: "HTTP + Cheerio  (sites server-side rendered)",
  csr: "Playwright      (sites client-side / SPA)",
  hybrid: "Cheerio + Playwright fallback (melhor dos dois)",
};

const ENGINE_COLORS: Record<Engine, string> = {
  ssr: "\u001b[32m",
  csr: "\u001b[36m",
  hybrid: "\u001b[33m",
};

const AUTO_PROFILE_DESCRIPTIONS: Record<AutoProfile, string> = {
  "auto-infer": "Decisao automatica com defaults conservadores",
  "ssr-first": "Executa SSR antes de browser",
  "csr-first": "Executa browser antes de SSR",
  hybrid: "SSR + browser fallback (recomendado)",
};

const AUTO_PROFILE_COLORS: Record<AutoProfile, string> = {
  "auto-infer": "\u001b[35m",
  "ssr-first": "\u001b[32m",
  "csr-first": "\u001b[36m",
  hybrid: "\u001b[33m",
};

const ARCH_COLORS: Record<string, string> = {
  "1-modular": "\u001b[36m",
  "2-ddd-lite": "\u001b[35m",
  "3-plugin-based": "\u001b[33m",
  "4-queue-based": "\u001b[32m",
};

const COLOR_RESET = "\u001b[0m";

const ROOT_FILES = [
  ".env.example",
  "README.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.base.json",
  "docs",
  "examples",
];

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  let orchestration: Orchestration | "" = "";
  let engine: Engine | "" = "";
  let profile: AutoProfile | "" = "";
  let architecture = "";
  let destination = "my-scraper";
  let backup = true;
  let interactive = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--orchestration" || arg === "-o") {
      const val = (args[i + 1] ?? "") as Orchestration;
      if (AVAILABLE_ORCHESTRATIONS.includes(val)) orchestration = val;
      i += 1;
      continue;
    }
    if (arg === "--engine" || arg === "-e") {
      const val = (args[i + 1] ?? "") as Engine;
      if (AVAILABLE_ENGINES.includes(val)) engine = val;
      i += 1;
      continue;
    }
    if (arg === "--profile" || arg === "-p") {
      const val = (args[i + 1] ?? "") as AutoProfile;
      if (AVAILABLE_AUTO_PROFILES.includes(val)) profile = val;
      i += 1;
      continue;
    }
    if (arg === "--arch" || arg === "-a") {
      architecture = args[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg === "--dest" || arg === "-d") {
      destination = args[i + 1] ?? "new-template";
      i += 1;
      continue;
    }
    if (arg === "--no-backup") {
      backup = false;
    }
    if (arg === "--interactive" || arg === "-i") {
      interactive = true;
    }
  }

  return {
    orchestration,
    engine: engine || ("" as Engine),
    profile,
    architecture,
    destination,
    backup,
    interactive,
  };
};

const promptSelect = async (
  label: string,
  options: string[],
  defaultIndex: number,
  descriptions?: Record<string, string>,
  colors?: Record<string, string>,
): Promise<string> => {
  return new Promise((resolve) => {
    let selectedIndex = defaultIndex;

    const render = (): void => {
      process.stdout.write("\u001b[2J\u001b[H");
      console.log(label);

      options.forEach((option, index) => {
        const isSelected = index === selectedIndex;
        const pointer = isSelected ? "❯" : " ";
        const suffix = index === defaultIndex ? " (padrao)" : "";
        const color = (colors ?? ARCH_COLORS)[option] ?? "";
        const desc = descriptions?.[option]
          ? `  — ${descriptions[option]}`
          : "";
        const text = `${pointer} ${color}${option}${COLOR_RESET}${desc}${suffix}`;
        console.log(text);
      });

      console.log("\nUse ↑/↓ para navegar e Enter para confirmar.");
    };

    const onKeyPress = (data: Buffer): void => {
      const key = data.toString();

      if (key === "\u0003") {
        process.exit(1);
      }

      if (key === "\u001b[A") {
        selectedIndex =
          selectedIndex === 0 ? options.length - 1 : selectedIndex - 1;
        render();
        return;
      }

      if (key === "\u001b[B") {
        selectedIndex =
          selectedIndex === options.length - 1 ? 0 : selectedIndex + 1;
        render();
        return;
      }

      if (key === "\r") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onKeyPress);
        process.stdout.write("\u001b[2J\u001b[H");
        resolve(options[selectedIndex]);
      }
    };

    render();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onKeyPress);
  });
};

const promptInteractive = async (
  defaults: Omit<
    Options,
    "architecture" | "engine" | "orchestration" | "profile" | "interactive"
  >,
): Promise<Omit<Options, "interactive">> => {
  const orchestration = (await promptSelect(
    "1/4 — Orquestracao do projeto:",
    [...AVAILABLE_ORCHESTRATIONS],
    0,
    ORCHESTRATION_DESCRIPTIONS,
    ORCHESTRATION_COLORS,
  )) as Orchestration;

  const engine =
    orchestration === "manual"
      ? ((await promptSelect(
          "2/4 — Engine de extracao (tipo de site):",
          [...AVAILABLE_ENGINES],
          2,
          ENGINE_DESCRIPTIONS,
          ENGINE_COLORS,
        )) as Engine)
      : "hybrid";

  const profile =
    orchestration === "auto"
      ? ((await promptSelect(
          "2/4 — Perfil do autogerenciado:",
          [...AVAILABLE_AUTO_PROFILES],
          3,
          AUTO_PROFILE_DESCRIPTIONS,
          AUTO_PROFILE_COLORS,
        )) as AutoProfile)
      : "";

  const architecture = await promptSelect(
    "3/4 — Arquitetura do projeto:",
    [...AVAILABLE_ARCHITECTURES],
    0,
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const destAnswer = await rl.question(
    `4/4 — Destino (padrao: ${defaults.destination}): `,
  );
  const destination = destAnswer.trim() || defaults.destination;

  const backupAnswer = await rl.question(
    `Backup automatico? (Y/n, padrao: ${defaults.backup ? "Y" : "n"}): `,
  );
  const normalized = backupAnswer.trim().toLowerCase();
  const backup =
    normalized === ""
      ? defaults.backup
      : !["n", "nao", "no"].includes(normalized);

  await rl.close();

  return { orchestration, engine, profile, architecture, destination, backup };
};

const exists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const copyFile = async (source: string, destination: string): Promise<void> => {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
};

const copyDir = async (source: string, destination: string): Promise<void> => {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }),
  );
};

const backupDestination = async (destination: string): Promise<void> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backup", timestamp);
  await fs.mkdir(backupDir, { recursive: true });
  await fs.rename(
    destination,
    path.join(backupDir, path.basename(destination)),
  );
};

const scaffold = async (): Promise<void> => {
  const rootDir = path.resolve(__dirname, "..");
  const {
    orchestration: argOrchestration,
    engine: argEngine,
    profile: argProfile,
    architecture: argArch,
    destination,
    backup,
    interactive,
  } = parseArgs();

  const shouldPrompt = interactive || !argArch || !argOrchestration;
  const resolvedEngine: Engine =
    argOrchestration === "auto"
      ? "hybrid"
      : isEngine(argEngine)
        ? argEngine
        : "hybrid";
  const resolvedProfile: AutoProfile | "" =
    argOrchestration === "auto"
      ? isAutoProfile(argProfile)
        ? argProfile
        : "hybrid"
      : "";
  const resolved = shouldPrompt
    ? await promptInteractive({ destination, backup })
    : {
        orchestration: argOrchestration,
        engine: resolvedEngine,
        profile: resolvedProfile,
        architecture: argArch,
        destination,
        backup,
      };

  const {
    orchestration,
    engine,
    profile,
    architecture,
    destination: resolvedDest,
    backup: resolvedBackup,
  } = resolved;

  if (!isOrchestration(orchestration)) {
    throw new Error(
      `Orquestracao invalida: ${orchestration}. Opcoes: ${AVAILABLE_ORCHESTRATIONS.join(
        ", ",
      )}`,
    );
  }

  // ── Validar engine ───────────────────────────────────────────────────────
  if (!isEngine(engine)) {
    throw new Error(
      `Engine invalida: ${engine}. Opcoes: ${AVAILABLE_ENGINES.join(", ")}`,
    );
  }

  if (orchestration === "auto" && !isAutoProfile(profile)) {
    throw new Error(
      `Perfil auto invalido: ${profile}. Opcoes: ${AVAILABLE_AUTO_PROFILES.join(
        ", ",
      )}`,
    );
  }

  // ── Validar arquitetura ──────────────────────────────────────────────────
  if (
    !AVAILABLE_ARCHITECTURES.includes(
      architecture as (typeof AVAILABLE_ARCHITECTURES)[number],
    )
  ) {
    throw new Error(
      `Arquitetura invalida: ${architecture}. Opcoes: ${AVAILABLE_ARCHITECTURES.join(
        ", ",
      )}`,
    );
  }

  const sourceDir = path.join(
    rootDir,
    "src",
    "examples",
    "architectures",
    architecture,
  );

  if (!(await exists(sourceDir))) {
    throw new Error(`Arquitetura nao encontrada em: ${sourceDir}`);
  }

  const destinationDir = path.resolve(process.cwd(), resolvedDest);

  if (await exists(destinationDir)) {
    if (resolvedBackup) {
      await backupDestination(destinationDir);
    } else {
      throw new Error(
        `Destino ja existe (${destinationDir}). Use --no-backup para sobrescrever ou apague manualmente.`,
      );
    }
  }

  await fs.mkdir(destinationDir, { recursive: true });

  await Promise.all(
    ROOT_FILES.map(async (entry) => {
      const srcPath = path.join(rootDir, entry);
      const destPath = path.join(destinationDir, entry);

      if (!(await exists(srcPath))) {
        return;
      }

      const stat = await fs.lstat(srcPath);
      if (stat.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }),
  );

  const destSrc = path.join(destinationDir, "src");
  await fs.mkdir(destSrc, { recursive: true });
  await copyDir(sourceDir, destSrc);

  for (const dir of ["domain", "utils"] as const) {
    const srcDir = path.join(rootDir, "src", dir);
    if (await exists(srcDir)) {
      await copyDir(srcDir, path.join(destSrc, dir));
    }
  }

  // ── Copiar base scrapers conforme engine ─────────────────────────────────
  const baseDir = path.join(rootDir, "src", "scrapers", "base");
  const destBase = path.join(destSrc, "scrapers", "base");
  await fs.mkdir(destBase, { recursive: true });

  if (engine === "csr" || engine === "hybrid") {
    await copyFile(
      path.join(baseDir, "BaseScraper.ts"),
      path.join(destBase, "BaseScraper.ts"),
    );
  }
  if (engine === "ssr" || engine === "hybrid") {
    await copyFile(
      path.join(baseDir, "BaseHttpScraper.ts"),
      path.join(destBase, "BaseHttpScraper.ts"),
    );
  }

  const pipelineDir = path.join(rootDir, "src", "pipeline");
  const pipelineDest = path.join(destSrc, "pipeline");
  if (await exists(pipelineDir)) {
    await fs.mkdir(pipelineDest, { recursive: true });
    for (const entry of await fs.readdir(pipelineDir, {
      withFileTypes: true,
    })) {
      if (entry.name === "BrowserPool.ts" && engine === "ssr") {
        continue;
      }
      const src = path.join(pipelineDir, entry.name);
      const dest = path.join(pipelineDest, entry.name);
      if (entry.isDirectory()) {
        await copyDir(src, dest);
      } else {
        await copyFile(src, dest);
      }
    }
  }

  if (orchestration === "auto") {
    const autoMain = path.join(rootDir, "src", "main.auto.ts");
    if (await exists(autoMain)) {
      await copyFile(autoMain, path.join(destSrc, "main.auto.ts"));
    }

    const fullScrapersDir = path.join(rootDir, "src", "scrapers");
    if (await exists(fullScrapersDir)) {
      await copyDir(fullScrapersDir, path.join(destSrc, "scrapers"));
    }

    await fs.writeFile(
      path.join(destinationDir, "simplecrawl.auto.json"),
      JSON.stringify(
        {
          orchestration,
          profile,
          engine: "hybrid",
        },
        null,
        2,
      ) + "\n",
    );
  }

  const pkgPath = path.join(destinationDir, "package.json");
  if (await exists(pkgPath)) {
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8")) as {
      name?: string;
      private?: boolean;
      version?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
    };

    pkg.name = path.basename(destinationDir);
    pkg.private = true;
    pkg.version = "0.1.0";

    if (orchestration === "manual") {
      if (engine === "ssr") {
        delete pkg.dependencies?.playwright;
      }
      if (engine === "csr") {
        delete pkg.dependencies?.cheerio;
      }
      if (pkg.scripts) {
        delete pkg.scripts["scrape:auto"];
        pkg.scripts.scrape = "npm run scrape:parallel";
      }
    } else if (pkg.scripts) {
      pkg.scripts.scrape = "npm run scrape:auto";
    }

    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }

  const readme = `# ${path.basename(destinationDir)}

Criado com SimpleCrawl.

- **Orquestracao:** ${orchestration}${orchestration === "auto" ? ` — perfil ${profile}` : ""}
- **Engine:** ${engine} — ${ENGINE_DESCRIPTIONS[engine]}
- **Arquitetura:** ${architecture}

## Inicio rapido

\`\`\`bash
cd ${path.basename(destinationDir)}
npm install
${engine !== "ssr" ? "npx playwright install --with-deps chromium" : "# Sem browser necessario (SSR)"}
${orchestration === "auto" ? "npm run scrape:auto" : "npm run scrape:parallel"}
\`\`\`
`;
  await fs.writeFile(path.join(destinationDir, "README.md"), readme);

  console.log(`\n✅ Template gerado em: ${destinationDir}`);
  console.log(
    `   Orquestracao: ${ORCHESTRATION_COLORS[orchestration]}${orchestration}${COLOR_RESET}${orchestration === "auto" ? ` — ${profile}` : ""}`,
  );
  console.log(
    `   Engine:       ${ENGINE_COLORS[engine]}${engine}${COLOR_RESET} — ${ENGINE_DESCRIPTIONS[engine]}`,
  );
  console.log(
    `   Arquitetura:  ${ARCH_COLORS[architecture] ?? ""}${architecture}${COLOR_RESET}`,
  );

  if (orchestration === "auto") {
    console.log(
      "\n💡 Dica: use simplecrawl.auto.json para ajustar o perfil auto.",
    );
  } else if (engine === "ssr") {
    console.log(
      "\n💡 Dica: use BaseHttpScraper (fetch + cheerio) como base dos seus scrapers.",
    );
    console.log(
      "   Playwright NÃO foi incluído — instale-o apenas se precisar de fallback.",
    );
  } else if (engine === "hybrid") {
    console.log(
      "\n💡 Dica: use BaseHttpScraper para sites SSR e BaseScraper para sites CSR/SPA.",
    );
    console.log("   Ambas as bases foram incluídas no template.");
  } else {
    console.log(
      "\n💡 Dica: use BaseScraper (Playwright) como base dos seus scrapers.",
    );
  }
};

const main = async (): Promise<void> => {
  try {
    await scaffold();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${message}`);
    process.exit(1);
  }
};

void main();
