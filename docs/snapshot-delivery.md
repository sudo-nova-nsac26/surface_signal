# Compact clone and full snapshot delivery

SurfaceSignal has two public, prepared-data delivery modes. Neither needs HDF5, Earthdata credentials, a private directory or Python while browsing the static site. The compact snapshot is versioned in Git. The full snapshot is generated locally as a reproducible archive, then uploaded only after repository owner approval. No release URL is invented when nothing has been published.

## Clone and run

```sh
cd frontend
npm ci
npm run dev
```

The default data root is `/data/compact/api/v1/`. The snapshot contains all 19 catalog scenes, 17 published analyses, PT/EN stories, original statistics, environmental summaries and bounded display geometry. Missing measurements remain `null`; original sources and synthetic labels are preserved. The separate synthetic demonstration is unchanged.

Compact geometry is explicitly `visualization_only` and `not_for_measurement`. Each GeoJSON records its original SHA256, original/display feature and coordinate counts, omitted features, simplification tolerance and coordinate precision. The default keeps at most 100 of the largest polygons per file, simplifies with topology preservation, rounds to six decimal places and targets at most 125,000 bytes per geometry file. Parameters and losses are recorded, including when the bound requires a larger tolerance or fewer polygons. This can omit small candidates. Original scientific statistics and per-feature properties are never recalculated from the display geometry. Artifact digest maps inside scientific records remain hashes of the original scientific sources; `publication-report.json.files` always hashes actual delivered files.

## Build prepared derivatives offline

From `backend/`, after serial derivation and context preparation:

```sh
uv run surfacesignal publish compact --area vale-do-taquari
uv run surfacesignal publish full --area vale-do-taquari
```

These commands first build a verified real-data publication at `frontend/public/data/api/v1` (ignored by Git), including available environmental context. To reuse a previously prepared publication without scientific source stores:

```sh
uv run surfacesignal publish compact --area vale-do-taquari --source ../frontend/public/data/api/v1
uv run surfacesignal publish full --area vale-do-taquari --source ../frontend/public/data/api/v1
```

Default compact output is `frontend/public/data/compact/api/v1`; default distribution output is `data/exports/full`. All outputs are validated before replacing a directory. Prior snapshots are preserved as deterministic `.backup-<hash>` siblings; original artifacts, context snapshots and derived science remain immutable. Writers must run serially.

The public snapshot inventory must match its report exactly. JSON/GeoJSON/PNG are the only allowed payload types. No symlinks, raw inputs, local source paths or credential-bearing URLs are accepted. PNG previews, when explicitly included by the original publication job, have a 16-million-pixel limit. Compact output defaults to 16 MB overall and 2 MB per file. Full output defaults to 300 MB overall and 25 MiB per file. The latter matches [Cloudflare Pages' documented single-asset limit](https://developers.cloudflare.com/pages/platform/limits/#file-size), checked 2026-11-15. The current full files fit this limit, so the full package retains their original bytes; a larger future file fails rather than silently changing scientific geometry.

## Versioned full archive

The full builder emits `surfacesignal-full-<version>.tar.gz`, `snapshot-manifest-<version>.json` and `snapshot-manifest.json`. The version hashes the canonical inventory and limits. Every member has a byte count and SHA256 in the manifest. USTAR members are sorted, have fixed permissions, zero owner IDs and zero timestamps; gzip has a zero timestamp and no embedded filename. Identical inputs therefore produce identical archive bytes. The manifest contains the archive's SHA256 and byte count.

The local builder always records `published: false` and `publication_status: prepared_not_uploaded`, because creating a descriptor does not establish a public release. Without `--base-url`, the URL is `null`. A maintainer can prepare a descriptor for a planned anonymous public directory:

```sh
uv run surfacesignal publish full --area vale-do-taquari --source ../frontend/public/data/api/v1 --base-url https://YOUR-APPROVED-HOST/RELEASE-DIRECTORY
```

`--base-url` only records the intended URL. It does not upload anything. Uploading/releasing remains an owner-approved action. The archive may exceed the per-asset Pages limit; store it as a release asset or another public download service, not as a Pages site asset. The individual installed files respect the site limit.

## Download and install

Once a real public release exists:

```sh
cd backend
uv run surfacesignal data fetch-snapshot --manifest https://YOUR-APPROVED-HOST/RELEASE-DIRECTORY/snapshot-manifest.json --manifest-sha256 MANIFEST_SHA256_FROM_A_TRUSTED_CHANNEL
```

A local distribution can also be installed offline:

```sh
uv run surfacesignal data fetch-snapshot --manifest ../data/exports/full/snapshot-manifest.json
```

The optional independently obtained manifest digest pins the descriptor as well as its contents. Without that pin, trust depends on the HTTPS host; hashes establish consistency, not independent authenticity. `config/snapshot-manifest.json` contains no fabricated public URL; fetching without a configured release fails with an actionable message.

Download uses anonymous HTTPS, never Earthdata, environment credentials or proxy configuration. HTTP is accepted only for loopback testing. Signed query URLs, URL credentials, cookies and unexpected HTTP content compression are rejected. Redirects are bounded and revalidated. The download limit defaults to 100 MB compressed, the installed limit to 300 MB, each file to 25 MiB, and the inventory to 20,000 files. Callers may lower budgets. Expanded tar headers, padding and trailing gzip members also count against the decompression budget.

Verified archives are cached by SHA256 under `data/snapshot-cache/`. Every reuse rechecks size and SHA256; extraction is always validated anew. Only USTAR regular files explicitly named in the manifest are accepted: no traversal, absolute paths, Windows separators/drives, links, extension headers, duplicate members, unexpected members or missing files. Extraction never uses `extractall`. JSON is validated, duplicate keys rejected, PNG bounds checked, the publication inventory verified and internal links resolved before installation. A failure leaves the prior installed snapshot untouched. A successful replacement retains a deterministic backup.

To use the installed full files in the site, set `NEXT_PUBLIC_STATIC_SNAPSHOT=full` when building/running the frontend. The default continues to use the checked-in compact snapshot. `NEXT_PUBLIC_API_BASE_URL` selects the optional read-only API mode.

## Verification

`backend/tests/test_snapshots.py` exercises deterministic builds, display provenance/science preservation, safe local and anonymous HTTP installation, cache reuse, corrupt hashes/manifests, exact inventories, lowered budgets, tar traversal/absolute/Windows paths, duplicate members, symlinks/hardlinks, unexpected/missing files, trailing data, decompression expansion and preservation of previous snapshots. No network credentials or source rasters are needed for these tests.

## Local verification record — 2026-11-15

The attributed public-source snapshot was rebuilt and checked locally without publishing a release:

| Output | Verified result |
| --- | --- |
| Compact publication | `447c73034e0f821ee877e607`; 17 analyses, 19 scenes, 259 delivered files including report; 9,849,072 bytes; largest file 783,160 bytes |
| Compact report SHA256 | `cbfc340bd5005d395150cf72fbc07e8bb37bd3cfca7c88949158ae440c0c0825` |
| Full version | `9e617821fac9fca45ad4c87c`; 259 files; 147,901,758 expanded bytes |
| Full archive | `surfacesignal-full-9e617821fac9fca45ad4c87c.tar.gz`; 19,969,677 bytes |
| Archive SHA256 | `211acf5fa4c607d195533f8390143e13cc7b9c0d220c63cc57df6bbcaf55d06f` |

Across the 68 compact geometry files, 50,432 original features become 4,149 display features; 46,283 are omitted. Coordinate counts change from 1,272,999 to 102,403. Each file carries its own losses and original checksum. These display subsets do not change the reported scientific statistics.

Both outputs reproduced exactly on a second build. The full archive was installed into an isolated temporary root, its previous snapshot was preserved, and a second installation verified and reused the cached archive and complete installed snapshot. The local machine-readable proof is `data/exports/full/verification-report.json` (ignored by Git). No archive was uploaded, no public URL was claimed and no source artifacts were changed by packaging.

When scientific artifact stores are absent on a clean clone, the convenience CLI
reuses an installed full snapshot or verifies the bundled compact in place.
It never overwrites the default compact with an empty scientific export. A compact
display subset cannot be promoted to a full delivery; install the full archive first.
