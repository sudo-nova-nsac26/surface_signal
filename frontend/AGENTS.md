<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SurfaceSignal frontend — implementation guidance

SurfaceSignal is the published **bilingual, accessible** NISAR radar-change exploration application by Sudo Nova. Official site: https://surfacesignal.earth/ . For setup and environment variables, read [frontend README](README.md) and [main project README](../README.md).

## Design and data contracts

- **Next.js 16**, React 19, TypeScript, MapLibre GL JS, static export under `out/` for Cloudflare Pages.
- `src/data/source.ts` is the source adapter. Default data live at `public/data/compact/api/v1/`, with **19 real scene records and 17 comparisons**. Use `NEXT_PUBLIC_API_BASE_URL` only for intentional, local or deployed read-only API integration.
- **No HDF5 processing or Earthdata token in the browser**. API/static data share read contracts; missing measurements stay `null`.
- Compact polygon geometry is **visualization-only**. Do not calculate authoritative candidate area or feature counts from simplified/trimmed GeoJSON. Show original published statistics and validation markers.
- Radar backscatter differences are **exploratory candidates**, not independently validated flood, landslide, erosion, damage or hazard classifications. Provisional NISAR products and heuristic thresholds demand explicit caveats.
- Environmental context includes CHIRPS v3 SAT date-label rainfall summaries, JRC historical water, ESA WorldCover 2021, Copernicus DEM, IBGE 2022 and qualitative SGB context. Never treat historical or estimated layers as contemporary pixelwise ground truth.
- OpenFreeMap/OpenStreetMap, Esri World Imagery and Mapzen terrain (when enabled) are **visual layers**, not radar scientific input.

## UX and accessibility

- Two localized paths `/pt/` and `/en/`; the `/` entry helps the user select language. Language switching on the map should preserve current view, selections and comparison context.
- Keep map 2D/3D switch, historical timeline, two-period comparison, six curated geographic hotspots, guided tour and full-screen map stage usable on keyboard and compact screens. The optional satellite-photo layer is **2D only**.
- Maintain contrast modes, color-blind palette, reading spacing, large text, reduced motion, listen/read-aloud controls and translated explanations. Test actual behavior; do not claim medical or accessibility certification.
- Timeline comparison identifiers and values must come from prepared data; do not invent rainfall totals, candidate areas, timestamps or orbital telemetry in documentation or UI.
- Present observation, potential interpretation and independent validation as **distinct stages**. Do not use urgent emergency-alert framing.

## SEO and GEO

- Canonical public origin: `https://surfacesignal.earth`; PT/EN alternates, OpenGraph/Twitter, `robots.txt`, `sitemap.xml`, `llms.txt` and accurate JSON-LD data source credits.
- The public dataset summary contains **19 acquisitions / 17 comparisons**, CHIRPS v3 and no blanket CC0 licensing statement. See [SEO/GEO review](../docs/seo-geo-review.md).
- AI-readable metadata is for discoverability only, not a promise of search ranking or citations.

## Verification

From `frontend/`:

```sh
npm ci
npm test
npm run lint
npm run build
npm run check:static
npx tsc --noEmit
```

Follow Next.js 16's installed docs before changing framework-specific APIs. Keep the default compact snapshot usable with no Python or API.
