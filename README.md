# dimensionless
A repository to hold all my explorations, thoughts, insights, experiments, ideas and questions, exploiting GitHub Issues.

## VOID — the app

**VOID** lives in [`void/`](./void) and is a frictionless note-taking app that turns every note into a GitHub issue in this repo. Full setup instructions are in [`void/README.md`](./void/README.md).

### Web / GitHub Pages

The web build of VOID is deployed to GitHub Pages via CI:

- **Live site:** `https://voidconsole.github.io/dimensionless/`
- **Deploy:** `.github/workflows/deploy.yml` runs `expo export --platform web` on every push to `void`/`main`, then publishes `void/dist` through the Pages Actions workflow.
- The app is a single-page app (SPA), so `void/public/404.html` redirects unknown paths back to the app root.

To deploy manually:

```bash
cd void
npm ci
npx expo export --platform web
```

Then publish the `void/dist` folder however you host it.

### Enabling GitHub Actions Pages (one-time)

1. Go to the repo **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Push to the `void` branch. The workflow will build and deploy automatically.