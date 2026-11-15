# Backend deployment — MVP 0.2.0

Python 3.12 and uv are required. From repository root:

```sh
uv sync --project backend --frozen --extra dev
uv run --project backend --frozen uvicorn surfacesignal.main:app --host 127.0.0.1 --port 8000
```

Swagger: <http://127.0.0.1:8000/docs>; OpenAPI: `/openapi.json`; health: `/health`.
The service is read-only. It never downloads, opens HDF5, or runs analysis in a request.
For another computer copy `config/areas`, `data/catalog`, prepared `artifacts/<id>` and
`data/derived/<id>` to a deployment root; set `SURFACESIGNAL_ROOT` to that absolute directory.
HDF5 and Earthdata credentials are unnecessary. Runtime original manifest metadata, published
GeoJSON and derived manifests/files are sufficient for metadata and vector requests; a missing
optional artifact returns 404. Offline derivation/publication integrity checks require the full
original processed artifact inventory (including the small delta TIFF), never raw HDF5.

Set `SURFACESIGNAL_CORS_ORIGINS='["http://localhost:3000"]'` for Next.js development.
Use the exact deployed frontend origin in production, without wildcard credentials. Origins
are denied by default; only GET is allowed. There are no uploads, accounts or processing routes.
Keep `.env`, `.netrc`, raw data and tokens outside publicly served paths.

Existing Docker support mounts configuration/prepared data read-only and runs as non-root.
Metadata reads are cached using file modification time/size; bounded derived caches verify
small artifacts. Requests do not hash raw files. Artifact responses provide ETags and require
revalidation because the active derivation can change. Serve a content-addressed publication
package with immutable CDN caching only when its URL cannot be reused for another build.

The filesystem MVP is intended for modest prepared catalogs. Listing scans metadata file
inventories; no database, distributed processing or arbitrary-size catalog scalability is claimed.
Run CLI writers serially. Install behind HTTPS/reverse proxy for network deployment; no public
hosting, visibility change or release is performed by this task.
