# SurfaceSignal development

This project contains a private exploratory prototype.
Do not merge this prototype into a competition submission without documented GO Team clearance.
Preserve dates/history. Keep main stable; target develop in draft PRs. Use Conventional Commits.

Python 3.12, FastAPI/Pydantic v2, offline processing via CLI; read-only API.
From backend: `uv sync --frozen --extra dev`, `uv run ruff check .`,
`uv run ruff format --check .`, `uv run pytest -q`.

Never commit credentials, Earthdata tokens, .netrc, heavy HDF5, raw private data.
Only real diagonal GCOV power terms use 10*log10. No inferred flood truth from a threshold.
Require comparable scene metadata and enforce memory/download budgets.
Mark synthetic data explicitly. Every output must preserve sources, parameters and hashes.
No public license or visibility change without repository owner authorization.
