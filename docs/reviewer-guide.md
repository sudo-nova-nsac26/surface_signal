# SurfaceSignal — reviewer guide

**NASA Space Apps Challenge 2026 · Dancing with the SARs · Sudo Nova**

This guide separates what you can **run and inspect now** from future work. SurfaceSignal is an independent exploratory project, not an official NASA/ISRO product or emergency alert system.

## Explore in five minutes

1. Open [the English website](https://surfacesignal.earth/en/) or [Portuguese website](https://surfacesignal.earth/pt/). Explore the Taquari Valley map, guided explanations and radar-comparison timeline.
2. Select the **11–23 July 2026** comparison to inspect a documented local river-event period, then select other pairs. The dates identify satellite acquisitions, **not** a verified onset/end of flooding.
3. Compare radar **decreases** and **increases**, consult the environmental context and inspect data provenance. The compact polygons are **display subsets**; use the published statistics, not map polygon sizes, for reported areas.
4. Open the [data lab](https://surfacesignal.earth/en/lab/) to examine prepared analysis layers and metadata; read [limitations](limitations.md) before drawing conclusions.
5. Read the [future-work register](future-work.md) for work **not delivered** in this release.

The public website uses committed, precomputed files. It needs no local API, Earthdata account, database, Docker, or HDF5 download.

## What is implemented

| Item | Delivered | Important qualification |
|---|---|---|
| NISAR radar acquisitions | 19 authentic L2 GCOV scenes / 17 historical comparison outputs | Provisional product and heuristic differences; not independent validation |
| Pilot geography | Vale do Taquari, including Lajeado/Estrela region | AOI is an analyst-defined polygon, not a validated impact boundary |
| Offline processing | Bounded GCOV reads, masks, aligned linear gamma0, dB differences, connected components and provenance | Rerunning requires authorized source downloads and substantial disk space |
| Environmental context | CHIRPS v3, JRC GSW, ESA WorldCover, Copernicus DEM, IBGE and dated SGB qualitative context | Different resolution/years; no proof of flood, damage or risk |
| Public application | PT/EN accessible static Next.js interface, compact snapshot, optional read-only FastAPI | Static GeoJSON is visualization-only; no processing inside HTTP requests |
| Audit materials | Test suites, source inventory, scientific method, reproducibility instructions | Automated software tests do not establish real-world detection accuracy |

## Run the submitted source

Requirements: Node.js **24** and npm (see `frontend/.node-version`).

```sh
cd frontend
npm ci
npm test
npm run lint
npm run build
npm run check:static
npm start
```

Then open `http://localhost:3000/en/`. The build exports to `frontend/out/`. Python is only needed for optional API/scientific operations.

Optional backend verification (Python 3.12, uv, from the repository root):

```sh
uv sync --project backend --frozen --extra dev
uv run --project backend --frozen ruff check backend
uv run --project backend --frozen ruff format --check backend
uv run --project backend --frozen pytest -q
```

For backend command details, including working-directory alternatives, see [backend operations](backend-operations.md). No Earthdata credential is required to inspect the committed snapshot.

## How to interpret results

The pipeline measures **radar backscatter changes**. A decrease plus a low-return threshold produces **possible open-water candidates**, not confirmed inundation. Similar radar signals can be caused by vegetation, moisture, geometry, shadow and acquisition characteristics. A generic increase/decrease does not establish deforestation, landslides, structural damage or ground motion.

There is **no independent spatial ground-truth validation** for this pilot. No real-world precision, recall, IoU, F1, number of affected people or operational forecast is claimed. See [method](scientific-method.md), [validation](validation.md), [sources and licensing](data-sources.md) and [limitations](limitations.md).

## Transparency and attribution

Original code and documentation use [Apache-2.0](../LICENSE); third-party satellite data, cartography, imagery, fonts and assets retain separate rights ([NOTICE](../NOTICE)). The project READMEs disclose the use of **Claude Code, Codex and Antigravity**. The Sudo Nova team is responsible for the final software and scientific claims. Neither AI support nor a passing test suite constitutes independent environmental validation.

**Submission links:** [website](https://surfacesignal.earth/en/) · [presentation](https://github.com/sudo-nova-nsac26/presentation/blob/main/Surface%20Signal%20-%20Presentation.pdf) · [team entry](https://www.spaceappschallenge.org/2026/find-a-team/sudo-nova/?tab=project).

**Still to verify manually before the final merge:** external links, production availability, source redistribution terms, competition submission requirements and CI status. See [submission checklist](submission-checklist.md).
