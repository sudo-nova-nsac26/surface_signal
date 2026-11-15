"use client";
import { useEffect, useState } from "react";
import type { EnvironmentalContextReport, EnvironmentalEvent, ReferenceLayer } from "@/data/api-types";
import { DataSourceError, getEnvironmentalContext, listEnvironmentalEvents, listReferenceLayers } from "@/data/source";

type Load<T> = { key: string; status: "ready"; value: T } | {key: string; status: "loading" | "missing" | "error"};
export function useEnvironmental(areaId: string | null, analysisId: string | null) {
  const [attempt, retry] = useState(0);
  const [report, setReport] = useState<Load<EnvironmentalContextReport> | null>(null);
  const [region, setRegion] = useState<Load<{events: EnvironmentalEvent[]; layers: ReferenceLayer[]}> | null>(null);
  useEffect(() => {
    if (!analysisId) return;
    const controller = new AbortController();
    getEnvironmentalContext(analysisId, controller.signal).then(value => {
      if (!controller.signal.aborted) setReport({key: analysisId, status: "ready", value});
    }).catch(error => {
      if (!controller.signal.aborted) setReport({key: analysisId, status: error instanceof DataSourceError && error.status === 404 ? "missing" : "error"});
    });
    return () => controller.abort();
  }, [analysisId, attempt]);
  useEffect(() => {
    if (!areaId) return;
    const controller = new AbortController();
    const optional = async <T,>(request: Promise<T>, empty: T): Promise<T> => {
      try { return await request; } catch (error) {
        if (error instanceof DataSourceError && error.status === 404) return empty;
        throw error;
      }
    };
    Promise.all([
      optional(listEnvironmentalEvents(areaId, undefined, undefined, controller.signal), []),
      optional(listReferenceLayers(areaId, controller.signal), []),
    ]).then(([events, layers]) => {
      if (!controller.signal.aborted) setRegion({key: areaId, status: "ready", value: {events, layers}});
    }).catch(() => {
      if (!controller.signal.aborted) setRegion({key: areaId, status: "error"});
    });
    return () => controller.abort();
  }, [areaId, attempt]);
  return {
    report: analysisId ? report?.key === analysisId ? report : {key: analysisId, status: "loading" as const} : null,
    region: areaId ? region?.key === areaId ? region : {key: areaId, status: "loading" as const} : null,
    retry: () => { setReport(null); setRegion(null); retry(n => n + 1); },
  };
}
export type EnvironmentalState = ReturnType<typeof useEnvironmental>;
