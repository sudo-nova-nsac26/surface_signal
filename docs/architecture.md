# Architecture: public application and scientific backend

SurfaceSignal separates **costly scientific acquisition and analysis** from
**cheap, reproducible public exploration**.

```text
NASA/ISRO NISAR GCOV (ASF) + public environmental data
                           |
         Local Python CLI (acquisition, SAR processing, QA)
                           |
         Original scientific manifests + contextual reports
                           |
                  Publication builder
                           |
    +----------------------+----------------------+
    |                                             |
committed compact JSON/GeoJSON             optional full package
    |                                             |
    +----------------------+----------------------+
                           |
                Next.js source.ts adapter
                    /               \
       Static mode (default)    Read-only FastAPI mode
           Cloudflare Pages      local integration/research
                    \               /
                     PT/EN MapLibre UI
```

## Frontend

Next.js **16**, React **19**, TypeScript, MapLibre GL JS and Tailwind, with
`output: "export"` and trailing-slash routes `/pt/`, `/en/`.
The browser has one data entry point: `frontend/src/data/source.ts`.
With no `NEXT_PUBLIC_API_BASE_URL`, the committed
`frontend/public/data/compact/api/v1/` JSON/GeoJSON serves all 19 scenes
and 17 comparisons without a backend. Setting the variable chooses an
HTTP(S) API instead. `NEXT_PUBLIC_STATIC_SNAPSHOT=full` requires a separately
installed verified full package, not part of a normal clone.

The compact map polygons are explicitly **visualization-only**.
Measured quantities remain those of original scientific statistics, and the UI
never executes HDF5 processing in the browser. OpenFreeMap/OpenStreetMap tiles,
optional Esri imagery and Mapzen terrain are visualization services.

## Backend

Python 3.12, uv, FastAPI read-only HTTP and a separately invoked CLI. No
database, background job queue or NASA network calls from HTTP handlers.
The CLI uses a bounded area of interest, matching compatible acquisition
metadata (including look direction), GCOV real diagonal gamma0 power,
validity/looks filtering, linear-power grid alignment and `10 log10` dB conversion.
Temporal differences and heuristic connected components produce possible
open-water changes and separate generic radar increases/decreases.
Data/context outputs are content-addressed with SHA256 and input provenance.
The API can read published prepared JSON from the compact snapshot on a fresh clone.

## Inputs and boundaries

The current pilot uses NISAR + CHIRPS v3, JRC GSW v1.5, ESA WorldCover
2021 v200, Copernicus GLO-30 DSM, IBGE 2022 meshes and SGB hydrology
bulletins. Their spatial/temporal meanings must remain distinct from
pixelwise field validation. No separate NASA IMERG, ANA, RCM, MapBiomas
or OPERA reference imagery was ingested in the published pilot.

[API contract](api-contract.md) · [Scientific method](scientific-method.md) ·
[Sources](data-sources.md) · [Snapshot delivery](snapshot-delivery.md).
