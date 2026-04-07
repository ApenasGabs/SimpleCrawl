# 🕷️ SimpleCrawl

CLI interativo para criar projetos de web scraping do zero — estilo `create-vite`.  
Ideal para quem está começando com scraping e quer uma base sólida.

## Uso

```bash
# npm
npm create simplecrawl

# yarn
yarn create simplecrawl

# pnpm
pnpm create simplecrawl

# com nome do projeto direto
npm create simplecrawl my-scraper

# flags diretas (pula menus)
npm create simplecrawl -- --orchestration auto --profile hybrid --arch 1-modular --dest my-scraper
```

## Fluxo interativo

```text
1/4 — Orquestração do projeto:
  ❯ manual   — Fluxo atual com engine + arquitetura
    auto     — Orquestração autogerenciada com Crawlee

2/4 — Engine ou perfil do auto:
  ❯ ssr      — HTTP + Cheerio     (sites server-side rendered)
    csr      — Playwright         (sites client-side / SPA)
    hybrid   — Cheerio + Playwright fallback (melhor dos dois)

  ou, se escolher auto:
  ❯ auto-infer  — Decisão automática com defaults conservadores
    ssr-first   — Executa SSR antes de browser
    csr-first   — Executa browser antes de SSR
    hybrid      — SSR + browser fallback (recomendado)

3/4 — Arquitetura do projeto:
  ❯ 1-modular        — Simples, 1-3 scrapers, fácil de começar
    2-ddd-lite       — DDD leve, domínios separados, escalável
    3-plugin-based   — Plugins dinâmicos, 6+ scrapers
    4-queue-based    — Filas (Redis/Bull), produção larga escala

4/4 — Nome do projeto (padrão: my-scraper):
```

## O que é gerado

```text
my-scraper/
├── package.json          # Dependências ajustadas à engine escolhida
├── tsconfig.json
├── README.md             # Customizado com engine + arch
├── simplecrawl.auto.json  # Só no modo auto
├── docs/
├── examples/
└── src/
    ├── domain/types.ts   # ScrapedRecord + RawData (genérico)
    ├── scrapers/
    │   └── base/         # BaseScraper e/ou BaseHttpScraper
    ├── pipeline/         # BrowserPool, ParallelExecutor, merge
    ├── main.auto.ts      # Só no modo auto
    └── utils/logger.ts
```

## Flags

| Flag | Atalho | Descrição |
| --- | --- | --- |
| `--orchestration` | `-o` | `manual` ou `auto` |
| `--engine` | `-e` | `ssr`, `csr` ou `hybrid` |
| `--profile` | `-p` | `auto-infer`, `ssr-first`, `csr-first` ou `hybrid` |
| `--arch` | `-a` | `1-modular`, `2-ddd-lite`, `3-plugin-based`, `4-queue-based` |
| `--dest` | `-d` | Nome da pasta destino |
