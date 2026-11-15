# SurfaceSignal web application

[Official live website](https://surfacesignal.earth) · [Project README](../README.md) · [README em português](../README.pt-BR.md)

Next.js 16, React 19, TypeScript, MapLibre GL JS and an accessible Portuguese/English interface display **real preprocessed** NISAR results and environmental context, without downloading HDF5 in the browser.

## Quick start — static mode (default)

Requires Node.js 24 (`.node-version`) and npm.

```sh
cd frontend
npm ci
npm run dev
```

Open http://localhost:3000/, /pt/ or /en/. **No API, Python, Docker, credentials or new NISAR downloads required.**

```sh
npm test
npm run lint
npm run build
npm run check:static
npm start
```

Static production output: `out/` (Cloudflare Pages). Data are committed under `public/data/compact/api/v1/`: all **19 scene metadata records**, **17 analyses**, environmental summaries and original statistics, plus visualization-only reduced polygons. Display polygons must **not** be used for measuring scientific candidate area. Remote map tiles and terrain still require internet access.

## Optional FastAPI mode

Start the API from repository root (see [operations](../docs/backend-operations.md)). Copy `frontend/.env.example` to `frontend/.env.local` and uncomment:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

The API must permit this site's exact origin through `SURFACESIGNAL_CORS_ORIGINS` in root `.env`. Restart the Next.js dev server. Remove the API variable to return to static data. **Public `NEXT_PUBLIC_*` variables must never contain credentials.**

The application uses a single data boundary (`src/data/source.ts`). The API returns the same data contracts but may read locally prepared scientific stores. With no original scientific artifacts, it can serve the published compact snapshot. No HTTP operation triggers NASA downloads.

Optional **full static** snapshot: install/verify separately and set
`NEXT_PUBLIC_STATIC_SNAPSHOT=full`. Not required for the default website.
See [snapshot delivery](../docs/snapshot-delivery.md).

## Code map

```text
src/app/                 static pages /, /pt/, /en/
src/components/          map, timeline, data/explanation/accessibility UI
src/data/source.ts       API/static JSON adapter
src/data/                 analysis contracts, context and view models
src/i18n/                 language dictionaries
src/preferences/          accessible text/contrast/motion preferences
public/data/compact/     committed real compact data
public/data/boundaries/  map outlines and source credit
scripts/                 worker copy, static export checks and preview
```

The interface separates observed radar changes, environmental hypotheses and independent validation. No confirmed flood/impact is implied by a candidate polygon. See [sources](../docs/data-sources.md), [limits](../docs/limitations.md) and [SEO/GEO](../docs/seo-geo-review.md).
