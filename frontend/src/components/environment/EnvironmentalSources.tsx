"use client";
import { useEffect, useState, useRef } from "react";
import type { ContextSource } from "@/data/api-types";
import type { Dictionary } from "@/i18n/get-dictionary";
import { DataSourceError, listContextSources } from "@/data/source";
import { safeSourceUrl } from "@/data/environmental";
export function EnvironmentalSources({labels: l}: {labels: Dictionary["environment"]}) {
  const [sources, setSources] = useState<ContextSource[]>([]);
  const [status, setStatus] = useState("loading");
  const [attempt, retry] = useState(0);
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => listContextSources(controller.signal).then(value => {
      if (!controller.signal.aborted) { setSources(value); setStatus("ready"); }
    }).catch(error => { if (!controller.signal.aborted) setStatus(error instanceof DataSourceError && error.status === 404 ? "missing" : "error"); });
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { observer.disconnect(); void load(); }
    });
    if (target.current) observer.observe(target.current);
    return () => { observer.disconnect(); controller.abort(); };
  }, [attempt]);
  return <div ref={target} className="mt-8 border-t border-line pt-6">
    <h3 className="text-2xl font-bold">{l.otherSources}</h3>
    <p className="mt-2 max-w-2xl text-ink-soft">{l.catalogNote}</p>
    {status === "loading" && <p role="status">{l.loading}</p>}
    {status === "missing" && <p>{l.notPrepared}</p>}
    {status === "error" && <div><p>{l.error}</p><button className="min-h-12 rounded-xl border-2 border-line px-4" onClick={() => {setStatus("loading");retry(n => n+1);}}>{l.retry}</button></div>}
    <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">{sources.map(source => <li key={source.source_id} className="border-b border-line py-4">
      <h4 className="font-bold">{safeSourceUrl(source.url) ? <a href={safeSourceUrl(source.url)!} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center text-brand-text underline">{source.name}</a> : source.name}</h4>
      <p>{l.integration[source.integration_status]}</p>
    </li>)}</ul>
  </div>;
}
