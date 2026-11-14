import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { HowItWorks } from "@/components/HowItWorks";
import {
  HillIcon,
  InfoIcon,
  PlantIcon,
  WaterIcon,
} from "@/components/icons";
import { MapStage } from "@/components/map/MapStage";
import { RegionStatus } from "@/components/RegionStatus";
import type { LayerId, LayerStatus } from "@/data/region";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

const LAYERS: {
  id: LayerId;
  status: LayerStatus;
  icon: ReactNode;
  colorClass: string;
  textClass: string;
}[] = [
  {
    id: "water",
    status: "available",
    icon: <WaterIcon className="size-9" />,
    colorClass: "bg-water",
    textClass: "text-water",
  },
  {
    id: "vegetation",
    status: "exploratory",
    icon: <PlantIcon className="size-9" />,
    colorClass: "bg-vegetation",
    textClass: "text-vegetation",
  },
  {
    id: "slopes",
    status: "unavailable",
    icon: <HillIcon className="size-9" />,
    colorClass: "bg-slopes",
    textClass: "text-slopes",
  },
];

function SectionHeading({
  id,
  number,
  children,
}: {
  id: string;
  number: string;
  children: ReactNode;
}) {
  return (
    <h2 id={id} className="flex items-baseline gap-4">
      <span
        aria-hidden="true"
        className="text-xl font-bold tabular-nums text-brand-text"
      >
        {number}
      </span>
      <span className="text-4xl font-bold tracking-tight sm:text-5xl">
        {children}
      </span>
    </h2>
  );
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <>
      <MapStage labels={dict.map} hero={dict.hero} />

      <section
        id="how"
        aria-labelledby="how-title"
        className="starfield scroll-mt-4"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <SectionHeading id="how-title" number="01">
            {dict.how.title}
          </SectionHeading>
          <HowItWorks labels={dict.how} />
        </div>
      </section>

      <section
        aria-labelledby="layers-title"
        className="border-y border-line bg-bg-raised hc:border-y-2 hc:border-ink"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <SectionHeading id="layers-title" number="02">
            {dict.layers.title}
          </SectionHeading>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {LAYERS.map(({ id, status, icon, colorClass, textClass }) => (
              <li
                key={id}
                className="card relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-line bg-surface p-6 hc:border-2"
              >
                <span
                  aria-hidden="true"
                  className={`absolute -right-10 -top-10 size-32 rounded-full opacity-15 blur-2xl hc:hidden ${colorClass}`}
                />
                <div className="flex items-center justify-between gap-3">
                  <span className={textClass}>{icon}</span>
                  <span
                    className={`rounded-full border px-3 py-1 text-base font-bold ${
                      status === "available"
                        ? "border-brand bg-brand text-brand-ink"
                        : "border-line text-ink-soft hc:border-ink hc:text-ink"
                    }`}
                  >
                    {dict.layers.status[status]}
                  </span>
                </div>
                <h3 className="text-2xl font-bold">{dict.layers[id].name}</h3>
                <p className="text-ink-soft">{dict.layers[id].body}</p>
                <span
                  aria-hidden="true"
                  className={`mt-auto h-1 w-16 rounded-full ${colorClass}`}
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="region-title" className="starfield">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <RegionStatus
            lang={lang}
            labels={dict.region}
            badge={dict.illustrative}
            number="03"
          />
          <p className="mt-8 flex gap-2 rounded-xl border-l-4 border-highlight bg-surface px-4 py-3 text-base text-ink-soft">
            <InfoIcon className="mt-0.5 shrink-0 text-highlight" />
            <span>
              <strong className="text-ink">{dict.notice.title}.</strong>{" "}
              {dict.notice.body}
            </span>
          </p>
        </div>
      </section>
    </>
  );
}
