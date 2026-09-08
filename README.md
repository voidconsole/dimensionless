# dimensionless
A repository to hold all my explorations, thoughts, insights, experiments, ideas and questions, exploiting GitHub Issues.

## VOID — the app

**VOID** lives in [`void/`](./void) and is a frictionless note-taking app that turns every note into a GitHub issue in this repo. Full setup instructions are in [`void/README.md`](./void/README.md).

### Web / Netlify

The web build of VOID is deployed via Netlify:

- **Deploy:** `netlify.toml` (repo root) has the build command (`expo export --platform web` with `base = "void"`) and publish dir `dist`. Connect the repo in Netlify, or run `netlify deploy`.
- The app is a single-page app (SPA), so `void/public/_redirects` (`/* /index.html 200`) routes unknown paths back to the app and `void/public/404.html` is a final fallback.

To build and preview locally:

```bash
cd void
npm ci
npx expo export --platform web
npx serve dist
```