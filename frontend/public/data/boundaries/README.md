# Boundaries

Outlines drawn around the current place on the map.

- `brazil.geojson`, `brazil-south.geojson`, `rio-grande-do-sul.geojson`:
  IBGE, *Malhas Geográficas* (API v3, `qualidade=intermediaria`), downloaded on
  2026-11-14 from https://servicodados.ibge.gov.br/api/v3/malhas/ .
  Source: Instituto Brasileiro de Geografia e Estatística (IBGE), open data,
  CC BY 4.0. They are simplified outlines for display, not for measurement.

They are bundled so the site does not depend on the IBGE service at run time.

- `south-america.geojson`: Natural Earth, 1:50m *Admin 0 – Countries* and
  *Map Units* (French Guiana), public domain (https://www.naturalearthdata.com/),
  merged into a single outline and rounded to two decimals, 2026-11-14.
