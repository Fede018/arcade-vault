# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — online arcade platform where users play games and compete for high scores (see README.md). Currently a fresh `create-next-app` scaffold (App Router, TypeScript, Tailwind v4) with no game/scoring logic built yet.

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run start` — run production build
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, extends `eslint-config-next`)

No test runner is configured yet.

## Next.js version warning

`package.json` pins `next@16.2.12` — newer than this model's training data, with breaking API/convention changes. Before writing Next.js-specific code (routing, data fetching, config, server/client component boundaries, etc.), check `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) rather than relying on prior Next.js knowledge. Heed any deprecation notices found there.

## Architecture notes

- App Router only (`app/` directory): `app/layout.tsx` is the root layout, `app/page.tsx` the home page.
- Path alias `@/*` maps to the repo root (`tsconfig.json`).
- Styling via Tailwind CSS v4 through `@tailwindcss/postcss` (`postcss.config.mjs`), global styles in `app/globals.css`.

## Spec-driven workflow

Per README.md, this project follows spec-driven design using `/spec` and `/spec-impl`, based on practices from https://github.com/Klerith/fernando-skills. Skills are added via:

```bash
npx skills@latest add Klerith/fernando-skills
```
