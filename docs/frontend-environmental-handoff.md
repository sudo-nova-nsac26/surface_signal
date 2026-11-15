# Public environmental delivery — handoff for Yuri

Updated2026-11-15. This supersedes the mandatory credential/source assumptions in
`02_HANDOFF_FRONTEND_FONTES_AMBIENTAIS.md`; keep that earlier document as history.

## 1. Architecture and what is reused

The public site is a Next.js 16 static export, not a live Python application. Its
HTML, fonts, map worker, JSON and GeoJSON ship together in `frontend/out/`.
`source.ts` is still the only data entry point. No browser request acquires or
processes scientific datasets. Public sources are checked/fetched offline by CLI,
then enriched into immutable context products and published. Existing camera,
2D/3D unfold and comparison behavior are preserved; visual extensions belong to Yuri.

The compact real snapshot is versioned at `frontend/public/data/compact/api/v1/`.
It includes every published comparison, not a synthetic substitute. By default it
works after cloning without Python, credentials or an external data package.
An optional full snapshot installs at `frontend/public/data/api/v1/`; select it
with `NEXT_PUBLIC_STATIC_SNAPSHOT=full`. Never switch silently on a failed fetch.

API mode remains `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`. If original
prepared stores exist, FastAPI reads them; otherwise it reads an installed full
snapshot or the bundled compact snapshot with file hashes verified per response.
No NASA/ANA/other provider is contacted by an API request. MapLibre basemap and
terrain still use external tile services; source-independent analysis consultation
is not a promise that all basemap tiles work fully offline.

## 2. Contracts: endpoint → static file

Paths below are under `/api/v1` in HTTP mode. Static names are relative to the
selected `/data/compact/api/v1` or `/data/api/v1` root.

| GET endpoint | Static file | Response |
|---|---|---|
| `/areas` | `areas.json` | Page<ApiArea> |
| `/scenes?area_id=` | `scenes.json` | Page<ApiScene> |
| `/analyses?area_id=` | `analyses.json` | Page<ApiAnalysis> |
| `/analyses/{id}` | `analyses/{id}.json` | Analysis detail |
| `/analyses/{id}/environmental-context` | `analyses/{id}/environmental-context.json` | EnvironmentalContextReport |
| `/analyses/{id}/validation` | `analyses/{id}/validation.json` | AnalysisValidation |
| `/analyses/{id}/statistics` | `analyses/{id}/statistics.json` | Typed capability statistics |
| `/analyses/{id}/layers` | `analyses/{id}/layers.json` | Layer index with legends/links |
| `/analyses/{id}/evidence` | `analyses/{id}/evidence.json` | Original evidence/limitations |
| `/analyses/{id}/artifacts` | `analyses/{id}/artifacts.json` | Published artifact URLs |
| `/analyses/{id}/artifacts/{name}` | `analyses/{id}/artifacts/{name}` | Allowlisted prepared output |
| `/analyses/{id}/story?lang=pt` | `analyses/{id}/story.pt.json` | PT/EN story |
| `/areas/{id}/timeline?lang=pt` | `areas/{id}/timeline.pt.json` | Compatible SAR pairs |
| `/areas/{id}/overview?lang=pt` | `areas/{id}/overview.pt.json` | Regional overview |
| `/areas/{id}/environmental-events` | `areas/{id}/environmental-events.json` | Page<EnvironmentalEvent> |
| `/areas/{id}/reference-layers` | `areas/{id}/reference-layers.json` | {area_id,items:ReferenceLayer[]} |
| `/context/sources` | `context-sources.json` | Page<ContextSource> |
| `/sources` | `sources.json` | Legacy inventory, compatible |

The API paginates; static indices contain all records. `source.ts` handles paging,
UTC filtering and URL roots. Acquisition timestamps are ISO UTC; presentation uses
America/Sao_Paulo. `publication-report.json` identifies publication version, file
hashes, source identities and delivery geometry transformations. It is the update
metadata; acquisition time must not be replaced by publication time.

## 3. TypeScript interfaces and additive fields

Authoritative current frontend contracts are `frontend/src/data/api-types.ts`;
backend models are `backend/src/surfacesignal/context/models.py` and OpenAPI.

```ts
import type {
  EnvironmentalContextReport, EnvironmentalEvent, ReferenceLayer,
  AnalysisValidation, ContextSource, ContextAvailability,
} from '@/data/api-types';
// ContextAvailability = available | partial | unavailable | not_checked
// EnvironmentalContextReport: analysis_id, area_id, observed_at, generated_at,
// data_status, synthetic, rainfall, hydrology, historical_water, land_cover,
// topography, sources, validation, limitations, provenance.
// ReferenceLayer: layer_id, status, title, role, reference_year, legend,
// artifact_url|null, source_id, limitations, redistribution_allowed, synthetic.
```

The public-provider revision adds source-specific evidence to existing structures:
CHIRPS daily summaries belong to a labeled daily series, distinct from exact
24/48/72-hour acquisition windows. JRC occurrence is historical frequency, not
contemporaneous water area. Always use actual `source_id`, collection/year and
product semantics returned in context; do not hardcode GPM or MapBiomas labels.
The existing basic panel may not expose all additive summaries; consume the fields
in the delivered JSON/OpenAPI when extending the visual presentation. Source attribution and terms links are preserved per used dataset; the existing panel displays mandatory attribution.

## 4. Obtain the selected comparison

```ts
import {getEnvironmentalContext, listEnvironmentalEvents, listReferenceLayers,
  getAnalysisValidation, listContextSources} from '@/data/source';
const controller = new AbortController();
const report = await getEnvironmentalContext(analysisId, controller.signal);
// on step change/unmount: controller.abort();
```

`useEnvironmental` already keys requests by actual analysis ID, aborts obsolete
requests and loads area events/references once per area. Use `TimelineStep.analysis`
from the existing index; null means no analysis. Never infer an analysis by date or
array position. `0` is a real observation only when explicitly measured; null is
absence. Preserve per-input synthetic status and use `Intl.NumberFormat`.

## 5. Real and illustrative JSON examples

The compact snapshot contains real prepared context for all selected analyses;
open `analyses.json`, take `items[0].analysis_id`, then open the corresponding
`analyses/{id}/environmental-context.json`, `validation.json` and `statistics.json`.
`areas/vale-do-taquari/reference-layers.json` and `environmental-events.json` expose
regional metadata/events. These paths are versioned, rather than copied stale
measurements into this handoff. Actual source-use evidence is in
`docs/public-source-evidence.md`.

The separately labeled `frontend/tests/fixtures/environmental-context.synthetic.json`
is a test fixture only. `public/data/demo/` preserves the earlier isolated synthetic
demo. Neither is an automatic fallback for missing real observations.

## 6. MapLibre layers and geometry quality

Use `artifactUrl`/`getArtifactJson` or the layer index; never form provider URLs in
React. For environmental references, only render published permitted URLs using
`getReferenceGeoJson`; it enforces internal paths and a2MB/5,000-feature cap.
Missing `artifact_url` means textual statistics/reference metadata, not a fake map.

Compact GeoJSON may be simplified and retain only selected shapes under explicit
byte/feature budgets. Check its `delivery` metadata and the publication report for
original hash, feature counts, coordinate precision and tolerance. These are display
derivatives. Scientific area/statistics retain the full-resolution source values and
must not be recomputed from displayed shapes. The full package retains complete
published vectors within Pages'25 MiB per-file ceiling.

Keep stable `env-` IDs, check style readiness, and keep reference opacity independent
of SAR before/after. Never call projection/terrain/camera methods from source cards.
General signal increase/decrease layers retain their own legends and mean no specific
environmental cause. DSM slope is not InSAR movement.

## 7. Availability, errors and sources

404 context_not_prepared: show not prepared.503: show recoverable load failure,
not absence or a demo. Null rainfall is not no rain. A registered/import-ready source
is not used merely because its adapter exists. `report.sources` lists used datasets;
`listContextSources` lists the broader inventory. Source outages affect updates only;
a published snapshot continues working. Source/quality/terms/provenance stay in JSON.

CHIRPS daily labels are not uniform UTC measurement windows. JRC is historical
presence frequency; WorldCover 2021 is a static land-cover map; DSM is surface height
including buildings/vegetation; municipalities denote geometry, not confirmed damage.
SGB narrative bulletins remain qualitative. Independent validation remains absent
unless a qualified spatial/temporal reference exists. Keep the institutional notice.

## 8. Run, test and publish locally

```sh
cd frontend
npm ci
npm run dev
node --test tests/*.test.mjs
npx tsc --noEmit
npm run lint
npm run build
npm start
```

`npm run build` produces and validates `out/`; `npm start` serves plain static files.
Root includes visible PT/EN links with a browser-language selection when JS runs.
No Proxy or Next server is required. For API mode use the existing read-only FastAPI
command and CORS origins in root `.env.example`. No secret belongs in NEXT_PUBLIC_*.

From repository root:

```sh
uv sync --project backend --frozen --extra dev
uv run --project backend surfacesignal sources check
uv run --project backend surfacesignal sources fetch --area vale-do-taquari
uv run --project backend surfacesignal context build --area vale-do-taquari
uv run --project backend surfacesignal publish compact --area vale-do-taquari
uv run --project backend surfacesignal publish full --area vale-do-taquari
uv run --project backend surfacesignal data fetch-snapshot --manifest data/exports/full/snapshot-manifest.json
```

These commands are independent of Bash/Fish variable syntax. Acquiring/updating
context needs prepared scientific products on the operator machine; frontend use
and published read-only API do not need the131 GB HDF5 history. Existing originals
remain immutable and source writers serial. Full snapshot fetch verifies an archive;
it does not acquire raw science data or perform processing.

## 9. Cloudflare and full distribution

See `cloudflare-pages.md` for root/build/output settings and smoke checks. The
compact default is deployable without a release. The full archive/manifest are
prepared locally; owner approval is required before uploading a Release, configuring
its public manifest URL or deploying production. See `snapshot-delivery.md` for
reproduction, SHA verification, safe installation, backups and optional manifest pinning.

## 10. Verification and remaining work

Recorded command results, actual package sizes and source coverage are finalized in
the source evidence and delivery documents. Offline tests never require credentials;
network checks are separated. Remaining visual work includes richer daily CHIRPS/JRC
frequency presentation, any additional authorized map reference overlays, physical
weak-phone/screen-reader checks and independent scientific reference review. No map
or measurement is fabricated to fill those gaps.

## Delivery verified on 2026-11-15

Five real sources were acquired and included in all 17 comparison contexts: CHIRPS 3,
JRC 1.5, WorldCover 2021, CopDEM and IBGE 2022. Numerical river measurements remain
unavailable; existing SGB qualitative bulletins remain separate. CHIRPS1/2/3 labeled-day
sums are available while exact24/48/72-hour acquisition windows remain null.

Compact publication447c73034e0f821ee877e607 includes259 files,9,849,072bytes including
its report. The full local archive is19,969,677bytes and uses version
9e617821fac9fca45ad4c87c. Compact 68 GeoJSON files retain4,149 of 50,432 source features;
46,283 features are omitted for display and the reduction from1,272,999to102,403
vertices is documented per file. The panel explicitly says this is a summarized
map and that measurements use the complete analysis. Use full vectors for full
published geometry, not the compact display subset.

Frontend 13 tests,lint,typecheck,production export and size/hash validation passed.
A clean-input copy with no `.env`, full snapshot or `.next` cache built successfully.
Chrome static desktop/mobile navigation selected all 17steps without JavaScript
errors; all 17 context files loaded and no full-snapshot request occurred in default
mode. JS-disabled root exposes language links. Physical weak-phone and assistive
screen-reader audits remain pending. Detailed final evidence is in
`public-data-delivery-report.md`.
