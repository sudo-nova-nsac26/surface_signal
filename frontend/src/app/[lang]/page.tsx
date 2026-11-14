import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  CompareIcon,
  HillIcon,
  InfoIcon,
  PaintIcon,
  PlantIcon,
  SatelliteIcon,
  WaterIcon,
} from "@/components/icons";
import type { LayerId, LayerStatus } from "@/data/types";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

const HOW_ICONS = [SatelliteIcon, CompareIcon, PaintIcon];

const LAYERS: {
  id: LayerId;
  status: LayerStatus;
  icon: ReactNode;
  colorClass: string;
}[] = [
  {
    id: "water",
    status: "available",
    icon: <WaterIcon />,
    colorClass: "bg-water",
  },
  {
    id: "vegetation",
    status: "exploratory",
    icon: <PlantIcon />,
    colorClass: "bg-vegetation",
  },
  {
    id: "slopes",
    status: "unavailable",
    icon: <HillIcon />,
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
        className="border-b-2 border-ink bg-notice-bg text-notice-ink"
      >
        <div className="mx-auto flex max-w-5xl gap-3 px-4 py-3">
          <InfoIcon className="mt-1 shrink-0" />
          <p className="text-base">
            <strong id="notice-title">{dict.notice.title}.</strong>{" "}
            {dict.notice.body}
          </p>
        </div>
      </aside>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
        <p className="mb-3 font-bold text-accent">{dict.hero.eyebrow}</p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          {dict.hero.title}
        </h1>
        <p className="mt-5 max-w-2xl text-xl text-ink-soft">{dict.hero.lead}</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href="#story"
            className="inline-flex min-h-16 items-center gap-3 rounded-2xl border-2 border-ink bg-accent px-8 text-2xl font-bold text-accent-ink"
          >
            {dict.hero.start}
            <ArrowRightIcon />
          </a>
          <p className="text-ink-soft">{dict.hero.startHint}</p>
        </div>
      </section>

      <section
        aria-labelledby="how-title"
        className="border-y-2 border-ink bg-surface"
      >
        <div className="mx-auto max-w-5xl px-4 py-10">
          <h2 id="how-title" className="text-3xl font-bold">
            {dict.how.title}
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {dict.how.steps.map((step, index) => {
              const StepIcon = HOW_ICONS[index];
              return (
                <li
                  key={step.title}
                  className="rounded-2xl border-2 border-ink bg-bg p-5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-10 items-center justify-center rounded-full bg-ink text-xl font-bold text-bg"
                    >
                      {index + 1}
                    </span>
                    <StepIcon className="text-accent" />
                  </div>
                  <h3 className="mt-3 text-xl font-bold">{step.title}</h3>
                  <p className="mt-1 text-ink-soft">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="layers-title"
        className="mx-auto max-w-5xl px-4 py-10"
      >
        <h2 id="layers-title" className="text-3xl font-bold">
          {dict.layers.title}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {LAYERS.map(({ id, status, icon, colorClass }) => (
            <li
              key={id}
              className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-surface p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`flex size-12 items-center justify-center rounded-xl border-2 border-ink text-surface ${colorClass}`}
                >
                  {icon}
                </span>
                <span
                  className={`rounded-full border-2 border-ink px-3 py-1 text-base font-bold ${
                    status === "available" ? "bg-ink text-bg" : ""
                  }`}
                >
                  {dict.layers.status[status]}
                </span>
              </div>
              <h3 className="text-xl font-bold">{dict.layers[id].name}</h3>
              <p className="text-ink-soft">{dict.layers[id].body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="story"
        aria-labelledby="story-title"
        className="scroll-mt-4 border-t-2 border-ink bg-surface"
      >
        <div className="mx-auto max-w-5xl px-4 py-10">
          <h2 id="story-title" className="text-3xl font-bold">
            {dict.story.title}
          </h2>
          <p className="mt-2 max-w-2xl text-ink-soft">{dict.story.lead}</p>
          <ol className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {dict.story.steps.map((step, index) => (
              <li key={step} className="flex items-center gap-3">
                {index > 0 && (
                  <ArrowRightIcon className="hidden shrink-0 text-ink-soft sm:block" />
                )}
                <span className="flex min-h-14 flex-1 items-center gap-3 rounded-2xl border-2 border-ink bg-bg px-4 py-2 font-bold">
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-base text-bg"
                  >
                    {index + 1}
                  </span>
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
