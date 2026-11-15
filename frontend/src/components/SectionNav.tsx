"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";

type Labels = Dictionary["nav"];
const IDS = ["map", "how", "layers", "region", "data", "faq", "help"] as const;

/**
 * A row of section links that sticks to the top once the map has scrolled
 * away. It scrolls sideways on small screens; the current section is lit.
 */
export function SectionNav({ labels }: { labels: Labels }) {
  const [active, setActive] = useState<string>("map");
  const listRef = useRef<HTMLUListElement>(null);

  // On small screens, slide the row so the lit link stays in sight.
  useEffect(() => {
    const list = listRef.current;
    const link = list?.querySelector<HTMLElement>(`a[href="#${active}"]`);
    if (!list || !link) return;
    const left = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
    list.scrollTo({ left, behavior: "smooth" });
  }, [active]);

  useEffect(() => {
    const seen = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          seen.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let best = "map";
        let ratio = 0;
        for (const id of IDS) {
          const value = seen.get(id) ?? 0;
          if (value > ratio) {
            best = id;
            ratio = value;
          }
        }
        if (ratio > 0) setActive(best);
      },
      { rootMargin: "-20% 0px -45% 0px", threshold: [0, 0.1, 0.3, 0.6] },
    );
    for (const id of IDS) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label={labels.label}
      className="section-nav sticky top-0 z-20 border-b border-line hc:border-b-2 hc:border-ink"
    >
      <ul ref={listRef} className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2">
        {IDS.map((id) => (
          <li key={id} className="shrink-0">
            <a
              href={`#${id}`}
              aria-current={active === id ? "location" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-base font-bold ${
                active === id
                  ? "bg-brand text-brand-ink hc:bg-highlight hc:text-highlight-ink"
                  : id === "help"
                    ? "text-highlight hover:bg-surface"
                    : "text-ink-soft hover:bg-surface hover:text-ink"
              }`}
            >
              {labels[id]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
