/**
 * Decides whether this device can show the 3D globe smoothly.
 *
 * Two steps. First a quick look at what the device reports (graphics
 * support, memory, processor cores, data saver, phone or computer). Then,
 * while the introduction is on screen, a short measurement of how smoothly
 * the page actually draws. Nothing leaves the device: no hardware details
 * are stored or sent anywhere.
 *
 * The result only picks the starting view. The visitor can always switch.
 */
export type GraphicsTier = "high" | "low";

export interface GraphicsAssessment {
  tier: GraphicsTier;
  /** Plain reasons, for debugging in the console. Not shown to visitors. */
  reasons: string[];
}

interface NavigatorHints extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
}

/** Graphics drivers that draw in software: far too slow for a globe. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software|basic render|microsoft basic|softpipe|mesa offscreen/i;

function webglInfo(): { ok: boolean; webgl2: boolean; renderer: string } {
  try {
    const canvas = document.createElement("canvas");
    const gl2 = canvas.getContext("webgl2");
    const gl = gl2 ?? canvas.getContext("webgl");
    if (!gl) return { ok: false, webgl2: false, renderer: "" };
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = debug
      ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { ok: true, webgl2: Boolean(gl2), renderer };
  } catch {
    return { ok: false, webgl2: false, renderer: "" };
  }
}

export function assessGraphics(): GraphicsAssessment {
  const reasons: string[] = [];
  const nav = navigator as NavigatorHints;

  const gl = webglInfo();
  if (!gl.ok) reasons.push("no WebGL");
  else if (!gl.webgl2) reasons.push("WebGL 1 only");
  if (gl.renderer && SOFTWARE_RENDERER.test(gl.renderer)) {
    reasons.push(`software graphics (${gl.renderer})`);
  }

  const memory = nav.deviceMemory;
  if (memory !== undefined && memory < 4) reasons.push(`memory ${memory} GB`);

  const cores = navigator.hardwareConcurrency;
  if (cores !== undefined && cores < 4) reasons.push(`${cores} cores`);

  if (nav.connection?.saveData) reasons.push("data saver is on");
  const effective = nav.connection?.effectiveType;
  if (effective && /(^|-)2g|3g/.test(effective)) {
    reasons.push(`slow connection (${effective})`);
  }

  // Phones and tablets: many are fast, but older people often use older
  // ones, and browsers such as Safari do not report memory. Without proof
  // of a strong device, start light.
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && (memory === undefined || memory < 6)) {
    reasons.push("touch device without proof of a strong one");
  }

  return { tier: reasons.length === 0 ? "high" : "low", reasons };
}

/**
 * Average frames per second over a short window, or null when the page was
 * hidden or too few frames were drawn to tell.
 */
export function measureFps(durationMs: number): Promise<number | null> {
  return new Promise((resolve) => {
    let frames = 0;
    let start = 0;
    const tick = (time: number) => {
      if (document.visibilityState === "hidden") {
        resolve(null);
        return;
      }
      if (start === 0) start = time;
      frames += 1;
      if (time - start >= durationMs) {
        resolve(frames >= 8 ? (frames * 1000) / (time - start) : null);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Below this the globe would stutter. */
export const SMOOTH_FPS = 40;
