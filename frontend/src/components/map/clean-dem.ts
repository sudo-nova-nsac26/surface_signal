import { addProtocol } from "maplibre-gl";
import { TERRAIN_TILES } from "./camera";

/**
 * The free elevation tiles have isolated wrong points (a bridge read as a
 * 250 m tower, a pit of -365 m) that show up as spikes in the 3D relief when
 * seen from afar. Tiles go through this protocol first: a point that differs
 * from the middle value of its neighbours by more than a cliff could explain
 * is replaced by that middle value. Everything else passes untouched, and if
 * anything goes wrong the original tile is used as it came.
 */
export const CLEAN_TERRAIN_TILES = "cleandem://{z}/{x}/{y}";

const LIMIT_M = 120; // how far a point may stand from the middle of its 5x5 neighbours
const FIRST_LOOK_M = 80; // cheap first test against the four nearest neighbours
const MIN_ZOOM = 10; // wider tiles are too coarse: real cliffs look like spikes there
const MAX_ZOOM = 13; // closer tiles are clean and keep all their detail
const PASSES = 3; // a wrong patch wider than two points needs more than one pass

let registered = false;

/** Elevation in metres from one Terrarium pixel. */
const metres = (d: Uint8ClampedArray, k: number) => d[k] * 256 + d[k + 1] + d[k + 2] / 256 - 32768;

function despike(image: ImageData) {
  const { data, width, height } = image;
  const h = new Float32Array(width * height);
  for (let i = 0; i < h.length; i += 1) h[i] = metres(data, i * 4);
  const window: number[] = [];
  let fixed = 0;
  for (let y = 2; y < height - 2; y += 1) {
    for (let x = 2; x < width - 2; x += 1) {
      const i = y * width + x;
      const v = h[i];
      const near = (h[i - 1] + h[i + 1] + h[i - width] + h[i + width]) / 4;
      if (Math.abs(v - near) < FIRST_LOOK_M) continue;
      window.length = 0;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) window.push(h[i + dy * width + dx]);
      }
      window.sort((a, b) => a - b);
      const middle = window[12];
      if (Math.abs(v - middle) <= LIMIT_M) continue;
      // Write the middle value back in the same encoding.
      const value = Math.round((middle + 32768) * 256);
      data[i * 4] = value >> 16;
      data[i * 4 + 1] = (value >> 8) & 255;
      data[i * 4 + 2] = value & 255;
      fixed += 1;
    }
  }
  return fixed;
}

export function registerCleanDem() {
  if (registered) return;
  registered = true;
  addProtocol("cleandem", async (params, abort) => {
    const match = /^cleandem:\/\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
    if (!match) throw new Error("Bad terrain address");
    const [, z, x, y] = match;
    const source = TERRAIN_TILES.replace("{z}", z).replace("{x}", x).replace("{y}", y);
    const response = await fetch(source, { signal: abort.signal });
    if (!response.ok) throw new Error(`Terrain tile ${response.status}`);
    const original = await response.arrayBuffer();
    if (Number(z) < MIN_ZOOM || Number(z) > MAX_ZOOM || typeof OffscreenCanvas === "undefined") return { data: original };
    try {
      // No colour conversion: the colours are the elevation.
      const bitmap = await createImageBitmap(new Blob([original], { type: "image/png" }), {
        premultiplyAlpha: "none",
        colorSpaceConversion: "none",
      });
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return { data: original };
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      let fixed = 0;
      for (let pass = 0; pass < PASSES; pass += 1) {
        const now = despike(image);
        fixed += now;
        if (now === 0) break;
      }
      if (fixed === 0) return { data: original };
      context.putImageData(image, 0, 0);
      const cleaned = await canvas.convertToBlob({ type: "image/png" });
      return { data: await cleaned.arrayBuffer() };
    } catch {
      return { data: original };
    }
  });
}
