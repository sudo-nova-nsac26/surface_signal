# Static public frontend on Cloudflare Pages

The official site is **https://surfacesignal.earth/**. This guide describes its static build settings and explains how to reproduce a compatible deployment. Development or publishing code does not automatically authorize redistributing third-party scientific datasets.

## Public build

The existing Next.js 16 app uses `output: "export"` and `trailingSlash: true`.
`npm run build` creates `frontend/out`: HTML for `/`, `/pt/`, `/en/`, a static
404, scripts, styles, fonts, the matching MapLibre worker and prepared data.
No Python process, API server, serverless function, authentication, Earthdata
credentials, source-raster download or derivation runs during this build.
Dependencies are installed from the npm lockfile; scientific data and fonts are
already in the repository. Processing remains a separate offline workflow.

From a clean checkout:

```sh
cd frontend
npm ci
npm test
npm run lint
npm run build
npm run check:static
npm start
```

`npm start` is a small local static preview at `http://127.0.0.1:3000`; it does
not run Next's server. Direct `/pt` and `/en` requests redirect to the exported
directory URLs. The root HTML has visible Portuguese/English links and a
`noscript` explanation. With JavaScript, browser language selects `/pt/` or
`/en/` (English fallback). Locale pages retain their own correct HTML language.
The former request-time proxy is removed.

## Pages settings

Use the Cloudflare Pages static Next.js preset (or no framework preset) with:

| Setting | Value |
| --- | --- |
| Repository root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Build output directory | `out` |
| Node version | `.node-version` pins `24.14.0` (also tested locally) |
| Public data environment variables | Unset (compact defaults) |
| Functions / bindings / secrets | None |

An equivalent repository-root build is `cd frontend && npm ci && npm run build`,
with output `frontend/out`. Do not use a Workers adapter, `next start`, or a
blanket SPA rewrite. The exported 404 should remain a real 404. Use a preview branch for configuration changes and review them before merging into the deployment branch. The deployed static site does not need the optional local FastAPI service.

The [Pages build image guide](https://developers.cloudflare.com/pages/configuration/build-image/)
documents `.node-version` and the optional `NODE_VERSION` override; set the latter
to `24.14.0` as well if an existing Pages project overrides repository versions.

Cloudflare documents this mode in its [static Next.js guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/).
Its [Pages limits](https://developers.cloudflare.com/pages/platform/limits/),
checked 2026-11-15, set a 25 MiB maximum per asset and 20,000 files on the Free
plan. `npm run build` checks both limits after export, rejects symlinks, HDF5,
environment/credential files and function entrypoints, and requires locale pages
and the worker. Exceeding a limit fails the build; it does not silently omit an
analysis or upload a large object elsewhere.

## Prepared data modes

The sole data adapter remains `src/data/source.ts`. Default requests are relative
to `/data/compact/api/v1`, served anonymously from the same origin. All 17
published analyses and 19 scenes are retained, including PT/EN stories, numbers,
evidence, context and source provenance. Compact geometries are visualization
derivatives, with their source hashes and simplification parameters recorded in
`publication-report.json`; do not use the drawing to recompute scientific areas.
Missing measurements stay null, and the separate synthetic demo stays labelled.
Export validation checks the compact inventory's SHA-256 hashes, completeness,
internal links and analysis count.

Two explicit alternatives remain available at **build time**:

- `NEXT_PUBLIC_STATIC_SNAPSHOT=full` selects a separately installed, verified
  snapshot at `public/data/api/v1`. It requires no API, but every exported file
  must still pass Pages limits. This is for local or suitable static hosts when
  full vectors exceed the Pages budget. Installation is never part of the
  public frontend build.
- `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000` retains optional API mode.
  Set backend CORS appropriately when testing. This address is embedded in
  browser JavaScript, so it must be reachable **from the user's browser** (loopback is only usable for local development), contain no credentials/query/fragment, and must never contain a token. Leave it unset for the public static site.

Next copies the entire `public` directory, including ignored local packages.
The final build step removes `out/data/api` in default compact mode and removes
compact/full snapshot backup directories, leaving source packages unchanged.
Do not upload an intermediate export from a failed build.

The map still uses external OpenFreeMap basemap tiles and Mapzen terrain on AWS;
these are contextual map backgrounds, not providers of the prepared scientific
results. Network access to those backgrounds is needed for their appearance.
The existing camera, projection, controls and timeline behavior are unchanged.
This does not constitute scientific validation or a confirmed flood map.
