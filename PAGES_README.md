# EZCLICK GO on GitHub Pages

This target builds the existing React presentation with Vite, using the same components and local media. It does not run the server or export private inquiry data.

## Publish

In repository Settings → Pages → Build and deployment, select **GitHub Actions** as Source. Push to main or run **Publish EZCLICK GO** from Actions.

## Local build

Node 24 and pnpm 11.25.0 are used in CI.

```sh
pnpm install --frozen-lockfile
pnpm build:pages
pnpm preview:pages
```

The default base is `/ezclick-go-web/`. CI reads the base from Pages settings, supporting a future custom domain without rewriting image paths. Output: `dist-pages`.

## Forms

The static build deliberately shows an unavailable notice instead of collecting data or sending requests to a missing server. The existing server implementation in `app/api/inquiries/route.ts` is retained for a later full-stack deployment. GitHub Pages cannot run it.

The original Sites build configuration is retained, but requires its hosting manifest and environment. Use the `:pages` scripts for this deployment.
