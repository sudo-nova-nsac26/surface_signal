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
  motion: "auto" | "reduce";
}

export const DEFAULT_PREFERENCES: Preferences = {
  contrast: "default",
  textSize: "md",
  motion: "auto",
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
      motion: parsed.motion === "reduce" ? "reduce" : "auto",
    };
  } catch {
    // Private windows or blocked storage: the page still works with defaults.
    return DEFAULT_PREFERENCES;
  }
}

function applyToDocument(prefs: Preferences) {
  const root = document.documentElement;
  if (prefs.contrast === "high") root.dataset.contrast = "high";
  else delete root.dataset.contrast;
  if (prefs.textSize === "md") delete root.dataset.text;
  else root.dataset.text = prefs.textSize;
  if (prefs.motion === "reduce") root.dataset.motion = "reduce";
  else delete root.dataset.motion;
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
 * True when motion should be avoided: either the visitor turned on
 * "reduce motion" here, or their device already asks for it.
 */
export function useReducedMotion(): boolean {
  const { motion } = usePreferences();
  const systemPrefersReduce = useSyncExternalStore(
    subscribeToMotionQuery,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  return motion === "reduce" || systemPrefersReduce;
}
