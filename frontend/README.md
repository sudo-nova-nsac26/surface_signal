# Frontend integration

Place the web application in this directory. The API supports any frontend that can issue
HTTP GET requests. The configuration example below uses Vite.

1. From the repository root, copy `.env.example` to `.env` if you have not created it yet.
   `SURFACESIGNAL_CORS_ORIGINS` must contain the browser page's exact origin, including its
   scheme and port. The example allows `http://localhost:5173` and `http://127.0.0.1:5173`.
2. Start the backend from the repository root with `mkdir -p data artifacts` and
   `docker compose up --build`, or follow the [Python setup](../README.md#run-locally-python-312).
3. For a Vite app, copy this directory's `.env.example` to `.env.local`. Read
   `import.meta.env.VITE_API_BASE_URL` in the frontend. The URL should be reachable from the
   browser. Keep Earthdata credentials in the local CLI environment.

Check the connection from a terminal. The response should include
`Access-Control-Allow-Origin: http://localhost:5173`.

```sh
curl -fsS -D - -o /dev/null -H 'Origin: http://localhost:5173' http://127.0.0.1:8000/health
```

Use [OpenAPI](http://127.0.0.1:8000/openapi.json) and the [API contract](../docs/api-contract.md)
to integrate the UI.

| View | Requests |
|---|---|
| Area selector | `GET /api/v1/areas` |
| Scene catalog | `GET /api/v1/scenes?area_id=vale-do-taquari` |
| Analysis selector | `GET /api/v1/analyses?area_id=vale-do-taquari` |
| Evidence and map layers | `GET /api/v1/analyses/{analysis_id}/evidence` and `GET /api/v1/analyses/{analysis_id}/artifacts` |

Resolve artifact URLs against the API base URL. Use `change-candidates.geojson` as a map layer
and show it as candidate changes in open water. Preserve the evidence validation status and label
synthetic results explicitly. The [offline catalog import](../README.md#run-locally-python-312)
provides scene metadata. The analyses list is empty until the CLI prepares an analysis.
