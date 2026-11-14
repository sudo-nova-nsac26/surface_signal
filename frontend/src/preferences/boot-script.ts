import { STORAGE_KEY } from "./store-key";

/**
 * Runs before the first paint. Mirrors applyToDocument() in store.ts, written
 * as a plain string because it must execute before React loads.
 */
export const preferencesBootScript = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)})||"{}"),d=document.documentElement;if(p.contrast==="high")d.dataset.contrast="high";if(p.textSize==="lg"||p.textSize==="xl")d.dataset.text=p.textSize;if(p.motion==="reduce")d.dataset.motion="reduce"}catch(e){}})();`;
