/** 2D is a flat map seen from above; 3D is a globe with relief. */
export type ViewMode = "2d" | "3d";

/** Free services that need no key or account. */
export const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

export const TERRAIN_TILES =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export const TERRAIN_ATTRIBUTION =
  '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noreferrer">Terrain: Mapzen, AWS Open Data</a>';
