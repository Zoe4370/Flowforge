# TODO

- [x] Generate and refine validated dashboards. Users can enter a dashboard goal in plain language and choose from example prompts. A server-side AI request returns a structured dashboard specification validated against an allowed widget catalog. Users can refine or regenerate a dashboard with follow-up prompts. If AI is unavailable, the interface explains how to recover and keeps a usable starter workspace available.
- [x] Render the interactive widget catalog. Generated dashboards use metrics, charts, tables, task lists, progress indicators, notes, and calendar items. Data is plausible sample content rather than user records. Task-list checkboxes remain usable in the browser.
- [x] Ground generation in an optional CSV upload up to 12 KB. CSV content is sent to the configured AI provider for generation, treated as untrusted data, and is not stored by an app database.
- [x] Deliver a responsive and accessible experience. The interface follows the supplied near-black, electric-lime visual direction, works across desktop and mobile widths, exposes visible keyboard focus, and respects reduced-motion preferences.
- [ ] Package and document the app. Include source code and setup/deployment instructions in a GitHub-ready ZIP, without secrets or bulky generated folders. The README explains architecture, data handling, environment setup, and Cloud Run deployment. Exclude the demo script.
- [ ] Push project source to the existing public GitHub repository while preserving its LICENSE and remote history.
- [ ] Deploy to Google Cloud Run and provide its URL only after successful deployment. Deployment requires a Google Cloud project and Secret Manager-backed Gemini API key; do not claim completion without these credentials and a successful deployment.
