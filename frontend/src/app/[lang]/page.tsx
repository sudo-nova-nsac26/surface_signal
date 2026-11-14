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
      <aside
        aria-labelledby="notice-title"
        className="bg-highlight text-highlight-ink"
      >
        <div className="mx-auto flex max-w-6xl gap-3 px-4 py-3">
          <InfoIcon className="mt-0.5 shrink-0" />
          <p className="text-base">
            <strong id="notice-title">{dict.notice.title}.</strong>{" "}
            {dict.notice.body}
          </p>
        </div>
      </aside>

      <section className="relative overflow-hidden bg-brand-deep text-brand-ink hc:border-y-2 hc:border-ink">
        <div
          aria-hidden="true"
          className="flag-corner pointer-events-none absolute -bottom-px right-0 hidden h-40 w-72 opacity-90 lg:block"
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center">
          <div>
            <p className="mb-4 inline-block rounded-full bg-highlight px-4 py-1 text-base font-bold text-highlight-ink">
              {dict.hero.eyebrow}
            </p>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
              {dict.hero.title}
            </h1>
            <p className="mt-5 max-w-2xl text-xl opacity-95">
              {dict.hero.lead}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#story"
                className="pressable inline-flex min-h-16 items-center gap-3 rounded-2xl bg-highlight px-8 text-2xl font-bold text-highlight-ink shadow-lg"
              >
                {dict.hero.start}
                <ArrowRightIcon />
              </a>
              <p className="opacity-90">{dict.hero.startHint}</p>
            </div>
          </div>

          <dl className="relative grid gap-3 rounded-3xl bg-surface p-5 text-ink shadow-xl hc:border-2 hc:border-ink">
            {dict.hero.facts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-2xl bg-brand-soft px-4 py-3 hc:border hc:border-ink"
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
        className="bg-surface hc:border-y-2 hc:border-ink"
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
                className="flex flex-col overflow-hidden rounded-3xl border border-line bg-bg shadow-sm hc:border-2"
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
        className="scroll-mt-4 bg-brand-soft"
      >
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2
            id="story-title"
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            {dict.story.title}
          </h2>
          <p className="mt-2 max-w-2xl text-ink-soft">{dict.story.lead}</p>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {dict.story.steps.map((step, index) => (
              <li
                key={step}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 font-bold shadow-sm hc:border-2"
              >
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-xl text-brand-ink hc:bg-highlight hc:text-highlight-ink"
                >
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <RegionStatus lang={lang} labels={dict.region} badge={dict.illustrative} />
        </div>
      </section>
    </>
  );
}
