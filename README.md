# FinnSmart

A beginner-friendly financial intelligence app that tracks news affecting the companies users invest in — not only direct company news, but also news about suppliers, customers, partners, and key dependencies — then explains how each event may ripple back to the stock.

Each stock is shown as its own **living map** (a React Flow "sandbox"). When news hits any connected company, FinnSmart traces the ripple back to your stock with green (positive) or red (negative) flows, and produces a final impact verdict with citations.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The app works immediately with **no API keys** using realistic mock data (NVDA, AAPL, TSLA).

## Going live (Kimi + Bright Data)

Copy `.env.example` to `.env.local` and fill in:

- `KIMI_API_KEY` — Moonshot/Kimi key (OpenAI-compatible, base `https://api.moonshot.ai/v1`, model `kimi-k2.6`)
- `BRIGHTDATA_API_KEY` + `BRIGHTDATA_ZONE` — Bright Data SERP API

The moment both are present the pipeline switches from fixtures to live web research + model scoring with **no code changes** (see `lib/config.ts`).

## How it works (the agent pipeline)

```
Step 1  Relationship graph (pre-built)      data/graphs/*.json  (Kimi swarm can regenerate)
Step 2  Web research per entity (parallel)  lib/integrations/brightdata.ts  (Bright Data SERP, Google News)
Step 3  Mechanical filters (dedupe/noise)   lib/pipeline.ts -> dedupeNews
Step 4  Relevancy & evaluation agent        lib/pipeline.ts -> evaluateEntity (Kimi)
Step 5  Impact analysis / final verdict     lib/pipeline.ts -> buildVerdict (Kimi)
```

Steps 2-4 run in parallel for every connected entity (`Promise.all`); Step 5 combines them into one verdict for the stock.

## Project layout

- `app/` — Next.js App Router UI (`/` dashboard, `/stock/[ticker]` living map) and API routes
- `components/` — UI + `components/map/` React Flow sandbox, custom nodes, impact drawer
- `lib/` — types, config, graph access, the analysis pipeline, integration adapters
- `data/graphs/` — pre-built relationship maps; `data/mocks/` — curated demo news fixtures
- `scripts/generateGraph.ts` — Step 1 stub for generating maps via a Kimi research swarm

## Tech

Next.js 15 (App Router, TypeScript) · Tailwind CSS v4 · React Flow (`@xyflow/react`) · Kimi (Moonshot) via the OpenAI SDK · Bright Data SERP API.
