// Builds src/components/valley-scene-data.ts: the real shape of the Taquari
// River, the built-up areas of Lajeado and Estrela, main roads and bridges,
// as small SVG paths for the "How it works" drawing.
//
// Source: OpenStreetMap contributors (ODbL). Download once from Overpass
// (bbox south,west,north,east = -29.53,-52.08,-29.40,-51.84) and run:
//   node scripts/build-valley-scene.mjs <osm.json> src/components/valley-scene-data.ts
//
// The map is turned so that Lajeado is on the left and Estrela on the right.
import fs from "node:fs";

const [, , input, output] = process.argv;
if (!input || !output) throw new Error("usage: <osm.json> <out.ts>");
const osm = JSON.parse(fs.readFileSync(input, "utf8"));

const LAT0 = -29.4838;
const LON0 = -51.9636;
const SCALE = 0.117; // drawing units per metre
const CX = 600;
const CY = 325; // middle of the ground area (y 140 to 500)
const WINDOW = { x0: -150, x1: 1350, y0: 120, y1: 640 };

const project = ({ lat, lon }) => {
  const east = (lon - LON0) * Math.cos((LAT0 * Math.PI) / 180) * 111320;
  const north = (lat - LAT0) * 110574;
  return [CX + SCALE * -north, CY - SCALE * east];
};

const inside = ([x, y]) =>
  x > WINDOW.x0 && x < WINDOW.x1 && y > WINDOW.y0 && y < WINDOW.y1;

/** Keep a point only when it moved at least `gap` from the last kept one. */
function thin(points, gap = 1.6) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= gap) out.push(p);
  }
  const end = points[points.length - 1];
  if (out.length && out[out.length - 1] !== end) out.push(end);
  return out;
}

const fmt = (n) => Math.round(n * 10) / 10;
const toPath = (points, close) =>
  points.length < 2
    ? ""
    : `M${points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L")}${close ? "Z" : ""}`;

const key = (p) => `${p.lat},${p.lon}`;

/** Joins the outer member ways of a water relation into closed rings. */
function rings(members) {
  const pieces = members
    .filter((m) => m.type === "way" && m.role === "outer" && m.geometry)
    .map((m) => m.geometry);
  const done = [];
  while (pieces.length) {
    let ring = pieces.shift().slice();
    let grew = true;
    while (grew && key(ring[0]) !== key(ring[ring.length - 1])) {
      grew = false;
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        const end = key(ring[ring.length - 1]);
        const start = key(ring[0]);
        if (key(piece[0]) === end) ring = ring.concat(piece.slice(1));
        else if (key(piece[piece.length - 1]) === end)
          ring = ring.concat(piece.slice().reverse().slice(1));
        else if (key(piece[piece.length - 1]) === start)
          ring = piece.concat(ring.slice(1));
        else if (key(piece[0]) === start)
          ring = piece.slice().reverse().concat(ring.slice(1));
        else continue;
        pieces.splice(i, 1);
        grew = true;
        break;
      }
    }
    done.push({ ring, closed: key(ring[0]) === key(ring[ring.length - 1]) });
  }
  return done;
}

const rivers = [];
const riverLines = [];
const tributaries = [];
const towns = [];
const roads = [];
const bridges = [];
const streets = [];
const MINOR = /^(tertiary|residential|unclassified|living_street)$/;
const whole = (points) =>
  points.length < 2 ? "" : `M${points.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join("L")}`;
const stats = { openRings: 0 };

for (const el of osm.elements) {
  const tags = el.tags ?? {};
  if (el.type === "relation" && tags.name === "Rio Taquari") {
    for (const { ring, closed } of rings(el.members)) {
      if (!closed) stats.openRings += 1;
      const pts = ring.map(project);
      if (!pts.some(inside)) continue;
      rivers.push({ d: toPath(thin(pts), closed), closed });
    }
  } else if (el.type === "way" && tags.waterway === "river" && tags.name === "Rio Taquari") {
    const pts = el.geometry.map(project);
    if (pts.some(inside)) riverLines.push(toPath(thin(pts)));
  } else if (
    el.type === "way" &&
    tags.waterway &&
    /Arroio|Rio/.test(tags.name ?? "") &&
    tags.name !== "Rio Taquari"
  ) {
    const pts = el.geometry.map(project);
    if (pts.filter(inside).length > 3) tributaries.push(toPath(thin(pts, 2.4)));
  } else if (el.type === "way" && tags.landuse === "residential") {
    const pts = el.geometry.map(project);
    if (pts.some(inside) && pts.length > 3) towns.push(toPath(thin(pts, 1.2), true));
  } else if (el.type === "way" && tags.highway) {
    const pts = el.geometry.map(project);
    if (!pts.some(inside)) continue;
    if (MINOR.test(tags.highway)) {
      if (pts.filter(inside).length > 2) streets.push(whole(thin(pts, 2.6)));
      continue;
    }
    const d = toPath(thin(pts, 2));
    if (tags.bridge === "yes") bridges.push(d);
    else roads.push(d);
  }
}

const place = (lat, lon) => project({ lat, lon }).map(fmt);
const data = {
  rivers: rivers.filter((r) => r.closed).map((r) => r.d),
  riverLines,
  tributaries,
  towns,
  roads,
  bridges,
  streets: [streets.join("")],
  lajeado: place(-29.4669, -51.9614),
  estrela: place(-29.5006, -51.9658),
};

const text = `// Generated by scripts/build-valley-scene.mjs. Do not edit by hand.
// Shapes: © OpenStreetMap contributors (ODbL), simplified for a drawing.
export const VALLEY = ${JSON.stringify(data)} as const;
`;
fs.writeFileSync(output, text);
console.log(
  `rivers ${data.rivers.length} (open rings dropped: ${stats.openRings}), river lines ${riverLines.length}, ` +
    `streets ${streets.length}, tributaries ${tributaries.length}, towns ${towns.length}, roads ${roads.length}, bridges ${bridges.length}, ` +
    `${Math.round(text.length / 1024)} KB`,
  "Lajeado",
  data.lajeado,
  "Estrela",
  data.estrela,
);
