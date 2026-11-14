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
