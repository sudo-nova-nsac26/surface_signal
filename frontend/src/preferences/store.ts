"use client";

import { useSyncExternalStore } from "react";
import { STORAGE_KEY } from "./store-key";

/**
 * Accessibility preferences, kept in the visitor's own browser.
 * They are applied as data attributes on <html> so plain CSS can react to
 * them, and a tiny inline script (see boot-script.ts) applies them before the
 * first paint so the page never flashes in the wrong mode.
 */
export type TextSize = "md" | "lg" | "xl";

export interface Preferences {
  contrast: "default" | "high";
  textSize: TextSize;
  /**
   * auto: follow the device setting. reduce: no motion. full: motion on,
   * even when the device asks for less (the visitor chose it here).
   */
  motion: "auto" | "reduce" | "full";
  /** High-distinction palette for color-vision deficiency (protanopia/deuteranopia/tritanopia). */
  colorblind?: boolean;
  /** Wider letter, word, and line spacing for dyslexia and older adults. */
  readingSpacing?: boolean;
  /** Slower, calmer speech synthesis rate (0.76x) for older adults and easier listening. */
  speechSlow?: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  contrast: "default",
  textSize: "md",
  motion: "auto",
  colorblind: false,
  readingSpacing: false,
  speechSlow: false,
};

let current: Preferences | null = null;
const listeners = new Set<() => void>();

function readStored(): Preferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      contrast: parsed.contrast === "high" ? "high" : "default",
      textSize:
        parsed.textSize === "lg" || parsed.textSize === "xl"
          ? parsed.textSize
          : "md",
      motion:
        parsed.motion === "reduce" || parsed.motion === "full"
          ? parsed.motion
          : "auto",
      colorblind: parsed.colorblind === true,
      readingSpacing: parsed.readingSpacing === true,
      speechSlow: parsed.speechSlow === true,
    };
  } catch {
    // Private windows or blocked storage: the page still works with defaults.
    return DEFAULT_PREFERENCES;
  }
}

function systemPrefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The choice made on this site wins over the device setting. */
export function motionIsReduced(prefs: Preferences, system: boolean) {
  return prefs.motion === "reduce" || (prefs.motion === "auto" && system);
}

function applyToDocument(prefs: Preferences) {
  const root = document.documentElement;
  if (prefs.contrast === "high") root.dataset.contrast = "high";
  else delete root.dataset.contrast;
  if (prefs.textSize === "md") delete root.dataset.text;
  else root.dataset.text = prefs.textSize;
  if (motionIsReduced(prefs, systemPrefersReducedMotion()))
    root.dataset.motion = "reduce";
  else delete root.dataset.motion;
  if (prefs.colorblind) root.dataset.colorblind = "true";
  else delete root.dataset.colorblind;
  if (prefs.readingSpacing) root.dataset.spacing = "wide";
  else delete root.dataset.spacing;
  if (prefs.speechSlow) root.dataset.speech = "slow";
  else delete root.dataset.speech;
}

function getSnapshot(): Preferences {
  if (current === null) current = readStored();
  return current;
}

function getServerSnapshot(): Preferences {
  return DEFAULT_PREFERENCES;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setPreferences(patch: Partial<Preferences>) {
  current = { ...getSnapshot(), ...patch };
  applyToDocument(current);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Not saved, but still applied for this visit.
  }
  listeners.forEach((listener) => listener());
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function subscribeToMotionQuery(listener: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/**
 * True when motion should be avoided: the visitor turned on "reduce motion"
 * here, or their device asks for it and they did not turn motion back on.
 */
export function useReducedMotion(): boolean {
  const prefs = usePreferences();
  const system = useSyncExternalStore(
    subscribeToMotionQuery,
    systemPrefersReducedMotion,
    () => false,
  );
  return motionIsReduced(prefs, system);
}

export type MotionLevel = "full" | "gentle" | "none";

/**
 * How much the interface may move.
 * - none: the visitor turned motion off here.
 * - gentle: the device asks for less motion. Camera moves become short and
 *   smooth, with no sweeping flights and no spinning, so changes stay readable.
 * - full: everything.
 */
export function useMotionLevel(): MotionLevel {
  const prefs = usePreferences();
  const system = useSyncExternalStore(
    subscribeToMotionQuery,
    systemPrefersReducedMotion,
    () => false,
  );
  if (prefs.motion === "reduce") return "none";
  if (prefs.motion === "auto" && system) return "gentle";
  return "full";
}
