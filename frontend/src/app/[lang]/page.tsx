import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { EnvironmentalSources } from "@/components/environment/EnvironmentalSources";
import { HowItWorks } from "@/components/HowItWorks";
import {
  ChevronDownIcon,
  HillIcon,
  InfoIcon,
  MapIcon,
  PlantIcon,
  SatelliteIcon,
  WaterIcon,
} from "@/components/icons";
import { ListenButton } from "@/components/ListenButton";
import { MapStage } from "@/components/map/MapStage";
import { RegionStatus } from "@/components/RegionStatus";
import { Reveal } from "@/components/Reveal";
import { SectionNav } from "@/components/SectionNav";
import { ShareButtons } from "@/components/ShareButtons";
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

const SOURCE_ICONS = [
  <SatelliteIcon key="satellite" className="size-8" />,
  <WaterIcon key="water" className="size-8" />,
  <MapIcon key="outline" className="size-8" />,
  <HillIcon key="relief" className="size-8" />,
];

function SectionHeading({
  id,
  number,
  children,
  action,
}: {
  id: string;
  number: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
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
      {action}
    </div>
  );
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const listen = (target: string) => (
    <ListenButton target={target} lang={lang} labels={dict.listen} />
  );

  return (
    <>
      <MapStage
        lang={lang}
        labels={dict.map}
        hero={dict.hero}
        layers={dict.layers}
        illustrative={dict.illustrative}
        environment={dict.environment}
      />

      <SectionNav labels={dict.nav} />

      <section id="how" aria-labelledby="how-title" className="section starfield">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <Reveal>
            <SectionHeading id="how-title" number="01" action={listen("how")}>
              {dict.how.title}
            </SectionHeading>
            <p className="mt-4 max-w-2xl text-xl text-ink-soft">{dict.how.lead}</p>
          </Reveal>
          <Reveal>
            <HowItWorks labels={dict.how} />
          </Reveal>
        </div>
      </section>

      <section
        id="layers"
        aria-labelledby="layers-title"
        className="section border-y border-line bg-bg-raised hc:border-y-2 hc:border-ink"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <Reveal>
            <SectionHeading id="layers-title" number="02" action={listen("layers")}>
              {dict.layers.title}
            </SectionHeading>
          </Reveal>
          <Reveal>
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
          </Reveal>
        </div>
      </section>

      <section id="region" aria-labelledby="region-title" className="section starfield">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <Reveal>
            <RegionStatus
              lang={lang}
              labels={dict.region}
              badge={dict.illustrative}
              number="03"
              action={listen("region")}
            />
          </Reveal>
        </div>
      </section>

      <section
        id="data"
        aria-labelledby="data-title"
        className="section border-y border-line bg-bg-raised hc:border-y-2 hc:border-ink"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <Reveal>
            <SectionHeading id="data-title" number="04" action={listen("data")}>
              {dict.sources.title}
            </SectionHeading>
            <p className="mt-4 max-w-2xl text-xl text-ink-soft">{dict.sources.lead}</p>
            <EnvironmentalSources labels={dict.environment} />
          </Reveal>
          <Reveal>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {dict.sources.items.map((item, index) => (
                <li
                  key={item.name}
                  className="card flex flex-col gap-3 rounded-3xl border border-line bg-surface p-6 hc:border-2"
                >
                  <span className="text-brand-text">{SOURCE_ICONS[index]}</span>
                  <h3 className="text-xl font-bold leading-tight">{item.name}</h3>
                  <p className="text-base font-bold text-brand-text">{item.who}</p>
                  <p className="text-base text-ink-soft">{item.body}</p>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal>
            <div className="mt-6 rounded-3xl border border-line bg-surface p-6 hc:border-2">
              <h3 className="text-xl font-bold">{dict.sources.honestTitle}</h3>
              <dl className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="flex gap-3">
                  <dt className="h-fit shrink-0 rounded-full border border-brand bg-brand px-3 py-1 text-base font-bold text-brand-ink">
                    {dict.sources.real}
                  </dt>
                  <dd className="text-ink-soft">{dict.sources.realBody}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="h-fit shrink-0 rounded-full border border-highlight px-3 py-1 text-base font-bold text-highlight">
                    {dict.sources.sample}
                  </dt>
                  <dd className="text-ink-soft">{dict.sources.sampleBody}</dd>
                </div>
              </dl>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="section starfield">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:py-24">
          <Reveal>
            <SectionHeading id="faq-title" number="05" action={listen("faq")}>
              {dict.faq.title}
            </SectionHeading>
          </Reveal>
          <Reveal>
            <div className="mt-8 flex flex-col gap-3">
              {dict.faq.items.map((item) => (
                <details
                  key={item.q}
                  className="faq group rounded-2xl border-2 border-line bg-surface open:border-brand hc:border-ink"
                >
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-xl font-bold">
                    {item.q}
                    <ChevronDownIcon className="shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-5 pb-5 text-lg text-ink-soft">{item.a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section
        id="help"
        aria-labelledby="help-title"
        className="section border-t-4 border-highlight bg-bg-raised"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <Reveal>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2
                id="help-title"
                className="flex items-center gap-3 text-4xl font-bold tracking-tight sm:text-5xl"
              >
                <InfoIcon className="size-10 shrink-0 text-highlight" />
                {dict.help.title}
              </h2>
              {listen("help")}
            </div>
            <p className="mt-4 max-w-2xl text-xl text-ink-soft">{dict.help.lead}</p>
          </Reveal>
          <Reveal>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {dict.help.contacts.map((contact) => (
                <li
                  key={contact.number}
                  className="flex flex-col gap-2 rounded-3xl border-2 border-line border-t-highlight bg-surface p-6 hc:border-ink"
                >
                  <span className="brand-name text-6xl leading-none text-highlight">
                    {contact.number}
                  </span>
                  <span className="text-2xl font-bold">{contact.name}</span>
                  <span className="text-lg text-ink-soft">{contact.body}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal>
            <div className="mt-10 flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 hc:border-2 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <h3 className="text-2xl font-bold">{dict.help.shareTitle}</h3>
                <p className="mt-1 text-ink-soft">{dict.help.shareBody}</p>
              </div>
              <ShareButtons lang={lang} labels={dict.help} />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
