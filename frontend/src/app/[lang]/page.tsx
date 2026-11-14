import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { HowItWorks } from "@/components/HowItWorks";
import {
  ArrowRightIcon,
  HillIcon,
  InfoIcon,
  PlantIcon,
  WaterIcon,
} from "@/components/icons";
import { GuidedStory } from "@/components/map/GuidedStory";
import { RegionStatus } from "@/components/RegionStatus";
import type { LayerId, LayerStatus } from "@/data/region";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

const LAYERS: {
  id: LayerId;
  status: LayerStatus;
  icon: ReactNode;
  colorClass: string;
}[] = [
  {
    id: "water",
    status: "available",
    icon: <WaterIcon className="size-8" />,
    colorClass: "bg-water",
  },
  {
    id: "vegetation",
    status: "exploratory",
    icon: <PlantIcon className="size-8" />,
    colorClass: "bg-vegetation",
  },
  {
    id: "slopes",
    status: "unavailable",
    icon: <HillIcon className="size-8" />,
    colorClass: "bg-slopes",
  },
];

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <>
      <section className="starfield relative overflow-hidden hc:border-y-2 hc:border-ink">
        <div
          aria-hidden="true"
          className="horizon pointer-events-none absolute left-1/2 top-[78%] aspect-square w-[170%] -translate-x-1/2 hc:hidden sm:top-[70%] sm:w-[130%]"
        />
        <div
          aria-hidden="true"
          className="orbit pointer-events-none absolute -right-40 -top-40 hidden size-[34rem] hc:hidden lg:block"
        >
          <span className="orbit-dot absolute left-1/2 top-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand" />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-20 pt-12 sm:pb-28 sm:pt-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand bg-brand-soft px-4 py-1 text-base font-bold text-brand-text">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-brand"
              />
              {dict.hero.eyebrow}
            </p>
            <h1 className="text-gradient text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
              {dict.hero.title}
            </h1>
            <p className="mt-6 max-w-2xl text-xl text-ink-soft">
              {dict.hero.lead}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="#story"
                className="pressable glow inline-flex min-h-16 items-center gap-3 rounded-2xl bg-brand px-9 text-2xl font-bold text-brand-ink"
              >
                {dict.hero.start}
                <ArrowRightIcon />
              </a>
              <p className="text-ink-soft">{dict.hero.startHint}</p>
            </div>
          </div>

          <dl className="relative grid gap-3">
            {dict.hero.facts.map((fact) => (
              <div
                key={fact.label}
                className="card rounded-2xl border border-line bg-surface/85 px-5 py-4 backdrop-blur-sm hc:border-2 hc:bg-surface"
              >
                <dt className="text-base font-bold text-brand-text">
                  {fact.label}
                </dt>
                <dd className="text-xl font-bold leading-snug">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section
        aria-labelledby="how-title"
        className="mx-auto max-w-6xl px-4 py-12"
      >
        <h2
          id="how-title"
          className="text-3xl font-bold tracking-tight sm:text-4xl"
        >
          {dict.how.title}
        </h2>
        <HowItWorks labels={dict.how} />
      </section>

      <section
        aria-labelledby="layers-title"
        className="border-y border-line bg-bg-raised hc:border-y-2 hc:border-ink"
      >
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2
            id="layers-title"
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            {dict.layers.title}
          </h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {LAYERS.map(({ id, status, icon, colorClass }) => (
              <li
                key={id}
                className="card flex flex-col overflow-hidden rounded-3xl border border-line bg-surface hc:border-2"
              >
                <div className={`h-3 ${colorClass}`} aria-hidden="true" />
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`flex size-14 items-center justify-center rounded-2xl text-surface ${colorClass}`}
                    >
                      {icon}
                    </span>
                    <span
                      className={`rounded-full border-2 border-ink px-3 py-1 text-base font-bold ${
                        status === "available" ? "bg-ink text-surface" : ""
                      }`}
                    >
                      {dict.layers.status[status]}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold">{dict.layers[id].name}</h3>
                  <p className="text-ink-soft">{dict.layers[id].body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="story"
        aria-labelledby="story-title"
        className="starfield scroll-mt-4"
      >
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2
            id="story-title"
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            {dict.story.title}
          </h2>
          <p className="mt-2 max-w-2xl text-ink-soft">{dict.story.lead}</p>
          <GuidedStory labels={dict.map} />
          <RegionStatus lang={lang} labels={dict.region} badge={dict.illustrative} />
        </div>
      </section>

      <aside aria-labelledby="notice-title" className="bg-bg-raised">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <p className="flex gap-2 rounded-xl border-l-4 border-highlight bg-surface px-4 py-3 text-base text-ink-soft">
            <InfoIcon className="mt-0.5 shrink-0 text-highlight" />
            <span>
              <strong id="notice-title" className="text-ink">
                {dict.notice.title}.
              </strong>{" "}
              {dict.notice.body}
            </span>
          </p>
        </div>
      </aside>
    </>
  );
}
