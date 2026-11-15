# Architecture

One Python package, one read-only FastAPI process and one explicitly invoked CLI.
Pydantic domain contracts connect providers, processing, atomic JSON storage and API.
No Postgres, Redis, Celery or BackgroundTasks. Heavy external data access never runs inside HTTP.

Catalog snapshots are atomic JSON files per area under data/catalog. Analyses stage outputs
in a hidden temporary directory then atomically rename the directory after writing a validated
manifest. Content-derived analysis IDs include input SHA256, parameters, area, software versions,
scene metadata and hydrology. Repeated runs reuse outputs only after verifying artifact hashes.

The API lists prepared local content, paginates at <=200 items, validates filters and exports
OpenAPI at /openapi.json. Error bodies exclude raw file/provider content. Artifact filenames
have an allowlist and resolved-path containment check. CORS is empty by default. Docker is
non-root/read-only and binds only localhost on the host. Multiple concurrent worker writers
are not supported by this MVP; CLI jobs should run serially.

JSON is suitable for this small demo, not a large production catalog. A storage repository
adapter/SQLite migration and scalable job scheduling can be added after data validation.

Published prepared JSON/artifacts are 0644 and completed analysis directories 0755 so a
different non-root Docker UID can read the bind mount. Staging remains private until ready.
These outputs must not contain credentials/private observations. Ensure parent host directories
are traversable; a restrictive custom umask or private parent may require explicit owner setup.

## MVP extension — 2026-11-15

`api/service.py` shares prepared-data reads/aggregation between FastAPI and `publication.py`.
`api/routes.py` and `api/schemas.py` hold the new typed routes; `main.py` retains compatible
original routes and app factory. `processing/general_change.py` creates isolated derivations;
`processing/capabilities.py` registers honest scientific availability. `interpretation/` contains
models, versioned PT/EN content and deterministic rules. No frontend components were rebuilt.
The published vector bundle is deliberately outside Git; see static-publication.md.
