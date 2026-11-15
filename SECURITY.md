# Security policy

SurfaceSignal is an **exploratory research platform**, not an emergency alert service.

Please disclose vulnerabilities **privately** using GitHub's Security → Report a vulnerability feature when available, or contact repository maintainer [@matbdev](https://github.com/matbdev) privately. Do not include secrets or exploit instructions in public issues. No response-time SLA is promised.

- The production static website uses published, non-secret JSON/GeoJSON and never exposes the original NISAR HDF5 files or Earthdata credentials.
- The optional **read-only FastAPI** is bound to loopback locally. Public deployment would require separate TLS, authentication/rate limiting, filesystem permission and CORS review. **CORS is not authentication.**
- **CLI-only** Earthdata credentials may come from an authorized `~/.netrc` (mode `0600`) or local `SURFACESIGNAL_EARTHDATA_TOKEN`/`EARTHDATA_TOKEN`. Never put them in frontend `NEXT_PUBLIC_*` or source control.
- `NEXT_PUBLIC_*` configuration is visible in browser JavaScript. The API URL cannot contain credentials/query/fragment and should point to a deliberately reachable server.
- Never commit `.env` files, tokens, `.netrc`, raw HDF5, private source rasters or restricted geospatial products.
- Respect scientific source terms when redistributing data. Compact map geometries are not suitable for safety decisions or area measurements.

Check `npm test && npm run lint && npm run build` under `frontend/` and `uv run pytest -q` in `backend/`. See [README](README.md), [data sources](docs/data-sources.md), [NOTICE](NOTICE).
