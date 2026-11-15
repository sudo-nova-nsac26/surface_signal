"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { SpeakerIcon, StopIcon } from "./icons";

const noop = () => () => {};
const LISTEN_EVENT = "surfacesignal:listen";

/**
 * Reads a section aloud with the browser's own voice (free, offline on most
 * phones). The text is taken from the section itself, so it always matches
 * what is on screen. Only one section speaks at a time.
 */
export function ListenButton({
  target,
  lang,
  labels,
}: {
  /** id of the element to read. */
  target: string;
  lang: Locale;
  labels: Dictionary["listen"];
}) {
  const supported = useSyncExternalStore(
    noop,
    () => "speechSynthesis" in window,
    () => false,
  );
  const [speaking, setSpeaking] = useState(false);

  // Another section started: this one is no longer speaking.
  useEffect(() => {
    const onOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== target) setSpeaking(false);
    };
    window.addEventListener(LISTEN_EVENT, onOther);
    return () => window.removeEventListener(LISTEN_EVENT, onOther);
  }, [target]);

  // Leaving the page stops this section only if it is the one speaking.
  const speakingRef = useRef(false);
  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);
  useEffect(
    () => () => {
      if (speakingRef.current) window.speechSynthesis.cancel();
    },
    [],
  );

  if (!supported) return null;

  const stop = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const start = () => {
    const root = document.getElementById(target);
    if (!root) return;
    window.speechSynthesis.cancel();
    window.dispatchEvent(new CustomEvent(LISTEN_EVENT, { detail: target }));

    const skip = [labels.start, labels.stop, labels.startLabel];
    const text = root.innerText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !skip.includes(line) && !/^\d{2}$/.test(line))
      .join(". ");
    // Short pieces: some browsers stop long utterances half way.
    const pieces = text.match(/[^.!?]+[.!?]*/g) ?? [text];
    const langTag = lang === "pt" ? "pt-BR" : "en-US";
    const voice = window.speechSynthesis
      .getVoices()
      .find((item) => item.lang.replace("_", "-").startsWith(langTag));

    pieces.forEach((piece, index) => {
      const utterance = new SpeechSynthesisUtterance(piece.trim());
      utterance.lang = langTag;
      utterance.rate = 0.95;
      if (voice) utterance.voice = voice;
      if (index === pieces.length - 1) utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    });
    setSpeaking(true);
  };

  return (
    <button
      type="button"
      onClick={speaking ? stop : start}
      aria-pressed={speaking}
      aria-label={speaking ? labels.stop : labels.startLabel}
      className="tool-button shrink-0"
    >
      {speaking ? <StopIcon className="size-5" /> : <SpeakerIcon className="size-5" />}
      <span aria-hidden="true">{speaking ? labels.stop : labels.start}</span>
    </button>
  );
}
