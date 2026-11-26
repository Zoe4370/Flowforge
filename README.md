```text
 ______ _      ______          ________ ____  _____   _____ ______
|  ____| |    / __ \ \        / /  ____/ __ \|  __ \ / ____|  ____|
| |__  | |   | |  | \ \  /\  / /| |__ | |  | | |__) | |  __| |__
|  __| | |   | |  | |\ \/  \/ / |  __|| |  | |  _  /| | |_ |  __|
| |    | |___| |__| | \  /\  /  | |   | |__| | | \ \| |__| | |____
|_|    |______\____/   \/  \/   |_|    \____/|_|  \_\\_____|______|

  type a goal  ->  validated JSON spec  ->  a dashboard that builds itself
```

# FlowForge

FlowForge is a prompt-to-dashboard web app. You describe what you are working on in plain English, optionally attach a small CSV, and the AI returns a layout that the app renders as an interactive workspace of charts, tables, task lists and metrics. Follow-up prompts reshape the same dashboard in place.

Built for AI Vibeathon 2026 (Hack2Skill PromptWars).

## The problem

Most workspace software is fixed. You buy a tool, learn its layout, and then spend the first hour bending it around the thing you actually need to track: a freelance studio this month, a study plan next month, a small side business after that. When the job changes, you rebuild the dashboard by hand or switch tools.

AI assistants have the opposite problem. They can analyse and advise, but their output is a block of text. The answer lives in a chat box while the screen stays exactly as it was.

## Why this approach

The obvious way to close that gap is to let the model write interface code. That is also the unsafe way: generated markup can break the page, inject scripts, or simply fail to render. FlowForge takes a narrower route. The model never writes UI. It returns data that has to match a strict schema describing eight allowed widget types, and the app draws those widgets with its own components. If the model returns something outside the schema, the response is rejected before anything reaches the screen.

That choice gives three properties at once. The output is predictable, because every widget is a known component. It is safe, because there is no model-authored HTML or script to execute. And it is cheap to extend, because adding a widget means adding one schema entry and one component.

## What it does

You write a goal such as "a dashboard for my freelance design studio" and get a workspace of between three and eight widgets: KPI cards, line and bar charts, tables, task lists, progress bars, notes and calendar lists. You can refine it ("add a weekly hours chart, drop the calendar"), regenerate it, tick tasks off, or copy the underlying JSON spec. If you attach a CSV (up to 12 KB), the model is told to use its real columns and values and to avoid inventing totals. Without a CSV, every figure is labelled as illustrative sample data.

## How it works

```text
 browser                               Vercel function                       Gemini API
 -------                               ---------------                       ----------
 goal + optional CSV  --POST-->  validate request (Zod, size caps)
                                 rate limit per client
                                 build prompt, mark CSV as untrusted  --->  generateContent
                                                                      <---  JSON text
                                 parse + validate against schema
                                 (one retry if invalid)
 render known widgets  <-------  200 spec  |  4xx/5xx with a plain message
```

The same Zod schema in `src/lib/schema.ts` guards both ends. The server validates what the model returns, and the browser validates it again before rendering. The API key exists only in the server environment.

## How it maps to the evaluation criteria

| Criterion | What the code does |
| :-- | :-- |
| Code quality | TypeScript in strict mode with unused-code checks, one schema shared by client and server, a framework-free request handler used by both Vercel and the dev server, 16 automated tests, and CI that runs typecheck, tests and build. |
| Security | Strict schemas reject unknown fields and widget types. React renders everything as text, so there is no model-authored markup. CSV content is passed as untrusted data. The Gemini key stays server-side and never appears in URLs or responses. Request bodies are capped at 64 KB, upstream calls time out after 45 seconds, errors are generic, and the response headers include a Content Security Policy. A per-client rate limit applies, though on serverless it is per instance and best effort. |
| Efficiency | No database and no external services beyond Gemini. Charts load in a separate lazy chunk, vendor code is split for caching, fonts load without blocking render, and a failed generation retries at most once. |
| Accessibility | Skip link and a main landmark, visible keyboard focus, labelled form fields, task rows exposed as checkboxes, progress bars exposed as progressbars, text summaries on charts, `role="alert"` on errors, and reduced-motion support in both CSS and Framer Motion. Text smaller than 11px was raised to 11px, and low-contrast greys were lightened. This has not been through a formal WCAG audit. |
| Problem statement | The sections above state the problem, the reason for a schema-bound design, and the limits. The app itself tells users when values are sample data and when a CSV has been sent to the AI service. |

## Run locally

You need Node.js 20 or newer and pnpm.

```bash
pnpm install
cp .env.example .env     # then put your Gemini API key in GEMINI_API_KEY
pnpm dev                 # http://localhost:5173
```

Get a key from [Google AI Studio](https://aistudio.google.com/apikey). `GEMINI_MODEL` is optional and defaults to `gemini-3.8-flash`; set it if you want a different Gemini model. Without a key the app shows a clear setup message instead of a fake result.

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Deploy to Vercel

Import the repository in Vercel and keep the detected Vite settings (`vercel.json` already sets them). Under Project Settings, Environment Variables, add `GEMINI_API_KEY` for the environments you use. Do not prefix it with `VITE_`. Deploy, open the URL and try a prompt. `api/generate.ts` runs as a Node.js function with a 60 second limit, and `vercel.json` also applies the security headers.

## Project layout

```text
api/generate.ts        Vercel function entry (POST /api/generate)
server/generate.ts     prompt, Gemini call, validation, retry, rate limit
server/http.ts         request parsing and response helpers, shared with dev
src/lib/schema.ts      Zod schemas for requests, widgets and dashboards
src/App.tsx            landing page, dashboard, refine bar, CSV input
src/components/        lazy-loaded chart widget
tests/                 schema and handler tests
```

## Data handling

Prompts and CSV contents are sent to the Gemini API to produce a layout and are not stored by this app. Dashboard state and task ticks live in the browser session and disappear on reload. Check generated figures before relying on them: the schema guarantees the shape of a dashboard, not that an AI summary of your data is correct.

## Known limits

Rate limiting is in memory, so a determined client can get past it on a serverless deployment; put an edge rule in front for production use. Refinement sends the full previous spec back to the model, which is simple and reliable but not the cheapest option. Dashboards are not saved between sessions.
