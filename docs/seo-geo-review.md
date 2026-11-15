# SEO and GEO: review of the public static application

Canonical origin: **https://surfacesignal.earth**. The two primary crawlable routes are **/pt/** and **/en/**. The `/` entry auto-selects a language and should not compete with those locale pages in indexing.

## Implemented

- Per-language titles, descriptions, canonical URLs and alternate `hreflang` values (pt-BR, en and x-default), OpenGraph/Twitter tags.
- Default `metadataBase` fixed to the official domain; the old Cloudflare Pages preview domain is not the canonical fallback.
- `frontend/public/robots.txt`, `sitemap.xml` and optional AI-readable `llms.txt` included in the static build. Dev-lab and synthetic-demo crawler exclusions are explicit.
- JSON-LD `WebApplication` / `Dataset` describes **19 NISAR scenes, 17 radar comparisons**, CHIRPS **v3**, actual end date **2026-10-19**, cited upstream product pages and scientific caveats.
- Removed false 17-HDF5 count, incorrect CHIRPS v2 assertion, unsupported CC0 license for the dataset, and misleading public-safety application classification.
- Static export validator checks locale canonical URLs, SEO files and that false CC0 claims are absent from generated HTML.

## Limits

“GEO” refers to generative-engine discoverability, not a promise of indexing/ranking/citations by any AI product. `llms.txt` is an optional informational format. Structured data should never claim confirmed flooding, independent validation, an operational public-safety system or a blanket upstream-data license.

Inspect production after deploy:

```sh
curl -I https://surfacesignal.earth/pt/
curl -I https://surfacesignal.earth/en/
curl https://surfacesignal.earth/robots.txt
curl https://surfacesignal.earth/sitemap.xml
curl https://surfacesignal.earth/llms.txt
```

CI/export validation is local build verification; external crawler indexing needs separate Search Console/webmaster evidence. The README and [source inventory](data-sources.md) provide human-readable provenance.
