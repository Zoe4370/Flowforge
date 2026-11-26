```text
 ______ _      ______          ________ ____  _____   _____ ______
|  ____| |    / __ \ \        / /  ____/ __ \|  __ \ / ____|  ____|
| |__  | |   | |  | \ \  /\  / /| |__ | |  | | |__) | |  __| |__
|  __| | |   | |  | |\ \/  \/ / |  __|| |  | |  _  /| | |_ |  __|
| |    | |___| |__| | \  /\  /  | |   | |__| | | \ \| |__| | |____
|_|    |______\____/   \/  \/   |_|    \____/|_|  \_\\_____|______|

  type a goal  ->  validated JSON spec  ->  3D interactive workspace
```

# FlowForge

FlowForge is a prompt-to-workspace generative analytics web app. Describe what you are working on in plain English, optionally attach or drag-and-drop a CSV dataset, and FlowForge returns a schema-validated layout rendered as an interactive 3D workspace of glossy KPI cards, switchable charts (Area / Line / Bar), sortable & searchable tables, editable notes, interactive progress bars, and live checklists. Follow-up prompts reshape the same dashboard in place.

Built for AI Vibeathon 2026 (Hack2Skill PromptWars).

## The problem

Most workspace software is rigid. You adopt a tool, learn its fixed layout, and spend the first hour forcing it around the job you actually have: a SaaS financial pulse this week, an AI SEO traffic funnel next week, or a freelance client pipeline after that. When priorities shift, you rebuild the dashboard by hand or switch tools.

AI chat assistants have the opposite problem. They can analyze a goal or summarize a CSV, but their output stays trapped in linear text. The insight lives in a chat bubble while the user still has no interactive workspace to sort, track, adjust, or export.

## Why this approach

The naive way to bridge that gap is letting an LLM generate raw HTML, JSX, or JavaScript. That introduces XSS risk, broken layouts, and unpredictable rendering failures. FlowForge enforces a **schema-first generative UI boundary**:

1. **Models never write UI code.** Cloud models (Hugging Face Inference Router, Google Gemini, Groq, OpenAI) or the built-in CSV + NLP synthesis engine only output a JSON data specification matching a strict Zod schema (`src/lib/schema.ts`) covering eight allow-listed widget types.
2. **Dual-end validation.** Every response is validated server-side before leaving `/api/generate` and re-validated client-side before React mounts a single component. Unknown widget types or extra properties are rejected.
3. **Zero dead-end execution.** If no cloud API key is configured on Vercel, FlowForge automatically uses its deterministic CSV parser and domain-aware synthesis engine (`src/lib/localEngine.ts`) to compute real totals, averages, peaks, category groupings, and period changes from uploaded CSVs and synthesize or refine workspaces live.

## What it does

- **Prompt-to-Workspace Generation:** Turn any goal into 3–8 interactive widgets (`kpi`, `line_chart`, `bar_chart`, `table`, `task_list`, `progress`, `note`, `calendar`).
- **Real CSV Analytics:** Attach or drag-and-drop a CSV (up to 12 KB), or load the built-in SaaS sample CSV, to compute verified metrics, trend lines, category bars, and sortable tables.
- **Multi-Provider AI Support:** Works with **Hugging Face Inference Router** (`Qwen/Qwen2.5-72B-Instruct`, `meta-llama/Llama-3.3-70B-Instruct`, `mistralai/Mistral-Small-24B-Instruct-2501`), **Google Gemini** (`gemini-2.5-flash`), **Groq**, **OpenAI**, session-only user tokens in the AI Engine modal, and automatic local fallback.
- **Live Interactive Controls:** Switch chart modes (Area / Line / Bar), sort and filter table rows, add tasks inline, adjust progress bars with `+/-`, edit notes, check off calendar milestones, switch between session workspaces, toggle 3D tilt/compact density/focus mode, refine in place, and export specs to JSON or Markdown.

## How it works

```text
 browser                             Vercel functions                     AI / Local Engine
 -------                             ----------------                     -----------------
 goal + optional CSV  --POST----->   validate request (Zod, 64 KB cap)
 (x-hf-token /                       rate limit per client (30/min)
  x-gemini-key opt.)                 select HF / Gemini / Groq / OpenAI -> LLM JSON output
                                     or local CSV + NLP synthesizer     -> validated spec
                                     strict Zod parse + 1 cloud retry
 render 3D widgets    <--200 JSON--  200 DashboardSpec (or structured JSON error)
```

## How it maps to the evaluation criteria

| Criterion | What the code does |
| :--- | :--- |
| **Code quality** | TypeScript with `strict: true`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`. One shared Zod schema (`src/lib/schema.ts`) guards both client and server. Framework-free HTTP handlers (`server/http.ts`) are shared by Vercel functions (`api/generate.ts`, `api/health.ts`) and Vite dev middleware (`vite.config.ts`). Automated test suite (`tests/schema.test.ts`, `tests/generate.test.ts`) + GitHub Actions CI (`.github/workflows/ci.yml`) running `typecheck`, `test`, and `build`. |
| **Security** | Strict Zod schemas (`.strict()`) reject unknown widget types and extra fields so markup/scripts cannot ride along. React renders all values as text with zero `dangerouslySetInnerHTML`. CSV content is marked as untrusted data. Server API keys never enter client bundles (`VITE_` is never used), URLs, logs, or responses. Request bodies are capped at 64 KB, CSVs at 12 KB, model names are regex-validated, upstream calls time out after 40s, rate limiting caps abuse at 30 req/min per client, and `vercel.json` enforces CSP (`default-src 'self'`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`. |
| **Efficiency** | Zero database or runtime bloat. Charts (`recharts`) load asynchronously via `React.lazy` in a separate chunk; vendor code (`react`, `framer-motion`) is manually split for caching. The 3D `<canvas>` stage (`AmbientStage.tsx`) caps DPR at 2 and automatically pauses on `document.hidden` and `prefers-reduced-motion`. Cloud retries are capped at 1, and local CSV/domain fallback runs in single-digit milliseconds. |
| **Accessibility** | Skip link (`#content`), semantic `<main>` / `<aside>` / `<header>` landmarks, visible `2px` focus outlines, labelled inputs and dialogs (`role="dialog"`, `aria-modal="true"`, Escape handling, focus restoration), `role="checkbox"` on tasks, `role="progressbar"` with value attributes, `aria-sort` on sortable table headers, `aria-live="polite"` on the widget grid, `role="alert"` on errors, accessible text summaries on charts, and `prefers-reduced-motion` support across CSS, Canvas, and Framer Motion (`<MotionConfig reducedMotion="user">`). |
| **Problem statement** | Addresses both static-tool rigidity and text-trapped AI output via a schema-bound generative UI. Clearly distinguishes verified CSV calculations from illustrative sample figures, discloses session-only data handling, and documents known architectural limits below. |

## Run locally

You need Node.js 20 or newer and `pnpm`.

```bash
pnpm install
cp .env.example .env     # optional: add HF_TOKEN or GEMINI_API_KEY
pnpm dev                 # http://localhost:5173
```

Run checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Deploy to Vercel

1. Push the contents of `FlowForge-GitHub.zip` to GitHub and import the repository in Vercel (or deploy `FlowForge-Vercel.zip` directly). `vercel.json` preconfigures Vite and Node.js Serverless Functions (`api/*.ts` with `maxDuration: 60`).
2. Optionally add `HF_TOKEN` (Hugging Face) and/or `GEMINI_API_KEY` (Google AI Studio) in **Project Settings → Environment Variables**. Never prefix keys with `VITE_`.
3. Even without environment variables configured, the site works immediately using the built-in CSV & NLP engine, and visitors can optionally supply a session-only token in the **AI Engine** modal.

## Data handling

Prompts and CSV contents are processed to build or refine the active dashboard and are never stored in a FlowForge database. Workspace history and interactive widget edits live only in browser session memory and reset on reload.

## Known limits

- Rate limiting (`isRateLimited`) is stored in-memory per serverless instance, so high-traffic production deployments should add an edge WAF/KV rate limiter in front.
- Refinements pass the current dashboard spec to the model for accurate in-place preservation, which trades extra input tokens for layout stability.
- Workspace history is session-only and does not persist across page refreshes without exporting JSON or Markdown.
