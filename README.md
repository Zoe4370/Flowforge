# FlowForge

FlowForge turns a plain-language goal into a responsive, editable dashboard assembled from a validated widget catalog. Generate or refine a workspace, ground it in an uploaded CSV, interact with task lists, and export the dashboard specification as JSON.

## Run locally

Requirements: Node.js 22.12+ and pnpm 11.25.0.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. In the managed Webdev Preview, the platform supplies the preview AI provider. For a standalone deployment, set `GEMINI_API_KEY` in the server environment. Never expose provider keys through frontend variables or commit secrets. Without AI credentials, the app displays a clear configuration error rather than pretending a request succeeded.

## Use your data

Upload a CSV (up to 12 KB) to generate a dashboard grounded in its contents. CSV text is sent to the configured AI provider for the request and is not stored in an app database. Inspect generated metrics before relying on them; the schema guarantees widget structure, not the accuracy of an AI interpretation. Without uploaded data, generated values are illustrative.

## Architecture

The React and TypeScript client uses Vite. Express serves the client and `/api/generate`. The server supports the managed OpenAI-compatible Manus preview provider and Google's Gemini `generateContent` REST API for standalone hosting. Gemini responses request JSON output; both provider paths are parsed and validated against the shared Zod dashboard schema before rendering. The model cannot generate executable UI code. No database is configured: dashboard state and task toggles remain in the current browser session.

## Deploy to Google Cloud Run

1. Create or select a Google Cloud project, enable Cloud Run and the Cloud Build APIs, and install/authenticate the Google Cloud CLI. Configure billing if Google Cloud requires it for your project.
2. Obtain a Gemini API key through [Google AI Studio](https://aistudio.google.com/apikey). Store it in Google Secret Manager; do not add it to `.env`, source control, or the container image.
3. Deploy from the repository root:

```bash
gcloud run deploy flowforge \
  --source . \
  --region YOUR_REGION \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=flowforge-gemini-key:latest
```

Replace `YOUR_REGION` with a Cloud Run region. Create the Secret Manager secret `flowforge-gemini-key` first, grant the Cloud Run runtime service account permission to access it, and follow the CLI prompts to enable required APIs. `--source .` builds with the included Dockerfile. The service listens on Cloud Run's `PORT` (8080 by default in Cloud Run); `/healthz` returns a readiness response. After deployment, use the service URL printed by `gcloud run deploy`.

For authenticated or restricted services, omit `--allow-unauthenticated` and configure access separately. Public unauthenticated access is a deliberate example setting, not an account-security recommendation. Google AI Studio/Gemini API usage may be subject to quotas and pricing; review the provider terms before choosing a key and plan.

## Checks

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
```

## Notes and official references

- [Gemini API structured output](https://ai.google.dev/gemini-api/docs/structured-output) documents JSON response configuration. FlowForge still validates the received object locally.
- [Cloud Run source deployment](https://docs.cloud.google.com/run/docs/deploying-source-code) documents deploying from source with `gcloud run deploy --source`.
- [Cloud Run environment variables and secrets](https://docs.cloud.google.com/run/docs/configuring/services/environment-variables) documents Secret Manager-backed runtime configuration.
- Sample values are illustrative, not verified facts. Replace them with real data before making decisions.
- `pnpm-lock.yaml` is committed for reproducible dependency installation. No demo script is included.
