# FinnSmart Agentic Pipeline

Behind the scenes, FinnSmart runs a full agentic pipeline. Each fundamental task is handled by a dedicated agent step. Token Router routes LLM calls to minimize cost; Kimi (Moonshot) powers the reasoning agents.

## Flowchart

```mermaid
flowchart TB
  subgraph trigger["User trigger"]
    A[Search / open stock]
    B[First visit: build map]
    C[Click Analyze · pick horizon]
  end

  subgraph step1["Step 1 — Entity map (once per ticker)"]
    D[Kimi agent swarm · 5 parallel agents]
    D1[Supplier agent]
    D2[Customer agent]
    D3[Partner agent]
    D4[Equity agent]
    D5[Government agent]
    E[(Graph cache<br/>data/graphs/TICKER.json)]
  end

  subgraph llm["LLM routing"]
    R[Token Router → Kimi fallback<br/>lib/integrations/kimi.ts]
  end

  subgraph step2["Step 2 — Live research (parallel per entity)"]
    F[Bright Data SERP<br/>Google News per entity]
    G[Dedupe & rank sources]
    H[VideoDB enrich<br/>YouTube / video transcripts]
  end

  subgraph step4["Step 4 — Entity agents (parallel)"]
    I[Relevancy + ripple analysis<br/>signal · magnitude · summary]
  end

  subgraph step5["Step 5 — Verdict agent"]
    J[Reason over all entity impacts]
    K[Stock outlook · expected move<br/>tailwinds · headwinds]
    L[(Analysis cache<br/>data/analysis/TICKER.json)]
  end

  subgraph ui["UI"]
    M[Living map · React Flow]
    N[Impact drawer · citations]
  end

  A --> B
  B --> D
  D --> D1 & D2 & D3 & D4 & D5
  D1 & D2 & D3 & D4 & D5 --> E
  E --> C
  C --> F
  F --> G --> H --> I --> J --> K --> L
  L --> M --> N

  R -.-> D
  R -.-> I
  R -.-> J
```

## Step summary

| Step | Agent / service | What it does |
|------|-----------------|--------------|
| **1** | Kimi swarm (×5) | Maps suppliers, customers, partners, equity, government/regulators for the target stock |
| **2** | Bright Data | Scrapes live Google News for each connected entity (parallel) |
| **2b** | VideoDB | Transcribes YouTube/video sources; adds transcript to snippets |
| **3** | Mechanical | Dedupes headlines, ranks citations by weight + recency |
| **4** | Kimi (per entity) | Checks relevancy, scores ripple to target stock, writes summary |
| **5** | Kimi (verdict) | Synthesizes final signal, confidence, move range, explanation, drivers |
| **—** | Token Router | OpenAI-compatible gateway; routes LLM calls, falls back to direct Kimi |

## Code entry points

| Step | File |
|------|------|
| Orchestration | `lib/pipeline.ts` → `analyzeStock()` |
| Entity map | `lib/generate-graph.ts` → `generateGraph()` |
| News research | `lib/integrations/brightdata.ts` → `serpNews()` |
| Video research | `lib/integrations/videodb.ts` → `enrichVideoNews()` |
| LLM agents | `lib/integrations/kimi.ts` → `kimiChat()` |
| Config | `lib/config.ts` |

## Parallelism

- **Step 1:** 5 category agents run in parallel (`Promise.all`).
- **Step 2:** All Bright Data SERP calls run in parallel per entity.
- **Step 2b:** VideoDB runs sequentially with a budget (max 3 videos per analyze run).
- **Step 4:** All entity evaluation agents run in parallel after research completes.
- **Step 5:** Single verdict agent consumes all entity outputs.
