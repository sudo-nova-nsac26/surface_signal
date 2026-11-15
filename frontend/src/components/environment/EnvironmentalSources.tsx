"use client";

import { useEffect, useRef, useState } from "react";
import type { ContextSource } from "@/data/api-types";
import { safeSourceUrl } from "@/data/environmental";
import { DataSourceError, listContextSources } from "@/data/source";
import type { Dictionary } from "@/i18n/get-dictionary";

// These six contextual sources are already credited as ingested pilot inputs
// in the main source cards. NISAR itself is credited there separately.
// The API's "import_ready" status describes an adapter, NOT evidence that a
// particular source has been used: list only other registered possibilities here.
const PILOT_CONTEXT_SOURCE_IDS = new Set([
  "sgb-taquari",
  "chirps-v3",
  "jrc-gsw",
  "worldcover",
  "copernicus-dem",
  "ibge",
]);

export function EnvironmentalSources({
  labels: l,
}: {
  labels: Dictionary["environment"];
}) {
  const [sources, setSources] = useState<ContextSource[]>([]);
  const [status, setStatus] = useState("loading");
  const [attempt, retry] = useState(0);
  const target = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void listContextSources(controller.signal)
        .then((values) => {
          if (controller.signal.aborted) return;
          setSources(
            values.filter((source) => !PILOT_CONTEXT_SOURCE_IDS.has(source.source_id)),
          );
          setStatus("ready");
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setStatus(
            error instanceof DataSourceError && error.status === 404
              ? "missing"
              : "error",
          );
        });
    });
    if (target.current) observer.observe(target.current);
    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, [attempt]);

  return (
    <details ref={target} className="mt-8 border-t border-line pt-6">
      <summary className="cursor-pointer text-xl font-bold text-brand-text">
        {l.otherSources}
      </summary>
      <p className="mt-3 max-w-2xl text-ink-soft">{l.catalogNote}</p>
      {status === "loading" && <p role="status">{l.loading}</p>}
      {status === "missing" && <p>{l.notPrepared}</p>}
      {status === "error" && (
        <div>
          <p>{l.error}</p>
          <button
            className="min-h-12 rounded-xl border-2 border-line px-4"
            onClick={() => {
              setStatus("loading");
              retry((n) => n + 1);
            }}
          >
            {l.retry}
          </button>
        </div>
      )}
      {status === "ready" && (
        <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
          {sources.map((source) => {
            const url = safeSourceUrl(source.url);
            return (
              <li key={source.source_id} className="border-b border-line py-4">
                <h4 className="font-bold">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 items-center text-brand-text underline"
                    >
                      {source.name}
                    </a>
                  ) : (
                    source.name
                  )}
                </h4>
                <p>{l.integration[source.integration_status]}</p>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
