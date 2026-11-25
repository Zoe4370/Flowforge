# FlowForge implementation plan

## Product
FlowForge turns a natural-language goal into an interactive dashboard assembled from an allowlisted widget catalog. It supports prompt generation, follow-up refinement, regeneration, local task toggles, illustrative starter workspaces, and optional CSV-backed generation. The product should be functional and transparent about generated values; no demo script or presentation is in scope.

## Implementation
The React/TypeScript/Vite client uses Express for `/api/generate`. The server supports the managed Manus Preview model and Google's Gemini `generateContent` API for standalone Cloud Run hosting. Credentials remain server-side. Prompts are bounded and validated; returned JSON is validated by shared Zod schemas before rendering. CSV uploads are limited to 12 KB and passed as untrusted data context, not instructions. The app does not persist prompts, CSV contents, or user work to an app database; browser state is session-local.

## Structure
- `src/main.tsx`, `src/App.tsx`: application entry, prompt and CSV input, dashboard state, refinement and export.
- `src/components/`: widget cards, dashboard surfaces, lazy-loaded charts.
- `src/lib/schema.ts`: shared Zod request, dashboard and widget schemas.
- `src/lib/examples.ts`: example prompts and illustrative starter workspace.
- `src/styles.css`: responsive visual system, motion, focus states, CSV controls.
- `server/app.ts`, `server/generate.ts`, `server/index.ts`: Express routes, model calls, validation, static serving and health endpoint.
- `public/manus-routes.json`: single-page route manifest.
- `Dockerfile`, `.dockerignore`: multi-stage Cloud Run container build.
- `README.md`: setup, data handling, and Cloud Run/Gemini deployment.

## Design
Use the supplied near-black/electric-lime visual direction. The interface should feel like a premium instrument panel: dark graphite surfaces; lime reserved for active controls and highlights; readable type; visible keyboard focus; responsive desktop and mobile layouts; restrained motion and reduced-motion support. Avoid decorative stock imagery. Headline: “Build a workspace around your goal.” CTA: “Generate workspace”.

## Delivery
Provide source in the existing public GitHub repository without rewriting history, plus a clean ZIP excluding generated output, dependencies, credentials, and Vercel-specific files. Cloud Run deployment requires the user's Google Cloud project and Gemini runtime secret; do not claim a service URL unless deployment succeeds. No Vercel deployment or LinkedIn publishing is in scope.
