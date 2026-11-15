"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SpeakerIcon, StopIcon } from "@/components/icons";
import type { Locale } from "@/i18n/config";

const noop = () => () => {};

/**
 * Compact button that reads arbitrary text aloud using the browser's built-in
 * SpeechSynthesis engine (used inside popups and guided tour steps).
 */
export function SpeakButton({
  text,
  lang = "pt",
  label,
}: {
  text: string;
  lang?: Locale;
  label?: string;
}) {
  const supported = useSyncExternalStore(
    noop,
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    () => false,
  );
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

  useEffect(
    () => () => {
      if (speakingRef.current && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  // Stop speaking if the text changes (e.g. switching hotspot or tour step)
  useEffect(() => {
    if (speakingRef.current && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, [text]);

  if (!supported) return null;

  const stopLabel = lang === "pt" ? "Parar leitura" : "Stop reading";
  const startLabel = label ?? (lang === "pt" ? "Ouvir explicação" : "Listen");

  const toggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const langTag = lang === "pt" ? "pt-BR" : "en-US";
    const voice = window.speechSynthesis
      .getVoices()
      .find((item) => item.lang.replace("_", "-").startsWith(langTag));
    const pieces = text.match(/[^.!?]+[.!?]*/g) ?? [text];

    pieces.forEach((piece, index) => {
      const utterance = new SpeechSynthesisUtterance(piece.trim());
      utterance.lang = langTag;
      utterance.rate = 0.96;
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
      onClick={toggle}
      aria-pressed={speaking}
      aria-label={speaking ? stopLabel : startLabel}
      title={speaking ? stopLabel : startLabel}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-bg/90 px-2.5 text-xs font-bold text-ink transition hover:border-brand hover:text-brand-text"
    >
      {speaking ? <StopIcon className="size-3.5" /> : <SpeakerIcon className="size-3.5" />}
      <span>{speaking ? (lang === "pt" ? "Parar" : "Stop") : (lang === "pt" ? "Ouvir" : "Listen")}</span>
    </button>
  );
}
