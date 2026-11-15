# Static publication — 2026-11-15

From repository root (no Earthdata, HDF5 access, or network required):

```sh
uv run --project backend --frozen surfacesignal --root "$PWD" derive build \
  --area vale-do-taquari --threshold-db 3 --min-component-pixels 9
uv run --project backend --frozen surfacesignal --root "$PWD" publish build \
  --area vale-do-taquari --output frontend/public/data/api/v1 \
  --validate --exclude-synthetic --max-export-bytes 250000000
```

The default publication ceiling is 100,000,000 bytes. The complete real vector bundle exceeds
that ceiling; 250,000,000 is an explicit local budget for this dataset. No additional raw inputs
are downloaded. All selected original processed artifacts and derivations must verify before
publication. Missing general derivations fail the build instead of manufacturing zeros.
`--include-previews` copies PNGs when needed; default publication contains no previews or TIFFs.

Publication stages in a sibling directory, validates internal URLs and budget, then renames.
An existing different snapshot is preserved as `v1.backup-<hash>`; the report identifies it.
Serial writers are required; directory replacement has a short rename gap, with rollback on error.
Identical reruns verify exact file inventory/hashes and return the same publication identity.
Unexpected files or tampering cause rejection. Output cannot replace raw data, originals,
derivations, backend, configuration or repository ancestors. Symlinks are rejected.

The report includes source manifest hashes, derived IDs/output hashes, exported file hashes,
counts and bytes. `bytes` excludes the report itself; the byte ceiling includes it. Technical
validation means file/contract integrity only, never scientific validation.

Route mapping:

| HTTP | Static |
|---|---|
| `/api/v1/areas`, `/scenes`, `/analyses` | `areas.json`, `scenes.json`, `analyses.json` |
| `/api/v1/areas/{id}` | `areas/{id}.json` |
| `/api/v1/areas/{id}/overview?lang=en` | `areas/{id}/overview.en.json` |
| `/api/v1/areas/{id}/timeline?lang=pt` | `areas/{id}/timeline.pt.json` |
| `/api/v1/analyses/{id}` | `analyses/{id}.json` |
| `/api/v1/analyses/{id}/story?lang=pt` | `analyses/{id}/story.pt.json` |
| `/api/v1/analyses/{id}/{statistics,layers,evidence,artifacts}` | `analyses/{id}/{name}.json` |
| `/api/v1/analyses/{id}/artifacts/{name}` | `analyses/{id}/artifacts/{name}` |
| `/api/v1/{capabilities,methodology,layers,sources}` | `{name}.json` |
| `/api/v1/stories?lang=en` | `stories.en.json` |

Static URLs use `/data/api/v1/`; language defaults map to `.pt.json`. Indices retain the API's
`items/total/offset/limit` shape but contain all selected records. Static lists are filtered locally;
query filters are not interpreted by a static host. Artifact manifests retain original checksums,
including originals intentionally not copied. Use `artifacts.json` or available layers to discover
published files. The existing `source.ts` API/static switch and water artifact lookup work unchanged.

The former synthetic example is explicitly isolated under `frontend/public/data/demo/api/v1/`.
The full real snapshot is generated locally and distributed as an external bundle; do not commit
its large vectors to Git. On another computer install the bundle at `frontend/public/data/api/v1`
before building Next.js, or set `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000` for API mode.
No variable means static mode. The full static bundle works without Python running.
See `backend-mvp.md` for the measured package size and local delivery location.

## Optional preparation reports — 2026-11-15

After an offline `preparation build`, `publish build --include-preparation` exports
`areas/{id}/local-analysis.{lang}.json`,
`areas/{id}/preparation.{audience}.{lang}.json` and `preparation-manifest.json`.
The manifest remains under the same `areas/{id}/` prefix. Audience defaults to
`residents`, language to `pt`. Existing default exports are unchanged. Exact selected
analysis IDs must match; real-only exports reject illustrative preparation builds.
All files participate in export identity, hashes and byte ceiling. Publication cannot
replace its `data/preparation` inputs. No new snapshot is written to `frontend/` by
this backend delivery. See [preparation operations](local-analysis-preparation.md).
