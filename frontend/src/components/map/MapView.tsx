"use client";

import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { GeoJsonPolygon } from "@/data/api-types";
import type { LngLat } from "@/data/region";
import {
  BASEMAP_STYLE,
  TERRAIN_ATTRIBUTION,
  TERRAIN_TILES,
  type ViewMode,
} from "./camera";
import type { Place } from "./places";

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
  /** Jump between places instead of flying. */
  reducedMotion: boolean;
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
const TERRAIN_SOURCE = "terrain";
const RELIEF_SOURCE = "relief";
const FLIGHT_MS = 3200;
const DETAIL_PITCH = 62;
const MAX_PITCH = 78;
const RELIEF_EXAGGERATION = 2.8;

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
    Math.cos(a[1] * rad) *
      Math.cos(b[1] * rad) *
      Math.cos((a[0] - b[0]) * rad);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / rad;
}

/** Room left for the panels laid over the map, so places are not hidden. */
function framePadding(width: number) {
  return width >= 900
    ? { top: 96, bottom: 72, left: 440, right: 96 }
    : { top: 84, bottom: 260, left: 28, right: 28 };
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
  reducedMotion,
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
  const applied = useRef<{ globe?: boolean; relief?: boolean }>({});

  // Latest values for the map callbacks, without re-creating the map.
  const latest = useRef({ place, markers, view, reducedMotion, area });
  useEffect(() => {
    latest.current = { place, markers, view, reducedMotion, area };
  });
  const callbacks = useRef({ onReady, onError });
  useEffect(() => {
    callbacks.current = { onReady, onError };
  });

  useImperativeHandle(ref, () => ({
    zoomBy(delta) {
      mapRef.current?.easeTo({
        zoom: mapRef.current.getZoom() + delta,
        duration: latest.current.reducedMotion ? 0 : 300,
      });
    },
    rotateBy(degrees) {
      const map = mapRef.current;
      map?.easeTo({
        bearing: map.getBearing() + degrees,
        duration: latest.current.reducedMotion ? 0 : 350,
      });
    },
    tiltBy(degrees) {
      const map = mapRef.current;
      map?.easeTo({
        pitch: Math.min(MAX_PITCH, Math.max(0, map.getPitch() + degrees)),
        duration: latest.current.reducedMotion ? 0 : 350,
      });
    },
    resetView() {
      mapRef.current?.easeTo({
        bearing: 0,
        pitch: latest.current.view === "3d" ? DETAIL_PITCH : 0,
        duration: latest.current.reducedMotion ? 0 : 500,
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

  function applyView(animate: boolean) {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container || !loadedRef.current) return;
    const { place, view, reducedMotion, area } = latest.current;
    const is3d = view === "3d";
    const detail = place.detail;
    const relief = is3d && Boolean(detail);

    // These are only touched when they change: setting them again would
    // interrupt a flight that is already under way.
    if (applied.current.globe !== is3d) {
      applied.current.globe = is3d;
      map.setProjection({ type: is3d ? "globe" : "mercator" });
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

    ensureAreaLayers(map, area);
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
    } else {
      const fitted = map.cameraForBounds(place.bounds, { padding, maxZoom: 9 });
      const center = fitted?.center as { lng: number; lat: number } | undefined;
      target = {
        center: center
          ? [center.lng, center.lat]
          : [
              (place.bounds[0][0] + place.bounds[1][0]) / 2,
              (place.bounds[0][1] + place.bounds[1][1]) / 2,
            ],
        zoom: Math.max(fitted?.zoom ?? 1.2, 0.9),
      };
    }
    const camera = {
      ...target,
      pitch: relief ? DETAIL_PITCH : 0,
      bearing: 0,
      // Keeps the place clear of the panels laid over the map.
      padding,
    };

    if (animate && !reducedMotion) {
      setFlying(true);
      map.flyTo({
        ...camera,
        duration: FLIGHT_MS,
        curve: 1.5,
        essential: true,
      });
    } else {
      map.jumpTo(camera);
    }
    updateDots();
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
    setFreeCamera(map, false);

    map.on("render", updateDots);
    map.on("moveend", () => setFlying(false));

    // Orbit like a CAD viewer: hold the mouse wheel and drag to rotate and
    // tilt, or hold Shift while scrolling to rotate.
    let orbit: { x: number; y: number; id: number } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 1 || !freeRef.current) return;
      event.preventDefault();
      map.stop();
      orbit = { x: event.clientX, y: event.clientY, id: event.pointerId };
      container.setPointerCapture(event.pointerId);
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
      container.releasePointerCapture(event.pointerId);
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
        "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
      });

      loadedRef.current = true;
      applyView(false);
      callbacks.current.onReady();
    });

    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container);

    return () => {
      window.clearTimeout(flightTimer.current);
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
    // The map is created once; later changes go through applyView.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    latest.current = { place, markers, view, reducedMotion, area };
    applyView(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, view, area]);

  // New dots appear in the right spot as soon as they are rendered.
  useEffect(() => {
    updateDots();
  }, [markers]);

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
