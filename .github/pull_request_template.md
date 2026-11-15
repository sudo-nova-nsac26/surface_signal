## Summary

Describe what changed, why and which components or documentation are affected.

## Validation

- [ ] Relevant automated checks pass.
- [ ] Frontend: tests, ESLint, static build and `check:static` when affected.
- [ ] Backend: Ruff lint/format and pytest when affected.
- [ ] README, API contract and source documentation updated when interfaces or data change.

## Scientific, source and security boundaries

- [ ] No unverified claims of flooding, damage, precision/recall or operational warnings.
- [ ] Source identities, data limitations, timestamps and null semantics remain accurate.
- [ ] Compact map geometries are never used to recompute authoritative statistics.
- [ ] No `.env`, credentials, restricted source rasters or raw HDF5 files in the change.
- [ ] `NEXT_PUBLIC_*` values expose no secrets.
