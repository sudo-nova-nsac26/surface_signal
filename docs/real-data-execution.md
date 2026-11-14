# Real data execution and precise blockers

Python 3.12; asf-search 14.1.0. Available disk at initial check: 59 GiB.

- Public ASF parameter search at the supplied Lajeado point succeeded (20 records, no maturity filter).
- Production CLI search with configured polygon, PROVISIONAL and GCOV succeeded (19 scenes).
- Full filtered snapshot: `evidence/asf-catalog.json`.
  SHA256: `50b0122d96b37a0569eb353e1e1ad0161184f8c2eb4a847fcc192bcfc9a83eaf`.
- Shortlisted compatible pre/post IDs and event-distance ordering are in `evidence/shortlist-july.json`.

| Acquisition UTC | Track / frame / pass | Release | HDF5 bytes reported by ASF |
|---|---|---|---:|
| 2026-07-11 21:33:51 | 53 / 103 / descending | P05023 | 6,996,099,072 |
| 2026-07-23 21:33:50 | 53 / 103 / descending | P05023 | 7,004,487,680 |
| 2026-08-16 21:33:49 | 53 / 103 / descending | P05023 | 7,004,487,680 |

Exact IDs:

```text
NISAR_L2_PR_GCOV_025_053_D_103_4005_DHDH_A_20260711T213351_20260711T213426_P05023_N_F_J_001
NISAR_L2_PR_GCOV_026_053_D_103_4005_DHDH_A_20260723T213350_20260723T213425_P05023_N_F_J_001
NISAR_L2_PR_GCOV_028_053_D_103_4005_DHDH_A_20260816T213349_20260816T213424_P05023_N_F_J_001
```

Stage blocked: authenticated HDF5 access. An unauthenticated HEAD of the July 23 catalog URL
returned **HTTP 403 Forbidden**. EARTHDATA_TOKEN was absent and ~/.netrc did not exist. No
credentials were sought in unrelated files. No HDF5 bytes were downloaded, no actual bands
inspected, no measured radar change or inundation area claimed. Catalog main-band HH/HV
polarization is metadata only; actual HHHH/HVHV layers still need file inspection.

Streaming is documented by ASF but **not verified for these concrete files**, since it also
requires Earthdata authentication. The implemented fallback is one-scene download with
known size, per-file budget, disk reserve, partial-file cleanup, HDF5 signature check and
SHA256 receipt. No remote range-crop guarantee is made. Provider checksum was unavailable;
local SHA256 supports reproducibility, not independent verification against a provider hash.

Next execution: configure your own Earthdata .netrc/token locally, run the README download,
inspect and analyze commands, then review actual channels/masks/quality. Investigate September
only if the July comparison is inconclusive. No unsupported claim that either event must appear.

IBGE polygon requests returned 503. The shipped AOI is a reproducible 5 km buffer in UTM22S
around the supplied point, not an invented administrative boundary. Test AOIs are synthetic.
Docker executable was absent in the authoring host; local Docker build not claimed. CI includes
an actual image build when GitHub Actions is available.

## Complete history runner — 2026-11-14

The preceding observations are preserved as the original execution record. The history
implementation is verified with small, explicitly synthetic HDF5 fixtures. **The real
131 GB batch has not been downloaded or processed by this implementation's author.**
Only record a real run after `history verify` succeeds on the operator's processing PC,
and review its previews, candidate polygons and July SGB bulletin before interpreting results.

| Group | Actual snapshot acquisition dates (UTC) | HDF5 | Bytes | Consecutive candidate pairs |
|---|---|---:|---:|---:|
| Descending, track 53 / frame 103 | 2026-06-17–2026-10-15 | 10 | 69,134,712,832 | 9 |
| Ascending, track 103 / frame 163 | 2026-06-21–2026-10-19 | 9 | 62,251,859,968 | 8 |
| Total | | 19 | 131,386,572,800 | 17 |

All scenes in the fixed snapshot are PROVISIONAL. Its original SHA256 remains
`50b0122d96b37a0569eb353e1e1ad0161184f8c2eb4a847fcc192bcfc9a83eaf`.
The exact sizes and IDs are checked automatically against this snapshot.

On the operator's PC, install Git, uv and Python 3.12, then obtain the implementation branch:

```bash
git remote set-branches --add origin feature/nisar-real-data-demo
git fetch origin
git switch --track origin/feature/nisar-real-data-demo
# For an existing local branch: git switch feature/nisar-real-data-demo; git pull --ff-only
uv python install 3.12
uv sync --project backend --frozen
df -h .

uv run --project backend --frozen surfacesignal --root "$PWD" history run \
  --snapshot docs/evidence/asf-catalog.json \
  --hydro-csv config/hydrology/sgb-2026-07-23.csv --dry-run
```

The dry run writes only local planning metadata, lists the resolved scenes and pairs,
and reports known total/additional/remaining bytes, unknown sizes, free disk per volume and
expected artifact names. For the fixed snapshot, about **180 decimal GB free** is recommended.
The automatic guard sums all still-needed raw bytes and reserves output/temp space; it also
checks the raw and artifact volumes separately when these reside on different filesystems.
The estimate is conservative and does not promise processing duration or output size.

Authenticate using the operator's own [Earthdata account and ASF access](https://nisar-docs.asf.alaska.edu/earthaccess/),
with an official `.netrc` (mode 0600) or a token entered without echo:

```bash
read -rsp 'Earthdata token: ' EARTHDATA_TOKEN
printf '\n'
export EARTHDATA_TOKEN
uv run --project backend --frozen surfacesignal --root "$PWD" history run \
  --snapshot docs/evidence/asf-catalog.json \
  --frequency A --channel HHHH \
  --hydro-csv config/hydrology/sgb-2026-07-23.csv
```

Use `--with-validated-through 2026-11-14` on both commands to include
`NISAR_L2_GCOV_V1` over the same polygon, from the snapshot search start through the end
of that UTC day. The adapter pages, retries and deduplicates official IDs. Mandatory provisional
scenes are retained even when a validated version of the same acquisition appears. Versions
of one acquisition are not compared. Groups require matching area, track, frame, direction,
mode, polarization, release and maturity; singleton groups stay in the report without a pair.
See [ASF collection selection](https://docs.asf.alaska.edu/asf_search/BestPractices/).
Satellite product maturity does not validate the inferred candidate polygons.

The resolved catalog, source snapshot/hash, query/access time, area, frequency, channel,
thresholds, hydrology/hash and implementation/dependency versions are frozen in
`data/history/vale-do-taquari/plan.json`. Identical arguments reuse that plan without ASF access.
To seek later validated acquisitions, increase the date. If validated discovery fails, the
previous valid plan remains intact; run the standard snapshot command to process the 19 first,
then retry the extension later.

After interruption, repeat the same command. Complete HDF5 files with matching SHA256
receipts are retained and reused; the current partial scene may restart. A receipt is persisted
before publishing the final HDF5 name, so interruption during publication can recover the
verified temporary file. The area/work-directory lock releases when the process exits.
Do not remove the lock file to bypass an active run. Hash verification can itself take time
over 131 GB; downloads stream in blocks, and crops obey the area's existing pixel budget.

Progress goes to stderr; the final JSON summary goes to stdout. Checkpoints are written
atomically to `data/history/vale-do-taquari/report.json`, including per-collection counts/bytes,
each raw file and receipt, inspection results, and every pair's `analysis_id` or explicit reason.
The final exit code is 0 only for a complete batch, 3 for incomplete/recoverable/provider
failures, 2 for invalid input, and 130 for keyboard interruption.

The pipeline keeps its seven existing artifacts under `artifacts/<analysis_id>/`. Resumption
checks the manifest itself and every required artifact hash. Cache identity includes scene
metadata, raw hashes, parameters, code/dependency versions, area and applicable hydrological
context. Corrupt outputs are preserved and reported as recoverable failures. Incompatible HDF5,
unavailable channels and absent common valid coverage are explicitly blocked per pair, and
the remaining pairs continue. A batch marked complete may therefore have fewer than 17
successful analyses; review its `pair_counts` and reasons.

Recovery guidance:

- **401/403:** check the operator's Earthdata token or official `.netrc` and ASF authorization;
  rerun after access is restored. Provider response bodies and secrets are not printed.
- **Low disk:** free space on the volume listed by the dry run, retaining the archive elsewhere
  if necessary. All known pending bytes and the reserve must fit before any transfer starts.
- **Unknown size:** refresh the source catalog metadata. Unknown bytes prevent download completion.
- **Raw file without a valid receipt or with a hash mismatch:** preserve it for review. Move
  that HDF5 and its receipt outside `data/raw/` before rerunning to download a fresh copy.
- **Damaged artifacts:** preserve/move the affected `artifacts/<analysis_id>/` directory outside
  `artifacts/`, then rerun. The pipeline reconstructs it from the retained HDF5; never delete
  or overwrite the only copy of the raw data to repair derived outputs.

Verify and collect results without ASF access:

```bash
uv run --project backend --frozen surfacesignal --root "$PWD" history verify \
  --area vale-do-taquari
du -sh data/raw artifacts
unset EARTHDATA_TOKEN
```

The verifier checks the plan/report linkage, full scene/pair inventory, raw sizes/receipts/hashes,
inspection hashes, manifests, required output files and their hashes. The embedded snapshot,
area and hydrological records allow this check without consulting ASF or the original CSV.
Share `report.json` and `artifacts/` through the team's file-transfer method. Retain all HDF5
and receipts on the processing disk, including unpaired/preexisting files. Git distributes
code and catalog metadata; generated archives and credentials stay ignored. Do not commit
tokens, `.netrc`, raw HDF5 or private observations.
