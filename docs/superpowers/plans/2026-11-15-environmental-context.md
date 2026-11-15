# Environmental context implementation plan

> Execute the supplied backend plan and frontend handoff; independent backend processing and frontend work use the dispatching-parallel-agents workflow.

**Goal:** Prepare traceable environmental context offline and present it by comparison in PT/EN.
**Architecture:** Local imports → bounded normalization/enrichment → immutable context snapshots → read-only API and opt-in static publication → existing frontend data adapter and compact panel.
**Spec:** `01_PLANO_BACKEND_FONTES_AMBIENTAIS.md`, `02_HANDOFF_FRONTEND_FONTES_AMBIENTAIS.md`.
**Tech stack:** Existing Python 3.12/Pydantic/FastAPI/rasterio and Next.js/TypeScript.

## Constraints and decisions

- Start from fetched origin/develop at 3920e60, on feature/environmental-data-context. Preserve user-supplied untracked documents. No push or merge.
- User requested implementation of the supplied design and plan; use those as authorization to execute without another design approval.
- Local imports require explicit provenance/terms; absent sources stay unavailable. No credential acquisition or large remote downloads.
- No edits to original SAR artifacts; no flood truth, risk scoring, inferred zeros or DEM-based movement.
- Stable identities exclude execution timestamps; bounded writes are serial and staged.

## Tasks

- [x] Backend core: strict contracts, temporal normalization, import/build/verify CLI, immutable storage and GET routes. Test timezones, duplicates, missing observations, partial rainfall, provenance, budgets and corruption.
- [x] Spatial providers: bounded crops and nodata-aware historical classes/DSM, verified municipal geometry, qualified reference metrics and discovery/readiness. Test CRS, empty coverage, license and temporal eligibility.
- [x] Publication: opt-in prepared context export, HTTP/static parity, independent synthetic filtering, integrity/budget/URL checks. Test missing/corrupt context, idempotence, coexistence with preparation.
- [x] Frontend: API/static adapters, report view model, selected-analysis panel, source status and distinct temporal context. Test zero/null, error versus absence, cancellation, internal URLs and UTC filters; preserve camera behavior.
- [x] Integration: run backend lint/format/tests and frontend typecheck/lint/build; document concrete live-data blockers and tested functionality, update AGENTS and handoff.

## Review focus

Unknown coverage must not become negative evidence; unlicensed imported content must not leak through summaries; synthetic contextual inputs must not enter real-only exports; stale responses must not overwrite a selected comparison; malformed stores must fail visibly rather than fall back to demo.

## Execution record

2026-11-15: fetched origin/develop; existing tracked tree clean, supplied plans untracked. Branch created from current remote develop. Baseline backend verification started. Agents own disjoint core/spatial/frontend files; root owns publication and integration documentation.

2026-11-15: core, spatial and frontend implementation integrated; 172 backend tests and ten frontend tests pass, lint/typecheck/production build pass. Qualified references wired through audited local imports; candidate coverage derives from verified delta masks. Real build/verify: 17 unavailable-context reports; static/API comparison: 34 matched. Desktop PT/mobile PT+EN browser smoke passed. Original artifacts preserved; prior static package backed up. External real-input DOD remains conditional on authorized source acquisition; no live environmental data was invented.

Final review: three findings corrected and confirmed by independent read-only review: canonical metadata cannot be overridden, malformed rendered fields become data errors, and station event identity is independent of acquisition offset. Regression suites pass (172 backend, ten frontend).

Timeline follow-up: distinct environmental markers and rainfall bands wired to both responsive layouts; ten frontend tests, typecheck, lint and production build pass.
