"use client";

import { useEffect } from "react";
import { pickLocale } from "@/i18n/pick-locale";

export function LanguageEntry() {
  useEffect(() => {
    const locale = pickLocale(navigator.languages ?? [navigator.language]);
    window.location.replace(`/${locale}/${window.location.search}${window.location.hash}`);
  }, []);
  return null;
}
