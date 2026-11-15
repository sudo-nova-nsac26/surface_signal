# Future work — explicitly not part of the delivered pilot

**Status at submission review: proposed or research-stage.** This is an engineering roadmap, not a claim that these features work today. Preserve the current read-only public site and independent scientific evidence requirements.

| Priority | Proposed work | Prerequisite / acceptance criterion |
|---|---|---|
| P0 — scientific validation | Compare candidates with independently sourced, temporally matched reference imagery and/or qualified field surveys | Document provenance, licensing, UTC acquisition offsets, common masks/CRS, spatial agreement metrics and uncertainties. No accuracy claims before evidence exists |
| P1 — confidence and quality | Study seasonal/land-cover-specific thresholds, SAR geometry/shadow, calibration and masks | Evaluate on labeled data across multiple events and acquisition groups; never present a heuristic as a flood probability |
| P1 — reproducible expansion | Generalize AOIs beyond the Taquari pilot and publish additional immutable compact bundles | Explicit area provenance, resource budgets, compatible scene pairing, full manifest hashes and clean-clone tests |
| P2 — data updates | Optional, credential-free imports for trustworthy public rainfall/river/land-cover products | Confirm real access, temporal semantics, license and measured data completeness before presenting as ingested |
| P2 — external sensor context | Optical/SAR reference imagery when lawful and appropriate | Cross-sensor, spatial and temporal QA. A reference source URL alone is not validation |
| Research — interferometry | Evaluate suitable phase/interferometric products for displacement research | Compatible data, atmospheric/geometry corrections and specialist review; GCOV amplitude change cannot measure displacement |
| Research — decision support | Study links with official hazard maps, infrastructure and civil-defense systems | Formal validation, agency partnership and safety review; no automated evacuation routing or emergency guidance from this pilot |

## Implementation boundaries

- **Public viewer:** `frontend/src/data/source.ts` remains the only HTTP/static data boundary. Future pagination/caching must retain the same source/validation contract. Do not calculate scientific areas from simplified published GeoJSON.
- **SAR analysis:** `backend/src/surfacesignal/processing/{gcov,change,pipeline}.py` owns offline image processing. Add calibrated detectors as **new versioned algorithms**, not silent changes to the published 17 manifests.
- **History:** `backend/src/surfacesignal/processing/history.py` handles resumable acquisition and integrity. New AOIs must have bounded memory/storage and safe opt-in downloads.
- **Publication:** `backend/src/surfacesignal/{publication,snapshots}.py` exports prepared derivatives, never source HDF5 or credentials. Hashes and redistribution checks are release gates.
- **Read-only API:** `backend/src/surfacesignal/api/` must never fetch NASA files or run heavy processing in a request.

## What is deliberately excluded now

No new GPM/IMERG Earthdata dependency, automatic live ANA/SGB station feed, MapBiomas/GEE login, RCM acquisition, paid weather service, alert/forecast system, population-impact estimates, or confirmed landslide/deforestation maps. A mention in a proposal or source registry is **not proof of ingestion**.

Keep future tasks documented in this register or versioned issues rather than filling production code with speculative stubs. Add a short comment at an actual extension point when it helps a future maintainer, with a reference to this file. Each future feature should be accompanied by tests and provenance before it is marked delivered.
