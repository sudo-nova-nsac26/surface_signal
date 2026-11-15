# Local Analysis and Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Generate reproducible local observations and sourced preparation proposals for residents and municipal teams.

**Architecture:** A dedicated preparation package validates optional local context, assembles deterministic bilingual evidence and plans, and stores immutable verified reports. CLI generation is offline; HTTP and opt-in static publication read prepared reports only.

**Tech Stack:** Python 3.12, Pydantic v2, Shapely, PyProj, existing FastAPI/CLI/filesystem tools; no new dependency.

**Spec:** `docs/superpowers/specs/2026-11-15-local-analysis-preparation-design.md` (owner approved 2026-11-15).

## Global Constraints

- No changes, generated snapshots, dependency installs, builds or other writes under `frontend/`.
- No prediction, operational monitoring, notifications, evacuation orders, route recommendation, confirmed damage/flood labels, population impact estimates, new public license, deployment, push or competition merge.
- No LLM or network call at runtime.
- Write only under `data/preparation/<area_id>/<report_id>/`, with an atomically updated current pointer after complete verification.
- Keep prior reports immutable; no raw HDF5 access or raster reprocessing.
- Both audiences, both languages, separate parameter variants and acquisition groups; null for unavailable measurements.

## Review Focus

- Historical observations must not become present-day directions or claims of official approval (Task 2).
- Context outside observed coverage must never become a negative observation or safety statement (Task 1).
- A warm API must reject stale source data and changed selected-analysis inventories (Task 3).
- An interrupted or over-budget build must preserve the previous current pointer (Task 3).
- A real static export must not include a synthetic preparation build (Task 4).

## Task 1: Bounded context geometry

**Files:** create `backend/src/surfacesignal/preparation/context.py`, `models.py`, `__init__.py`; test `backend/tests/test_preparation_context.py`.
**Interfaces:** `Budgets` positive byte/feature/coordinate/output limits; `read_context(path, budgets) -> dict`; `intersections(context, collection, budgets) -> list[dict]`.

- [x] Write tests using real Point/Polygon/MultiPolygon fixtures: overlapping points produce true membership; polygon edge-only contact gives null overlap with unknown coverage; duplicated polygons do not double area; invalid source metadata, geometry, coordinates, duplicate IDs and exceeded budgets are rejected.
- [x] Run `uv run pytest tests/test_preparation_context.py -q`; observe missing-feature failures.
- [x] Implement strict EPSG:4326 context metadata/geometry validation and projected intersections. Default limits: 25 MB per vector input, 50,000 features, 1,000,000 coordinates, 25 MB complete report output. No valid footprint means negative results remain null/unknown.
- [x] Run focused tests; commit geometry and models.

## Task 2: Evidence and bilingual plans

**Files:** create `preparation/content.py`, `engine.py`; extend `models.py`; test `backend/tests/test_preparation.py`.
**Interfaces:** `assemble(repo, area_id, budgets, context=None, illustrative=False) -> dict` produces `local-analysis.{lang}.json` and `preparation.{audience}.{lang}.json` typed payloads; `guidance(lang, audience) -> list[Action]` uses reviewed official source records.

- [x] Write tests: real-default excludes synthetic, illustrative selects synthetic only; missing context reports unavailable; exactly per-comparison metrics and source times; generic guidance lacks location evidence; conditional municipal tasks require positive intersections and cite exact evidence; all plans proposed and not operational; null is preserved.
- [x] Run focused tests and observe failure before implementation.
- [x] Verify primary government preparation sources; store faithful PT/EN paraphrases, URLs, publisher, retrieval date, content hash, version and human-review-needed status. Implement source/artifact verification and deterministic evidence/plan assembly, no temporal area sums.
- [x] Run focused tests and full backend tests; commit.

## Task 3: Immutable store and read-only API/CLI

**Files:** create `preparation/store.py`; modify `cli.py`, `api/routes.py`; tests `test_preparation.py` and `test_preparation_api.py`.
**Interfaces:** `build_preparation(settings, area_id, *, context_path=None, illustrative=False, budgets=None) -> dict`; `load_preparation(settings, area_id) -> dict`; `verify_preparation(...) -> dict`; `PreparationNotPrepared` and `PreparationInvalid` exceptions.

- [x] Write failures for idempotence, hashes/tampering, extra files, stale area/source/derivative/context, changed analysis selection, invalid IDs, symlinks, output budget, interrupted build, missing prepared resource, GET contracts, invalid language/audience and unsupported writes.
- [x] Implement staging, content identity, exact inventory, immutable reuse and atomic current pointer. Store context snapshot with recorded hash; original import path is not a public dependency. Check byte ceilings before parsing and all output writes. API verifies small prepared inputs and vectors, never rasters/raw data or generation.
- [x] CLI `preparation build|verify --area`, optional `--context`, `--illustrative`, all four budget flags. GET `/areas/{id}/local-analysis` and `/preparation?audience=residents|municipal&lang=pt|en`; missing known build uses `preparation_not_prepared` 404; corrupt/stale uses sanitized 503.
- [x] Run focused tests and full backend tests; commit.

## Task 4: Opt-in publication, real smoke run and handoff

**Files:** modify `publication.py`, `cli.py`, `docs/api-contract.md`, `docs/static-publication.md`, root `AGENTS.md`; create `docs/local-analysis-preparation.md`; extend publication tests.
**Interfaces:** `build_publication(..., include_preparation=False)` adds prepared reports and their provenance to identity only when requested. Query rewriting includes audience and language.

- [x] Write failures: publication/API equivalence for both audiences/languages, default export unchanged, synthetic selection mismatch rejected, incomplete evidence selection rejected, unsafe output cannot replace preparation inputs.
- [x] Implement opt-in verified export within existing byte ceiling; no writes under frontend.
- [x] Run sync, Ruff check/format and full pytest from backend. Perform one bounded real offline build and verify it; inspect all four plans and both local reports. Record real counts and missing external context honestly.
- [x] Obtain independent whole-branch code review, fix important findings with regressions, rerun required checks. Update docs, approved spec status and backend status; commit. Keep branch local for owner review.

## Execution record

Owner explicitly requested execution; continue without another plan-approval gate.
Current feature branch is the authorized isolation; do not create an additional worktree.
Progress and test evidence are recorded below and in commits.

Implementation evidence (2026-11-15): geometry, assembly, store/API and publication tests
were observed failing before their corresponding implementations, then passing.
The backend suite passed 148 tests before final independent review. A real build
contains 17 comparisons, six typed JSON outputs, two Markdown reports and a manifest.
Six real API responses returned 200; a temporary real static export contained 228
files and 147,734,837 payload bytes, with identical reuse verified. No frontend writes.

Independent review completed: two important findings fixed with failing/passing
regressions; no declined judgments or deferred minor findings. Fresh area and
analysis reads avoid timestamp/size cache staleness, including excluded analyses.
Original and derived sizes precede expensive verification. Final required checks:
frozen sync, Ruff lint/format, **151 tests passed**, one existing Starlette warning.
Real build reuse and verification passed after fixes; frontend diff remains empty.
