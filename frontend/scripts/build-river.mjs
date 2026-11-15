// Builds public/data/boundaries/taquari-river.geojson: the centre line of the
// Rio Taquari inside the analysed circle, used only for the gentle water
// movement at the close-up. Not a measurement.
//
// Source: OpenStreetMap contributors (ODbL). Merge the Overpass replies (see
// build-valley-scene.mjs for the queries) into one {"elements": [...]} file:
//   node scripts/build-river.mjs <osm.json> public/data/boundaries/taquari-river.geojson
//
// OSM draws rivers downstream, so every line keeps the direction of the flow.
import fs from "node:fs";

const [, , input, output] = process.argv;
if (!input || !output) throw new Error("usage: <osm.json> <out.geojson>");
const osm = JSON.parse(fs.readFileSync(input, "utf8"));

const CENTER = { lat: -29.467, lon: -51.961 }; // the analysed area is a 5 km circle around it
const RADIUS_M = 4950; // a little inside the circle, so nothing crosses its outline

const metres = (p) => {
  const dx = (p.lon - CENTER.lon) * Math.cos((CENTER.lat * Math.PI) / 180) * 111320;
  const dy = (p.lat - CENTER.lat) * 110574;
  return Math.hypot(dx, dy);
};

const lines = [];
for (const el of osm.elements) {
  const tags = el.tags ?? {};
  if (el.type !== "way" || tags.waterway !== "river" || tags.name !== "Rio Taquari" || !el.geometry) continue;
  let run = [];
  for (const point of el.geometry) {
    if (metres(point) <= RADIUS_M) run.push(point);
    else {
      if (run.length > 1) lines.push(run);
      run = [];
    }
  }
  if (run.length > 1) lines.push(run);
}

// Join runs that meet end to start, so the flow reads as one river.
const key = (p) => `${p.lat},${p.lon}`;
const joined = [];
for (const line of lines) {
  const tail = joined.find((other) => key(other[other.length - 1]) === key(line[0]));
  if (tail) tail.push(...line.slice(1));
  else joined.push(line.slice());
}

const collection = {
  type: "FeatureCollection",
  features: joined.map((line) => ({
    type: "Feature",
    properties: { name: "Rio Taquari" },
    geometry: {
      type: "LineString",
      coordinates: line.map((p) => [Number(p.lon.toFixed(5)), Number(p.lat.toFixed(5))]),
    },
  })),
};
fs.writeFileSync(output, JSON.stringify(collection));
console.log(
  `${collection.features.length} lines, ${joined.reduce((n, l) => n + l.length, 0)} points;`,
  joined.map((l) => `from lat ${l[0].lat.toFixed(4)} to ${l[l.length - 1].lat.toFixed(4)}`).join(" | "),
);
