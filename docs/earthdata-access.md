# NASA Earthdata authentication and NISAR download

This is an **operator-only** workflow for acquiring and processing original NASA–ISRO NISAR L2 GCOV HDF5 files. **Neither the public site nor the read-only API requires Earthdata credentials** when using the committed compact snapshot (19 scenes and 17 comparisons).

Never send credentials in chat, GitHub issues, logs, screenshots or commits. Each operator uses their own authorized Earthdata account. The root `.env.example` is a template, **not** a place to save tokens.

## 1. Register and prepare the machine

1. Register or sign in at [NASA Earthdata Login](https://urs.earthdata.nasa.gov/).
2. Confirm your account is authorized for [ASF's NISAR collection](https://nisar-docs.asf.alaska.edu/asf-search/). Authorize the applicable ASF application in Earthdata if requested when accessing the data.
3. Install **Python 3.12** and [uv](https://docs.astral.sh/uv/), clone the [SurfaceSignal repository](https://github.com/sudo-nova-nsac26/surface_signal), and use the repository root for the commands below.
4. Check your disk budget: the recorded **19 original HDF5** total **131,386,572,800 bytes (~131.39 GB)**. Allow approximately **180 GB free** for input, processing, temporary files and reserves; the CLI checks required space before transferring.
5. The saved ASF catalog `docs/evidence/asf-catalog.json` is in Git and can be inspected **without** logging in.

Official sources: [ASF download authentication](https://docs.asf.alaska.edu/asf_search/downloading/), [NASA Earthdata .netrc instructions](https://urs.earthdata.nasa.gov/documentation/for_users/data_access/curl_and_wget), [NISAR data access guide](https://nisar-docs.asf.alaska.edu/earthaccess/).

## 2. Recommended: configure `.netrc` outside the repository

On Linux/macOS, in **fish, Bash or Zsh**, create a credential file in **your home directory** and restrict permissions before adding a secret:

```sh
touch ~/.netrc
chmod 600 ~/.netrc
```

Open `~/.netrc` with a local editor (e.g. `nano ~/.netrc`), and use this syntax with your **own** credentials:

```text
machine urs.earthdata.nasa.gov
  login YOUR_EARTHDATA_USERNAME
  password YOUR_EARTHDATA_PASSWORD
```

Save, then check permissions **without printing the contents**:

```sh
chmod 600 ~/.netrc
ls -l ~/.netrc
```

The permissions should begin with `-rw-------`. Preserve any existing `.netrc` machine entries; never replace unrelated credentials. Some special password characters require escaping: follow the official Earthdata guide.

On **Windows**, NASA-supported guidance uses a home-directory `_netrc` instead; follow the [Windows _netrc setup and permissions](https://nsidc.org/data/user-resources/help-center/creating-netrc-file-earthdata-login). Do **not** copy `_netrc` into the Git checkout.

ASF's `asf_search` client supports `.netrc`-based authentication. If you use `.netrc`, an Earthdata environment token is normally unnecessary.

## 3. Alternative: a temporary Earthdata token

If you use an authorized Earthdata Login token, the project's Python settings accept `SURFACESIGNAL_EARTHDATA_TOKEN` or the legacy `EARTHDATA_TOKEN` alias. Enter tokens interactively, **not** by including the literal value in a command.

For **fish**:

```fish
read --global --export --silent --prompt-str 'Earthdata token: ' SURFACESIGNAL_EARTHDATA_TOKEN
```

For **Bash / Zsh**:

```bash
read -r -s -p 'Earthdata token: ' SURFACESIGNAL_EARTHDATA_TOKEN
printf '\n'
export SURFACESIGNAL_EARTHDATA_TOKEN
```

These variables are temporary for the current shell. **Do not use fish universal variables** for secrets, and do not display your shell environment publicly. Remove the token after running:

```fish
# fish
set --erase --global SURFACESIGNAL_EARTHDATA_TOKEN
```

```bash
# Bash / Zsh
unset SURFACESIGNAL_EARTHDATA_TOKEN
```

The CLI passes configured tokens to the ASF session explicitly; if a token is invalid it can cause authentication to fail even with a correct `.netrc`. Never put credentials into `frontend/.env.local` or any `NEXT_PUBLIC_*` variable: those may be included in client-side JavaScript.

## 4. Dry run (no satellite files downloaded)

From the **repository root**:

```sh
uv sync --project backend --frozen --extra dev
df -h .

uv run --project backend --frozen surfacesignal --root "$PWD" history run \
  --snapshot docs/evidence/asf-catalog.json \
  --hydro-csv config/hydrology/sgb-2026-07-23.csv \
  --dry-run
```

The CLI previews original scene identifiers, compatible pairs, remaining raw bytes and disk space. A dry run may update local **planning metadata**, but will **not** download HDF5. Adding validated products is a distinct optional mode described in [real-data execution](real-data-execution.md); do not mix datasets or maturity releases silently.

## 5. Authenticated download, processing and offline verification

After configuring **your own** Earthdata access:

```sh
uv run --project backend --frozen surfacesignal --root "$PWD" history run \
  --snapshot docs/evidence/asf-catalog.json \
  --hydro-csv config/hydrology/sgb-2026-07-23.csv
```

This downloads HDF5 into the ignored local raw-data store, verifies file/scene identity and hashes, and processes compatible temporal pairs into ignored `artifacts/`. The history runner reuses verified completed work when inputs and processing parameters match.

Then, **without needing network authentication**, verify the complete history:

```sh
uv run --project backend --frozen surfacesignal --root "$PWD" history verify \
  --area vale-do-taquari
```

Inspect `data/history/vale-do-taquari/report.json` and the command response. The expected recorded series contains **19 scenes and 17 pairs**; ensure `verified` and `completed` are true and `errors` is empty. This verifies file and software integrity, **not** independently confirmed floods or scientific accuracy.

Never commit raw HDF5, operator credentials, `.netrc`, generated private products or secret-bearing logs. Use [reproducibility](reproducibility.md), [scientific method](scientific-method.md) and [validation](validation.md) to interpret the results.

## 6. Context sources and deployment are separate tasks

- **CHIRPS v3 SAT, JRC water history, ESA WorldCover, Copernicus DEM, IBGE and SGB:** see [actual sources and usage terms](data-sources.md) and [acquisition evidence](public-source-evidence.md). These public environmental sources were acquired separately from authenticated NISAR HDF5.
- **Build and verify environmental context:** [backend operations](backend-operations.md) and [environmental integration](environmental-data-integration.md).
- **Distribute prepared scientific results:** [compact and full snapshots](snapshot-delivery.md), [static publication](static-publication.md), and [public data report](public-data-delivery-report.md).
- **Run the browser application:** [frontend README](../frontend/README.md) — Earthdata, HDF5 and Python are not needed.

## 7. Troubleshooting

| Symptom | Check |
|---|---|
| HTTP **401/403** or authorization failed | Earthdata login, authorization for ASF, correct `.netrc` hostname and mode `0600`, or a current token. An HTML sign-in response must **not** be treated as an HDF5 file. |
| `Earthdata token authentication failed` | Remove an expired/incorrect explicit token; verify it is a valid Earthdata token and that the account is authorized. |
| Insufficient space | Check `df -h .` plus any separate raw/artifact volumes. Do not delete verified inputs blindly. |
| Interrupted download | Re-run the same `history run`: verified files and recoverable partial transfers may be reused. |
| `history verify` fails | Inspect the local report and input/artifact receipts. Do not call a run complete without verification. |
| Website/API fails with no credentials | This is **not** an Earthdata requirement; use the committed snapshot and check [frontend](../frontend/README.md) / [backend](backend-operations.md). |

For credential-handling and private security reports see [SECURITY.md](../SECURITY.md). For official user authentication documentation consult [NASA Earthdata Login](https://urs.earthdata.nasa.gov/documentation/for_users/data_access/curl_and_wget) and [ASF Downloads](https://docs.asf.alaska.edu/asf_search/downloading/).
