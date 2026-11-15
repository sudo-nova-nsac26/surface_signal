import { STORAGE_KEY } from "./store-key";

/**
 * Runs before the first paint. Mirrors applyToDocument() in store.ts, written
 * as a plain string because it must execute before React loads.
 */
export const preferencesBootScript = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)})||"{}"),d=document.documentElement;d.dataset.js="1";if(p.contrast==="high")d.dataset.contrast="high";if(p.textSize==="lg"||p.textSize==="xl")d.dataset.text=p.textSize;if(p.motion==="reduce"||(p.motion!=="full"&&matchMedia("(prefers-reduced-motion: reduce)").matches))d.dataset.motion="reduce";if(p.colorblind===true)d.dataset.colorblind="true";if(p.readingSpacing===true)d.dataset.spacing="wide";if(p.speechSlow===true)d.dataset.speech="slow"}catch(e){}})();`;
