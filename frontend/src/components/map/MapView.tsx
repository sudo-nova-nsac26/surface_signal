"use client";

import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { FeatureCollection } from "geojson";
import type { GeoJsonPolygon } from "@/data/api-types";
import type { LngLat } from "@/data/region";
import {
  BASEMAP_STYLE,
  TERRAIN_ATTRIBUTION,
  TERRAIN_TILES,
  type ViewMode,
} from "./camera";
import type { MotionLevel } from "@/preferences/store";
import type { Outline, Place } from "./places";

export interface MapViewHandle {
  zoomBy: (delta: number) => void;
  rotateBy: (degrees: number) => void;
  tiltBy: (degrees: number) => void;
  resetView: () => void;
}

export interface MapMarker {
  id: string;
  name: string;
  point: LngLat;
  /** False for places that are shown but cannot be opened yet. */
  available: boolean;
}

export interface MapViewProps {
  ref?: Ref<MapViewHandle>;
  place: Place;
  /** Dots on the map: places to travel to, and places still to come. */
  markers: MapMarker[];
  /** 2D is a flat map. 3D is a globe with relief and a tilted close-up. */
  view: ViewMode;
  /** How much the camera may move: sweeping flights, short moves, or none. */
  motion: MotionLevel;
  /** Before the visitor starts: a slowly turning globe behind the intro. */
  intro: boolean;
  /** Change shapes (GeoJSON URL) of the selected comparison, if any. */
  changes: string | null;
  /** How much of the change shapes shows: 0 = before, 1 = after. */
  changeOpacity: number;
  reference?: FeatureCollection | null;
  /** Outline of the analysed area, shown at the close-up. */
  area: GeoJsonPolygon | null;
  label: string;
  dotHint: string;
  upcomingLabel: string;
  gestureText: { desktop: string; mac: string; mobile: string };
  onSelect: (id: string) => void;
  onReady: () => void;
  onError: () => void;
}

// Copied from the installed package by scripts/copy-map-worker.mjs.
setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

const AREA_SOURCE = "analysed-area";
const OUTLINE_SOURCE = "place-outline";
const OUTLINE_LAYERS = ["outline-fill", "outline-glow", "outline-line"];
const OUTLINE_COLOR = "#19e3ff";
const CHANGES_SOURCE = "change-candidates";
// Where the radar started seeing water. Okabe-Ito sky blue, readable on navy.
const WATER_COLOR = "#56b4e9";
const TERRAIN_SOURCE = "terrain";
const RELIEF_SOURCE = "relief";
const FLIGHT_MS = 3200;
const DETAIL_PITCH = 62;
const MAX_PITCH = 78;
const RELIEF_EXAGGERATION = 2.8;
/** Where the globe ends up when it comes forward, and where the map begins. */
const SPOTLIGHT: LngLat = [-52, -14];

/**
 * Zoom of the world view. The globe and the flat map use the same value, so
 * switching between them (and arriving from the intro) never changes scale.
 */
/**
 * The flat world sits slightly closer than the globe. Going from one to the
 * other is one smooth zoom of this size, while the globe unfolds (or folds).
 */
const UNFOLD_ZOOM = 0.5;

const worldZoom = (width: number, flat = false) =>
  (width >= 1000 ? 2.6 : 2) + (flat ? UNFOLD_ZOOM : 0);

/**
 * The camera that frames an area, the same way for the globe and the flat
 * map. MapLibre's own fit gives different zooms for the two projections,
 * which would make the switch between them end with a second zoom. The globe
 * then sits UNFOLD_ZOOM further out than the flat map, as in the world view.
 */
function frameBounds(
  bounds: [LngLat, LngLat],
  width: number,
  height: number,
  padding: { top: number; bottom: number; left: number; right: number },
): { center: LngLat; zoom: number } {
  const [[west, south], [east, north]] = bounds;
  const availableWidth = Math.max(width - padding.left - padding.right, 200);
  const availableHeight = Math.max(height - padding.top - padding.bottom, 200);
  const rad = Math.PI / 180;
  const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * rad) / 2));
  const ySpan = Math.abs(mercator(north) - mercator(south));
  const zoomX = Math.log2((availableWidth * 360) / (512 * (east - west)));
  const zoomY = Math.log2((availableHeight * 2 * Math.PI) / (512 * ySpan));
  const middle = (mercator(north) + mercator(south)) / 2;
  const centerLat = (2 * Math.atan(Math.exp(middle)) - Math.PI / 2) / rad;
  return {
    center: [(west + east) / 2, centerLat],
    // A little air around the area, and never closer than a city.
    zoom: Math.min(zoomX, zoomY, 9.5) - 0.35,
  };
}

/**
 * The glow around the globe. On the globe it is full until the camera is
 * close; on the flat map there is none. It never changes while the globe is
 * moving: it goes out before the globe flattens and comes back after the
 * map has curved into a globe (see `fadeGlow`).
 */
const ATMOSPHERE_BY_ZOOM = ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0];

const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/**
 * The free dark basemap is almost black. This lifts land, water and borders
 * into the site palette so the planet reads clearly, also on dim screens.
 */
function recolourBasemap(map: MapLibreMap) {
  for (const layer of map.getStyle().layers) {
    if (layer.type === "background") {
      map.setPaintProperty(layer.id, "background-color", "#143a52");
    } else if (layer.type === "fill" && layer.id.includes("water")) {
      map.setPaintProperty(layer.id, "fill-color", "#05101d");
    } else if (layer.type === "line" && layer.id.includes("water")) {
      map.setPaintProperty(layer.id, "line-color", "#05101d");
    } else if (layer.type === "line" && layer.id.includes("boundary")) {
      map.setPaintProperty(layer.id, "line-color", "#4cc3dc");
    } else if (layer.type === "symbol") {
      map.setPaintProperty(layer.id, "text-color", "#e6f3fb");
      map.setPaintProperty(layer.id, "text-halo-color", "#05101d");
      map.setPaintProperty(layer.id, "text-halo-width", 1.4);
    }
  }
}

/** Adds the outline of the analysed area once, whenever it becomes known. */
function ensureAreaLayers(map: MapLibreMap, area: GeoJsonPolygon | null) {
  if (!area || map.getSource(AREA_SOURCE)) return;
  map.addSource(AREA_SOURCE, {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: area as GeoJSON.Geometry,
    },
  });
  map.addLayer({
    id: "analysed-area-fill",
    type: "fill",
    source: AREA_SOURCE,
    paint: { "fill-color": "#19e3ff", "fill-opacity": 0.06 },
  });
  map.addLayer({
    id: "analysed-area-line",
    type: "line",
    source: AREA_SOURCE,
    paint: {
      "line-color": "#19e3ff",
      "line-width": 3,
      "line-dasharray": [2, 2],
    },
  });
}

/**
 * Shows the change shapes of the selected comparison. They come from the
 * backend's change-candidates.geojson, so real results draw here as soon as
 * they are published; an empty file simply draws nothing.
 */
function setChangeLayers(
  map: MapLibreMap,
  url: string | null,
  visible: boolean,
  opacity: number,
) {
  const source = map.getSource(CHANGES_SOURCE) as
    { setData: (data: string) => void } | undefined;
  if (url && !source) {
    map.addSource(CHANGES_SOURCE, { type: "geojson", data: url });
    map.addLayer({
      id: "changes-fill",
      type: "fill",
      source: CHANGES_SOURCE,
      paint: { "fill-color": WATER_COLOR, "fill-opacity": 0.55 * opacity },
    });
    map.addLayer({
      id: "changes-line",
      type: "line",
      source: CHANGES_SOURCE,
      paint: {
        "line-color": "#d9f3ff",
        "line-width": 1.2,
        "line-opacity": opacity,
      },
    });
  } else if (url && source) {
    source.setData(url);
  }
  if (map.getLayer("changes-fill")) {
    map.setPaintProperty("changes-fill", "fill-opacity", 0.55 * opacity);
    map.setPaintProperty("changes-line", "line-opacity", opacity);
  }
  for (const layer of ["changes-fill", "changes-line"]) {
    if (map.getLayer(layer)) {
      map.setLayoutProperty(
        layer,
        "visibility",
        url && visible ? "visible" : "none",
      );
    }
  }
}

/**
 * The strong outline around the current place: a soft glow under a bright
 * line, so it reads on any background. Replaced whenever the place changes.
 */
function setOutline(map: MapLibreMap, outline: Outline | undefined) {
  for (const id of OUTLINE_LAYERS) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(OUTLINE_SOURCE)) map.removeSource(OUTLINE_SOURCE);
  if (!outline) return;

  // Keep place names above the outline.
  const firstLabel = map
    .getStyle()
    .layers.find((layer) => layer.type === "symbol")?.id;
  const glow = {
    "line-color": OUTLINE_COLOR,
    "line-width": 12,
    "line-blur": 8,
    "line-opacity": 0.45,
  };
  const line = { "line-color": OUTLINE_COLOR, "line-width": 3.2 };

  map.addSource(OUTLINE_SOURCE, { type: "geojson", data: outline.url });
  map.addLayer(
    {
      id: "outline-fill",
      type: "fill",
      source: OUTLINE_SOURCE,
      paint: { "fill-color": OUTLINE_COLOR, "fill-opacity": 0.07 },
    },
    firstLabel,
  );
  map.addLayer(
    { id: "outline-glow", type: "line", source: OUTLINE_SOURCE, paint: glow },
    firstLabel,
  );
  map.addLayer(
    { id: "outline-line", type: "line", source: OUTLINE_SOURCE, paint: line },
    firstLabel,
  );
}

/** Free rotation and tilt are only offered at the 3D close-up. */
function setFreeCamera(map: MapLibreMap, free: boolean) {
  if (free) {
    map.dragRotate.enable();
    map.touchPitch.enable();
    map.touchZoomRotate.enableRotation();
    map.keyboard.enableRotation();
  } else {
    map.dragRotate.disable();
    map.touchPitch.disable();
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
  }
}

/** Angle in degrees between two points on the globe. */
function angularDistance(a: LngLat, b: LngLat) {
  const rad = Math.PI / 180;
  const cos =
    Math.sin(a[1] * rad) * Math.sin(b[1] * rad) +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos((a[0] - b[0]) * rad);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / rad;
}

/** Room left for the panels laid over the map, so places are not hidden. */
function framePadding(width: number) {
  // Centred on purpose: the place sits in the middle of the screen, with the
  // info card overlapping only a corner. On phones it clears the bottom card.
  return width >= 900
    ? { top: 84, bottom: 56, left: 56, right: 72 }
    : { top: 84, bottom: 250, left: 24, right: 24 };
}

/**
 * The map itself. It only follows orders: the parent says which place to
 * show and in which view, and the camera goes there. Dots are real buttons
 * laid over the map, so they work with keyboard and screen readers.
 */
export default function MapView({
  ref,
  place,
  markers,
  view,
  motion,
  intro,
  changes,
  changeOpacity,
  reference,
  area,
  label,
  dotHint,
  upcomingLabel,
  gestureText,
  onSelect,
  onReady,
  onError,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loadedRef = useRef(false);
  const dotRefs = useRef(new Map<string, HTMLButtonElement>());
  const flightTimer = useRef<number | undefined>(undefined);
  const freeRef = useRef(false);
  const fadeRef = useRef<HTMLDivElement>(null);
  const revealTimer = useRef<number | undefined>(undefined);
  const wasIntro = useRef(intro);
  const spinning = useRef(false);
  const lastView = useRef(view);
  const glowFrame = useRef(0);
  const applied = useRef<{
    globe?: boolean;
    relief?: boolean;
    outline?: string;
  }>({});

  // Latest values for the map callbacks, without re-creating the map.
  const latest = useRef({
    place,
    markers,
    view,
    motion,
    intro,
    changes,
    changeOpacity,
    area,
  });
  useEffect(() => {
    latest.current = {
      place,
      markers,
      view,
      motion,
      intro,
      changes,
      changeOpacity,
      area,
    };
  });
  const callbacks = useRef({ onReady, onError });
  useEffect(() => {
    callbacks.current = { onReady, onError };
  });

  useImperativeHandle(ref, () => ({
    zoomBy(delta) {
      mapRef.current?.easeTo({
        zoom: mapRef.current.getZoom() + delta,
        duration: latest.current.motion === "none" ? 0 : 300,
      });
    },
    rotateBy(degrees) {
      const map = mapRef.current;
      map?.easeTo({
        bearing: map.getBearing() + degrees,
        duration: latest.current.motion === "none" ? 0 : 350,
      });
    },
    tiltBy(degrees) {
      const map = mapRef.current;
      map?.easeTo({
        pitch: Math.min(MAX_PITCH, Math.max(0, map.getPitch() + degrees)),
        duration: latest.current.motion === "none" ? 0 : 350,
      });
    },
    resetView() {
      mapRef.current?.easeTo({
        bearing: 0,
        pitch: latest.current.view === "3d" ? DETAIL_PITCH : 0,
        duration: latest.current.motion === "none" ? 0 : 500,
      });
    },
  }));

  /** Moves each dot to where its place currently is on screen. */
  function updateDots() {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const { markers, view } = latest.current;
    const center = map.getCenter();
    for (const marker of markers) {
      const element = dotRefs.current.get(marker.id);
      if (!element) continue;
      const point = map.project(marker.point);
      // On the globe, places on the far side are hidden.
      const hidden =
        view === "3d" &&
        map.getZoom() < 6 &&
        angularDistance([center.lng, center.lat], marker.point) > 78;
      const inside =
        point.x > -24 &&
        point.x < width + 24 &&
        point.y > -24 &&
        point.y < height + 24;
      element.style.visibility = !hidden && inside ? "visible" : "hidden";
      element.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
      element.dataset.side = point.x > width * 0.62 ? "left" : "right";
    }
  }

  function setFlying(flying: boolean) {
    window.clearTimeout(flightTimer.current);
    if (overlayRef.current) {
      overlayRef.current.dataset.flying = flying ? "true" : "false";
    }
    // Safety net in case the camera ends up not moving at all.
    if (flying) {
      flightTimer.current = window.setTimeout(
        () => setFlying(false),
        FLIGHT_MS + 800,
      );
    }
  }

  function applyView(animate: boolean, flightMs = FLIGHT_MS) {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container || !loadedRef.current) return;
    const { place, view, motion, area } = latest.current;
    const is3d = view === "3d";
    const detail = place.detail;
    const relief = is3d && Boolean(detail);

    // These are only touched when they change: setting them again would
    // interrupt a flight that is already under way.
    if (applied.current.globe !== is3d) {
      applied.current.globe = is3d;
      map.setProjection({ type: is3d ? "globe" : "mercator" });
      // The glow belongs to the globe only. It returns once the globe is
      // there, never while the map is still moving.
      map.setSky({ "atmosphere-blend": 0 } as never);
      if (is3d) {
        if (motion === "none") {
          map.setSky({ "atmosphere-blend": ATMOSPHERE_BY_ZOOM } as never);
        } else {
          fadeGlow(0, 1, 450);
        }
      }
    }
    if (applied.current.relief !== relief) {
      applied.current.relief = relief;
      map.setTerrain(
        relief
          ? { source: TERRAIN_SOURCE, exaggeration: RELIEF_EXAGGERATION }
          : null,
      );
      map.setPaintProperty(
        "relief-shade",
        "hillshade-exaggeration",
        relief ? 0.95 : 0.22,
      );
      if (map.getLayer("relief-color")) {
        map.setPaintProperty(
          "relief-color",
          "color-relief-opacity",
          relief ? 0.7 : 0,
        );
      }
      setFreeCamera(map, relief);
      freeRef.current = relief;
    }

    // The strong outline follows the place; it is redrawn only when it changes.
    const outlineKey = detail ? "" : place.id;
    if (applied.current.outline !== outlineKey) {
      applied.current.outline = outlineKey;
      setOutline(map, detail ? undefined : place.outline);
    }

    ensureAreaLayers(map, area);
    setChangeLayers(
      map,
      latest.current.changes,
      Boolean(detail),
      latest.current.changeOpacity,
    );
    for (const layer of ["analysed-area-fill", "analysed-area-line"]) {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(
          layer,
          "visibility",
          area && detail ? "visible" : "none",
        );
      }
    }

    const padding = framePadding(container.clientWidth);
    let target: { center: LngLat; zoom: number };
    if (detail) {
      target = {
        center: detail.center,
        zoom: is3d ? detail.zoom : detail.zoom - 0.3,
      };
    } else if (place.focus) {
      // Centred on the story's country, close enough to feel inside the
      // globe. The intro ends at this exact view, so nothing zooms back out.
      target = {
        center: place.focus.center,
        zoom: worldZoom(container.clientWidth, !is3d),
      };
    } else {
      const fitted = frameBounds(
        place.bounds,
        container.clientWidth,
        container.clientHeight,
        padding,
      );
      target = {
        center: fitted.center,
        zoom: Math.max(fitted.zoom - (is3d ? UNFOLD_ZOOM : 0), 0.8),
      };
    }
    const camera = {
      ...target,
      pitch: relief ? DETAIL_PITCH : 0,
      bearing: 0,
      // Keeps the place clear of the panels laid over the map.
      padding,
    };

    if (animate && motion !== "none") {
      setFlying(true);
      if (motion === "full") {
        map.flyTo({
          ...camera,
          duration: flightMs,
          curve: 1.5,
          essential: true,
        });
      } else {
        // The device asks for less motion: one short, smooth move.
        map.easeTo({ ...camera, duration: 700, essential: true });
      }
    } else {
      map.jumpTo(camera);
    }
    updateDots();
  }

  /** The slow turn of the globe behind the intro. */
  function spin() {
    const map = mapRef.current;
    if (!map || !latest.current.intro || latest.current.motion !== "full")
      return;
    // Starting an ease stops the previous one, and stopping ends a move,
    // which asks for another spin. These two guards break that chain.
    if (spinning.current || map.isMoving()) return;
    spinning.current = true;
    try {
      const center = map.getCenter();
      map.easeTo({
        center: [center.lng + 90, center.lat],
        duration: 24000,
        easing: (t) => t,
        essential: true,
      });
    } finally {
      spinning.current = false;
    }
  }

  /** The globe on the right, so the introduction can sit on the left. */
  function introView() {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container || !loadedRef.current) return;
    if (applied.current.globe !== true) {
      applied.current.globe = true;
      map.setProjection({ type: "globe" });
    }
    if (applied.current.relief) {
      applied.current.relief = false;
      map.setTerrain(null);
      setFreeCamera(map, false);
      freeRef.current = false;
    }
    for (const layer of ["analysed-area-fill", "analysed-area-line"]) {
      if (map.getLayer(layer))
        map.setLayoutProperty(layer, "visibility", "none");
    }
    const wide = container.clientWidth >= 1000;
    map.jumpTo({
      center: [-48, -12],
      zoom: wide ? 1.55 : 1.2,
      pitch: 0,
      bearing: 0,
      padding: wide
        ? { top: 0, bottom: 0, left: container.clientWidth * 0.42, right: 0 }
        : { top: 0, bottom: 0, left: 0, right: 0 },
    });
    spin();
  }

  /**
   * From the intro to the map. With full motion the globe first moves to the
   * centre and grows, taking the stage while the introduction recedes; then
   * the view settles into the map. Gentler levels use a short fade.
   */
  function reveal() {
    const map = mapRef.current;
    const fade = fadeRef.current;
    const container = containerRef.current;
    if (!map || !container) return;
    map.stop();
    window.clearTimeout(revealTimer.current);
    const { motion } = latest.current;
    if (motion === "none" || !fade) {
      applyView(false);
      return;
    }

    // The globe comes forward and stops at the world view. In 3D that is the
    // end. In 2D the globe then unfolds into the flat map in one more smooth
    // zoom, so the change of projection is never a jump.
    const settle = () => {
      if (latest.current.view === "3d") applyView(false);
      else unfold(true);
    };

    if (motion === "gentle") {
      crossfade();
      return;
    }

    map.easeTo({
      center: SPOTLIGHT,
      zoom: worldZoom(container.clientWidth),
      padding: framePadding(container.clientWidth),
      duration: 1600,
      easing: easeInOut,
      essential: true,
    });
    revealTimer.current = window.setTimeout(settle, 1600);
  }

  /**
   * Fades the view in (used when the intro hands over to the flat map): the
   * change of projection happens while the map is hidden.
   */
  function crossfade() {
    const fade = fadeRef.current;
    window.clearTimeout(revealTimer.current);
    if (!fade || latest.current.motion === "none") {
      applyView(false);
      return;
    }
    fade.style.transition = "opacity 260ms ease-in";
    fade.style.opacity = "0";
    revealTimer.current = window.setTimeout(() => {
      applyView(false);
      fade.style.transition = "opacity 650ms ease-out";
      fade.style.opacity = "1";
    }, 280);
  }

  /** Fades the glow around the globe in or out over `ms`, then calls `done`. */
  function fadeGlow(from: number, to: number, ms: number, done?: () => void) {
    const map = mapRef.current;
    window.cancelAnimationFrame(glowFrame.current);
    if (!map) return;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const value = from + (to - from) * easeInOut(t);
      map.setSky({ "atmosphere-blend": value } as never);
      if (t < 1) {
        glowFrame.current = window.requestAnimationFrame(step);
        return;
      }
      // Fully on: hand back to the zoom-based glow of the settled globe.
      if (to === 1) {
        map.setSky({ "atmosphere-blend": ATMOSPHERE_BY_ZOOM } as never);
      }
      done?.();
    };
    glowFrame.current = window.requestAnimationFrame(step);
  }

  /**
   * Switching between the globe and the flat map in one continuous motion.
   * The projection is tied to the zoom for a moment: as the camera zooms by
   * half a step, the globe flattens into the map (or curves back into the
   * globe), the same way it already happens on the way into the valley. The
   * camera never pulls back and then closes in again.
   */
  function unfold(toFlat: boolean) {
    const map = mapRef.current;
    window.clearTimeout(revealTimer.current);
    const { motion } = latest.current;
    if (!map || motion === "none") {
      applyView(false);
      return;
    }
    if (motion === "gentle") {
      applyView(true);
      return;
    }
    const run = () => {
      const zoom = map.getZoom();
      // Flat -> globe zooms out by UNFOLD_ZOOM, globe -> flat zooms in by it.
      const low = toFlat ? zoom : zoom - UNFOLD_ZOOM;
      const high = low + UNFOLD_ZOOM;
      map.setProjection({
        type: [
          "interpolate",
          ["linear"],
          ["zoom"],
          low,
          "vertical-perspective",
          high,
          "mercator",
        ],
      } as never);
      setFlying(true);
      map.easeTo({
        zoom: toFlat ? high : low,
        duration: 1500,
        easing: easeInOut,
        essential: true,
      });
      // Then the final projection and the exact framing of the place.
      revealTimer.current = window.setTimeout(
        () => applyView(true, 700),
        1520,
      );
    };

    if (toFlat) {
      // Globe -> map: the glow goes out first, then the whole movement.
      fadeGlow(1, 0, 200, run);
    } else {
      // Map -> globe: the whole movement first (no glow), then the glow
      // comes back in applyView once the globe is in place.
      map.setSky({ "atmosphere-blend": 0 } as never);
      run();
    }
  }

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const container: HTMLDivElement = element;

    // Creating the map is heavy. It waits until the browser is idle, so the
    // page paints and the introduction appears first, even on slow phones.
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    const run = () => {
      if (!cancelled) cleanup = create();
    };
    const idle = "requestIdleCallback" in window;
    const handle = idle
      ? window.requestIdleCallback(run, { timeout: 1500 })
      : window.setTimeout(run, 300);

    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      cleanup?.();
    };

    function create(): (() => void) | undefined {
      // With a mouse, scrolling over the map zooms it straight away. On touch
      // screens one finger keeps scrolling the page and two fingers move the map.
      const touch = window.matchMedia("(pointer: coarse)").matches;

      let map: MapLibreMap;
      try {
        map = new MapLibreMap({
          container,
          style: BASEMAP_STYLE,
          center: [-52, -14],
          zoom: 1,
          attributionControl: { compact: true },
          cooperativeGestures: touch,
          // Rotation and tilt start off; they are switched on at the 3D close-up.
          dragRotate: false,
          touchPitch: false,
          pitchWithRotate: true,
          rollEnabled: false,
          maxPitch: MAX_PITCH,
          locale: {
            "CooperativeGesturesHandler.WindowsHelpText": gestureText.desktop,
            "CooperativeGesturesHandler.MacHelpText": gestureText.mac,
            "CooperativeGesturesHandler.MobileHelpText": gestureText.mobile,
          },
        });
      } catch {
        callbacks.current.onError();
        return;
      }
      mapRef.current = map;
      // Handy when debugging the camera in the browser console (dev only).
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __map?: MapLibreMap }).__map = map;
      }
      setFreeCamera(map, false);

      map.on("render", updateDots);
      map.on("moveend", () => {
        setFlying(false);
        // Next turn of the event loop, so a move that was just cut short by
        // another one does not start a spin from inside that call.
        if (latest.current.intro) window.setTimeout(spin, 0);
      });

      // Orbit like a CAD viewer: hold the mouse wheel and drag to rotate and
      // tilt, or hold Shift while scrolling to rotate.
      let orbit: { x: number; y: number; id: number } | null = null;
      const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 1 || !freeRef.current) return;
        event.preventDefault();
        map.stop();
        orbit = { x: event.clientX, y: event.clientY, id: event.pointerId };
        try {
          container.setPointerCapture(event.pointerId);
        } catch {
          // Pointer already gone; the drag simply does nothing.
        }
      };
      const onPointerMove = (event: PointerEvent) => {
        if (!orbit || event.pointerId !== orbit.id) return;
        const dx = event.clientX - orbit.x;
        const dy = event.clientY - orbit.y;
        orbit.x = event.clientX;
        orbit.y = event.clientY;
        map.jumpTo({
          bearing: map.getBearing() + dx * 0.4,
          pitch: Math.min(MAX_PITCH, Math.max(0, map.getPitch() - dy * 0.3)),
        });
      };
      const onPointerUp = (event: PointerEvent) => {
        if (!orbit || event.pointerId !== orbit.id) return;
        orbit = null;
        try {
          container.releasePointerCapture(event.pointerId);
        } catch {
          // Nothing to release.
        }
      };
      // Stops the browser's own "auto-scroll" on a middle click.
      const onMouseDown = (event: MouseEvent) => {
        if (event.button === 1) event.preventDefault();
      };
      const onWheel = (event: WheelEvent) => {
        if (!event.shiftKey || !freeRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        map.setBearing(
          map.getBearing() + (event.deltaY || event.deltaX) * 0.12,
        );
      };
      container.addEventListener("pointerdown", onPointerDown);
      container.addEventListener("pointermove", onPointerMove);
      container.addEventListener("pointerup", onPointerUp);
      container.addEventListener("pointercancel", onPointerUp);
      container.addEventListener("mousedown", onMouseDown);
      container.addEventListener("wheel", onWheel, {
        capture: true,
        passive: false,
      });

      // "style.load" fires as soon as the map can be drawn, before every tile arrives.
      map.once("style.load", () => {
        recolourBasemap(map);
        map.addSource(TERRAIN_SOURCE, {
          type: "raster-dem",
          tiles: [TERRAIN_TILES],
          encoding: "terrarium",
          tileSize: 256,
          maxzoom: 14,
          attribution: TERRAIN_ATTRIBUTION,
        });
        map.addSource(RELIEF_SOURCE, {
          type: "raster-dem",
          tiles: [TERRAIN_TILES],
          encoding: "terrarium",
          tileSize: 256,
          maxzoom: 14,
        });
        const firstLabel = map
          .getStyle()
          .layers.find((layer) => layer.type === "symbol")?.id;
        // Elevation tint: valleys dark, hills lighter. It is only shown in 3D.
        try {
          map.addLayer(
            {
              id: "relief-color",
              type: "color-relief",
              source: RELIEF_SOURCE,
              minzoom: 7,
              paint: {
                "color-relief-opacity": 0,
                "color-relief-color": [
                  "interpolate",
                  ["linear"],
                  ["elevation"],
                  0,
                  "#06263a",
                  120,
                  "#0c4a63",
                  320,
                  "#1b7c8c",
                  600,
                  "#4cb38f",
                  900,
                  "#d4efb0",
                ],
              },
            },
            firstLabel,
          );
        } catch {
          // Older browsers or builds without this layer still get the shading.
        }
        map.addLayer(
          {
            id: "relief-shade",
            type: "hillshade",
            source: RELIEF_SOURCE,
            minzoom: 7,
            paint: {
              "hillshade-exaggeration": 0.22,
              "hillshade-method": "multidirectional",
              "hillshade-shadow-color": "#020810",
              "hillshade-highlight-color": "#6fc9e0",
              "hillshade-accent-color": "#0b2233",
            },
          },
          firstLabel,
        );
        map.setSky({
          "atmosphere-blend": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            1,
            5,
            1,
            7,
            0,
          ],
        });

        loadedRef.current = true;
        if (latest.current.intro) introView();
        else applyView(false);
        callbacks.current.onReady();
        // The globe fades in once it can be drawn.
        if (fadeRef.current) {
          fadeRef.current.style.transition = "opacity 900ms ease-out";
          fadeRef.current.style.opacity = "1";
        }
      });

      const resize = new ResizeObserver(() => map.resize());
      resize.observe(container);

      return () => {
        window.clearTimeout(flightTimer.current);
        window.clearTimeout(revealTimer.current);
        window.cancelAnimationFrame(glowFrame.current);
        resize.disconnect();
        container.removeEventListener("pointerdown", onPointerDown);
        container.removeEventListener("pointermove", onPointerMove);
        container.removeEventListener("pointerup", onPointerUp);
        container.removeEventListener("pointercancel", onPointerUp);
        container.removeEventListener("mousedown", onMouseDown);
        container.removeEventListener("wheel", onWheel, { capture: true });
        loadedRef.current = false;
        applied.current = {};
        mapRef.current = null;
        map.remove();
      };
    }
    // The map is created once; later changes go through applyView.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    latest.current = {
      place,
      markers,
      view,
      motion,
      intro,
      changes,
      changeOpacity,
      area,
    };
    const viewChanged = lastView.current !== view;
    lastView.current = view;
    if (intro) introView();
    else if (wasIntro.current) reveal();
    // With the whole globe or a country on screen, 2D <-> 3D unfolds the
    // globe in one smooth zoom. At the close-up the tilt already reads well.
    else if (viewChanged && !place.detail) unfold(view === "2d");
    else applyView(true);
    wasIntro.current = intro;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, view, area, intro]);

  // A different comparison picked on the timeline, or the before/after slider.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    setChangeLayers(
      map,
      changes,
      Boolean(latest.current.place.detail),
      changeOpacity,
    );
  }, [changes, changeOpacity]);

  // Reference outlines are independent of the SAR before/after opacity and camera.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (!map.isStyleLoaded()) return;
      const id = "env-reference";
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
      if (!reference || !place.detail) return;
      map.addSource(id, {type: "geojson", data: reference});
      map.addLayer({id, type: "line", source: id, paint: {
        "line-color": "#e69f00", "line-width": 2, "line-dasharray": [3, 2],
      }});
    };
    apply();
    map.on("style.load", apply);
    map.on("idle", applyOnce);
    function applyOnce() { apply(); map?.off("idle", applyOnce); }
    return () => { map.off("style.load", apply); map.off("idle", applyOnce); };
  }, [reference, place.detail]);

  // New dots appear in the right spot as soon as they are rendered.
  useEffect(() => {
    updateDots();
  }, [markers]);

  return (
    // MapLibre sets its own positioning on the element it is given, so the
    // element that fills the frame is a wrapper around it.
    <div ref={fadeRef} className="absolute inset-0" style={{ opacity: 0 }}>
      <div
        ref={containerRef}
        role="region"
        aria-label={label}
        className="h-full w-full"
      />
      <div
        ref={overlayRef}
        data-flying="false"
        className="map-dots pointer-events-none absolute inset-0 overflow-hidden"
      >
        {markers.map((marker) => (
          <button
            key={marker.id}
            ref={(element) => {
              if (element) dotRefs.current.set(marker.id, element);
              else dotRefs.current.delete(marker.id);
            }}
            type="button"
            aria-disabled={marker.available ? undefined : true}
            aria-label={
              marker.available
                ? `${marker.name}. ${dotHint}`
                : `${marker.name}. ${upcomingLabel}`
            }
            onClick={() => {
              if (marker.available) onSelect(marker.id);
            }}
            className={`map-dot pointer-events-auto invisible absolute left-0 top-0 ${
              marker.available ? "" : "map-dot-off"
            }`}
          >
            {marker.available && (
              <span aria-hidden="true" className="map-dot-ring" />
            )}
            <span aria-hidden="true" className="map-dot-core" />
            <span aria-hidden="true" className="map-dot-label">
              {marker.name}
              {!marker.available && (
                <span className="map-dot-note">{upcomingLabel}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
