# Public data and static delivery implementation plan

**Goal:** A credential-free clone and static public site with prepared results, plus optional offline scientific updates.
**Spec:** User's SurfaceSignal revised architecture request, 2026-11-15 (this supersedes mandatory-source assumptions in the earlier environmental plan).
**Architecture:** Reuse CLI/context manifests, read-only FastAPI, immutable SAR artifacts and exporter. Prepare public environmental summaries offline. Version a small real snapshot; package full results separately with deterministic hashes and a bounded anonymous installer. Next.js exports HTML/assets for Cloudflare Pages.
**Stack:** Existing Python 3.12/FastAPI/Pydantic/rasterio and Next 16/MapLibre; no permanent backend or heavy new runtime.

## Decisions and reuse audit

- Branch created from fetched origin/develop3920e60, with prior environmental commits reapplied (45057b3,6f7b715,2f67df0). No history rewritten.
- Existing imports, temporal/spatial calculations, context storage/API and frontend panel reused; visual integration remains Yuri's responsibility.
- Public raster/statistical sources are verified before integrating. Failed or temporally unavailable products stay absent with evidence. CHIRPS daily labels cannot be silently equated to exact acquisition-hour windows.
- Existing17 comparisons/19 scenes, derived artifacts and raw HDF5 remain immutable; no NISAR download/reprocessing.
- No push, release, production deploy, remote asset overwrite or visibility/license change.

## Tasks and evidence

- [x] Public sources: check/fetch public HTTPS products with bounded access and per-provider failure isolation; import real AOI products and document access, dates, terms, resolution, transformations and source hashes.
- [x] Snapshots: versionable compact bundle; deterministic full tar.gz + version/URL/SHA manifest; safe bounded fetch/install/reuse; static/API matching schemas and explicit visualization-only optimization metadata.
- [x] Static frontend: local fonts, export-compatible root language routing and pt/en pages; preserve API mode, bundled compact default; per-file Cloudflare limit checks; no build-time provider downloads.
- [x] CLI/configuration: sources check/fetch, context build default all, publish compact/full, data fetch-snapshot; backward compatibility; optional .env credentials backend only.
- [x] Integration/docs: offline tests, explicit network evidence, clean-clone-like static build, site smoke, documented full package procedure/Cloudflare/Yuri handoff and actual blockers.

## Review focus

Scientific temporal/spatial semantics and missing values; independent provider failure; secrets in outputs; archive traversal/symlinks/duplicates/bombs; stale cache verification; compact geometry precision and report hashes; no hidden untracked files needed by clone; individual Pages25 MiB file ceiling.

## Progress

2026-11-15: baseline inspected; old context feature preserved via additive commits on requested new branch. Three independent implementation agents own public providers, snapshot delivery and frontend export. Root owns CLI/.env wiring and integration/handoff.

2026-11-15 verification: five real public products acquired (22,228,099successful HTTPS bytes),17 contexts rebuilt/verified, compact447c73034e0f821ee877e607 contains all 17 analyses19 scenes with mandatory source credits,9,849,072bytes; full9e617821fac9fca45ad4c87c archive19,969,677bytes. Real isolated full install+cache reuse+deterministic reruns verified. Static frontend clean-input build and plain-static desktop/mobile smoke passed;13frontend tests. API review findings (general-metric/acquisition sorting and followable links) fixed with regression tests and actual17-analysis ordering parity. Exact final test totals in public-data-delivery-report.md. No push/release/deploy.

Final evidence: 215 offline backend tests passed (1 external deselected), separate live HTTPS test passed, 13 frontend tests passed. Compact325files/19,148,748bytes and full584files/167,050,306bytes exports passed; largest full asset11,057,526bytes. Actual bundle installer reuses verified archive and preserves backup; public Release/deploy remain owner-controlled.

Clean-clone publish regression: compact verified/reused, full-from-display-subset rejected; normal sources check dates fall back to versioned real ASF metadata.
