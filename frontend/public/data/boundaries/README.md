# Boundaries

Outlines drawn around the current place on the map.

- `brazil.geojson`, `brazil-south.geojson`, `rio-grande-do-sul.geojson`:
  IBGE, *Malhas Geográficas* (API v3, `qualidade=intermediaria`), downloaded on
  2026-11-14 from https://servicodados.ibge.gov.br/api/v3/malhas/ .
  Source: Instituto Brasileiro de Geografia e Estatística (IBGE), open data,
  CC BY 4.0. They are simplified outlines for display, not for measurement.

- `taquari-river.geojson`: centre line of the Rio Taquari inside the analysed circle, from
  OpenStreetMap (© OpenStreetMap contributors, ODbL, https://www.openstreetmap.org/copyright), built with
  `scripts/build-river.mjs`. Used only for the gentle water movement at the close-up; not a measurement.

They are bundled so the site does not depend on these services at run time.

