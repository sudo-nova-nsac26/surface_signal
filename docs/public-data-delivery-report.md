# Public data/static delivery report — 2026-11-15

This report records the verified production-ready snapshot and delivery metrics for the Taquari Valley dataset. The current project site is [surfacesignal.earth](https://surfacesignal.earth/). Scientific raw and derived artifacts were not reprocessed by the snapshot packaging step. A static website deployment does **not** mean that the optional full archive has been publicly released.

## Delivered architecture

Public default: static Next.js 16 HTML/assets on Cloudflare Pages, bundled compact
real JSON/GeoJSON, no backend process or credentials. Optional developer mode:
read-only FastAPI plus explicit offline CLI acquisition/enrichment/publication.
The frontend API/static switch remains in source.ts. All17 published comparisons
are in both snapshots. The full package is optional and independently verifiable.
No frontend build downloads NASA/ANA/scientific products or depends on a future Release.

A clone can use the static frontend immediately after npm dependency installation.
The local API can read the committed compact or installed full snapshot without
scientific artifacts. Updating scientific derivations still requires the prepared
scientific products used by those derivations; the public archive is a delivery
package, not the original processing workspace. No131 GB NISAR download is needed
to consult published results, test the frontend/API, install snapshots or inspect
all summaries/vectors. CLI source checking also uses the versioned ASF metadata
when the ignored local catalog is absent.

## Real sources

| Source | Actual integration | Important limit |
|---|---|---|
| NISAR/ASF | Existing19 scenes/17 processed comparisons reused | Exploratory results, not independent validation |
| CHIRPS v3 final SAT |57 native AOI daily crops and consolidated series for all19 acquisitions | Daily labels do not define exact acquisition-hour windows |
| JRC GSW v1.5 | Native historical occurrence crop1984–2024 | Frequency, not contemporary water area |
| ESA WorldCover | Native10 m AOI crop, 2021 v200 | Static2021classification |
| Copernicus DEM | Native GLO-30 DSM mosaic from two tiles | EGM2008 surface height includes vegetation/buildings |
| IBGE | Official2022municipal geometry/name inventories, three AOI intersections |2023/2024 meshes queried failed;2022 is explicit |
| SGB | Existing dated qualitative bulletins retained | No invented numeric station readings |

The successful public transfers totaled 22,228,099 bytes. All imported inputs are
synthetic=false, license/attribution checked and preserved in public reports, with
source/output SHA256, retrieval/observation periods, product versions, units, QA,
HTTP ranges and ETags in acquisition metadata. See
[actual source evidence](public-source-evidence.md) for endpoint URLs, exact hashes,
resolution, terms and preliminary access failures.

IMERG, ANA, MapBiomas/GEE, Sentinel and RCM remain optional. No new numeric
hydrological measurement or independent spatial validation was acquired. ERA5-Land/
Open-Meteo is optional and was not integrated. Missing data remains null with
limitations. These do not block the public site or other providers.

## Snapshot structure and measured sizes

```text
frontend/public/data/compact/api/v1/    # committed, default
  areas.json / scenes.json / analyses.json
  context-sources.json / sources.json / methodology.json
  analyses/<id>.json
  analyses/<id>/{statistics,layers,evidence,environmental-context,validation}.json
  analyses/<id>/story.{pt,en}.json
  analyses/<id>/artifacts/*.geojson
  areas/<id>/{overview,timeline}.{pt,en}.json
  areas/<id>/{environmental-events,reference-layers}.json
  publication-report.json

data/exports/full/                     # ignored; prepared locally
  surfacesignal-full-9e617821fac9fca45ad4c87c.tar.gz
  snapshot-manifest.json
  snapshot-manifest-9e617821fac9fca45ad4c87c.json
  verification-report.json
```

| Product | Version | Size including report |
|---|---|---:|
| Compact259 files |447c73034e0f821ee877e607 |9,849,072bytes |
| Full259 files unpacked |9e617821fac9fca45ad4c87c |147,901,758bytes |
| Fulltar.gz |9e617821fac9fca45ad4c87c |19,969,677bytes |

Archive SHA256:
`211acf5fa4c607d195533f8390143e13cc7b9c0d220c63cc57df6bbcaf55d06f`.
Compact report SHA256:
`cbfc340bd5005d395150cf72fbc07e8bb37bd3cfca7c88949158ae440c0c0825`.

The compact 68 GeoJSONs retain4,149 of 50,432 source features and102,403 of 1,272,999 vertices.
46,283 smaller features are omitted for display. Each derivative records original
hash/counts, retained counts, simplification and coordinate precision; all original
scientific statistics remain unchanged. The interface explicitly labels summarized
maps. Compact geometry must not be used to recompute scientific area. Full vectors
remain available in the separate package. See [snapshot delivery](snapshot-delivery.md).

## Commands

Frontend only:

```sh
cd frontend
npm ci
npm run dev
npm test
npx tsc --noEmit
npm run lint
npm run build
npm start
```

Offline developer pipeline, repository root:

```sh
uv sync --project backend --frozen --extra dev
uv run --project backend surfacesignal sources check
uv run --project backend surfacesignal sources fetch --area vale-do-taquari
uv run --project backend surfacesignal context build --area vale-do-taquari
uv run --project backend surfacesignal context verify --area vale-do-taquari
uv run --project backend surfacesignal publish compact --area vale-do-taquari
uv run --project backend surfacesignal publish full --area vale-do-taquari
uv run --project backend surfacesignal data fetch-snapshot --manifest data/exports/full/snapshot-manifest.json
```

`--source` can restrict public checks/fetches. Acquisition defaults to100 MB total
network budget and2 million pixels/window; CLI flags can adjust bounded values.
Provider failures are isolated with explicit reasons. `sources fetch --dry-run`
checks access without import. Existing `publish build`, `context ...` and all
scientific CLI commands remain available. Root.envcredentials are optional,
SecretStr-protected and only consumed by backend authenticated workflows.

Compact/full can also be repackaged from an already verified delivery directory
using `publish compact|full --source <directory> --area vale-do-taquari`.
`data fetch-snapshot` uses an explicitly supplied local/HTTPS manifest or configured
SURFACESIGNAL_SNAPSHOT_MANIFEST; the checked-in descriptor has no fabricated URL.
No-argument fetch stays unavailable until the owner publishes/configures a real
release, with an actionable error. It is not part of the frontend build.

## Verification

- Backend Ruff lint/format and the complete offline pytest suite passed; normal
  pytest excludes external tests and uses no credentials: **215 passed, 1 external test deselected**. Tests cover geospatial/temporal semantics, real zero/
  null, per-provider failure, budgets, source identity/attribution, immutable history,
  CLI configuration, published API pagination/CORS/link/ordering parity and snapshot
  corruption/path/link/duplicate/bomb/cache/install protections.
- Explicit separate live network test: 1 passed. All five public endpoints were
  accessible without authentication. Real import/build evidence is separate from
  this lightweight availability smoke.
- Actual17 context builds and verification succeeded. All five general ordering
  modes matched the live API on actual analysis data; returned detail links resolved.
- Actual full package installed into an isolated target with previous contents
  backed up. A second install reused the verified archive and same contents.
  Compact/full deterministic reruns matched versioned products.
- Frontend 13 tests, TypeScript, ESLint, production static build and export validation
  passed. All assets are below Cloudflare 25 MiB and the20,000-file ceiling.
- A clean-input frontend copy without `node_modules`, `.next`, `.env` or the ignored full snapshot
  passed npm ci/build. Local fonts eliminate provider/font downloads during build.
- Chrome plain-static desktop and390×844 mobile smoke passed: PT/EN and JS-disabled entry,
  world→valley, MapLibre canvas/worker, all 17 steps/context files, before/after,
  environmental panel, no horizontal overflow, no page JavaScript errors and no
  default-mode requests to the optional full package.
- Existing npm dependency audit reported7 moderate vulnerabilities; no package updates
  were made in this delivery. Backend warnings are existing dependency/test fixture
  deprecations. Physical weak-phone/screen-reader audits and an actual Cloudflare
  production deployment remain untested.

## Cloudflare and publication

In the existing Pages project: root directory `frontend`, build command
`npm ci && npm run build`, output directory `out`, Node 24.14.0 from `.node-version`.
Leave public data/API environment variables unset for compact default. No bindings,
secrets, Python runtime, Worker adapter or SPA catch-all redirect. Reuse the existing
domain configuration only after owner approval. Full procedure and limits references:
[Cloudflare Pages](cloudflare-pages.md).

For full distribution, the owner approves upload of the generated versioned tar.gz
and matching manifest to a public Release or equivalent HTTPS storage. Build with
`publish full --base-url <approved-directory>` to record intended URLs; this does
not upload or claim publication. After actual upload, configure the public manifest
URL and, preferably, distribute its SHA256 independently. Never replace an existing
version with different bytes. Until then, use the committed compact or local package.

## Files and handoff

Backend additions: `delivery_cli.py`, `api/published.py`, `providers/public_http.py`,
`providers/public_sources.py`, `snapshots.py` and focused public delivery/source/
network/published API/snapshot tests. Changes reuse context models/importer/engine/
spatial/temporal, publication privacy checks, CLI/settings and optional ASF credentials.

Frontend additions: static entry route group, LanguageEntry, local font assets/OFL,
locale helper, static preview/finalization/validation scripts, static export tests and
versioned compact data. Changes remove proxy, configure export, select compact/full/API
at the single data adapter and add truthful source/compact-map labels and additive
environmental TypeScript fields. Existing scientific numbers and camera behavior stay.

Configuration/docs: root `.env.example`, snapshot descriptor, frontend `.env.example`,
`.node-version`, `.gitignore`, CI static job, READMEs, source evidence,
[snapshot procedure](snapshot-delivery.md), [Cloudflare procedure](cloudflare-pages.md) and this report.

Historical validation measurements (before removal of the unused synthetic public-demo fixtures): compact mode 325 files/19,148,748bytes, largest 2,499,427 bytes;
full mode 584 files/167,050,306bytes, largest 11,057,526 bytes. Both pass the Pages
25 MiB individual-asset check. The final output was restored to compact default.
The largest full artifact is an 11.06 MB general-change GeoJSON; it required no scientific
geometry alteration to fit Pages. The frontend's 13 tests, TypeScript and lint were
rerun with the final summarized-map notice.

Clean-clone publication protection: `publish compact` verifies/reuses the existing
compact snapshot when scientific stores are absent; it never replaces it with an
empty export. `publish full` requires an installed full delivery or prepared
scientific outputs and rejects promotion of compact display subsets to full data.
