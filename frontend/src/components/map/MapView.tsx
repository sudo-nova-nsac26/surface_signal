"use client";

import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { GeoJsonPolygon } from "@/data/api-types";
import {
  BASEMAP_STYLE,
  TERRAIN_ATTRIBUTION,
  TERRAIN_TILES,
  type CameraStop,
} from "./camera";

export interface MapViewHandle {
  zoomBy: (delta: number) => void;
}

export interface MapViewProps {
  ref?: Ref<MapViewHandle>;
  stops: CameraStop[];
  step: number;
  /** Flat map seen from above: no globe, no tilt, no relief. */
  simple: boolean;
  /** Jump between stops instead of flying. */
  reducedMotion: boolean;
  /** Outline of the analysed area, shown on the last stop. */
  area: GeoJsonPolygon | null;
  label: string;
  gestureText: { desktop: string; mac: string; mobile: string };
  onReady: () => void;
  onError: () => void;
}

// Copied from the installed package by scripts/copy-map-worker.mjs.
setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

const AREA_SOURCE = "analysed-area";
const TERRAIN_SOURCE = "terrain";

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
 * The map itself. It only follows orders: the parent says which stop to
 * show and the camera goes there. Rotation and free tilt are switched off;
 * the visitor can still pan and zoom.
 */
export default function MapView({
  ref,
  stops,
  step,
  simple,
  reducedMotion,
  area,
  label,
  gestureText,
  onReady,
  onError,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loadedRef = useRef(false);

  // Latest values for the map callbacks, without re-creating the map.
  const latest = useRef({ stops, step, simple, reducedMotion, area });
  useEffect(() => {
    latest.current = { stops, step, simple, reducedMotion, area };
  });
  const callbacks = useRef({ onReady, onError });
  useEffect(() => {
    callbacks.current = { onReady, onError };
  });

  useImperativeHandle(ref, () => ({
    zoomBy(delta) {
      const map = mapRef.current;
      if (!map) return;
      map.easeTo({
        zoom: map.getZoom() + delta,
        duration: latest.current.reducedMotion ? 0 : 300,
      });
    },
  }));

  function applyView(animate: boolean) {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const { stops, step, simple, reducedMotion, area } = latest.current;
    const stop = stops[Math.min(step, stops.length - 1)];
    const isRegion = step === stops.length - 1;

    map.setProjection({ type: simple ? "mercator" : "globe" });
    map.setTerrain(
      !simple && isRegion ? { source: TERRAIN_SOURCE, exaggeration: 1.7 } : null,
    );

    ensureAreaLayers(map, area);
    const hasArea = Boolean(area);
    for (const layer of ["analysed-area-fill", "analysed-area-line"]) {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(
          layer,
          "visibility",
          hasArea && isRegion ? "visible" : "none",
        );
      }
    }

    const camera = {
      center: stop.center,
      zoom: simple && isRegion ? stop.zoom + 0.3 : stop.zoom,
      pitch: simple ? 0 : stop.pitch,
      bearing: 0,
    };
    if (animate && !reducedMotion) {
      map.flyTo({ ...camera, duration: 3200, essential: true });
    } else {
      map.jumpTo(camera);
    }
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let map: MapLibreMap;
    try {
      const first = latest.current.stops[0];
      map = new MapLibreMap({
        container,
        style: BASEMAP_STYLE,
        center: first.center,
        zoom: first.zoom,
        attributionControl: { compact: true },
        // The page keeps scrolling normally; zooming needs a deliberate gesture.
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        rollEnabled: false,
        maxPitch: 60,
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
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();

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
      // Shaded relief makes the valley and the hills readable at a glance.
      map.addSource("relief", {
        type: "raster-dem",
        tiles: [TERRAIN_TILES],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 14,
      });
      const firstLabel = map
        .getStyle()
        .layers.find((layer) => layer.type === "symbol")?.id;
      map.addLayer(
        {
          id: "relief-shade",
          type: "hillshade",
          source: "relief",
          minzoom: 7,
          paint: {
            "hillshade-exaggeration": 0.55,
            "hillshade-shadow-color": "#020810",
            "hillshade-highlight-color": "#3f8fae",
            "hillshade-accent-color": "#0b2233",
          },
        },
        firstLabel,
      );
      map.setSky({
        "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
      });

      loadedRef.current = true;
      applyView(false);
      callbacks.current.onReady();
    });

    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container);

    return () => {
      resize.disconnect();
      loadedRef.current = false;
      mapRef.current = null;
      map.remove();
    };
    // The map is created once; later changes go through applyView.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    latest.current = { stops, step, simple, reducedMotion, area };
    applyView(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, simple, stops, area]);

  return (
    // MapLibre sets its own positioning on the element it is given, so the
    // element that fills the frame is a wrapper around it.
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        role="region"
        aria-label={label}
        className="h-full w-full"
      />
    </div>
  );
}
