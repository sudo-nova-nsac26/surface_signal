import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { ExternalIcon, TeamIcon } from "@/components/icons";
import { SiteHeader } from "@/components/SiteHeader";
import { hasLocale, htmlLang, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { TEAM_SITE_URL } from "@/links";
import { preferencesBootScript } from "@/preferences/boot-script";
import { atkinson, brandFont } from "@/fonts";
import "../globals.css";

// Both supported language routes are exported; unknown languages remain 404.
export const dynamicParams = false;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://surfacesignal.pages.dev";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const isPt = lang === "pt";
  return {
    metadataBase: new URL(SITE_URL),
    title: dict.meta.title,
    description: dict.meta.description,
    applicationName: "SurfaceSignal",
    authors: [{ name: "Team Sudo Nova", url: TEAM_SITE_URL }],
    creator: "Team Sudo Nova — NASA Space Apps Challenge 2026",
    publisher: "Team Sudo Nova",
    keywords: [
      "SurfaceSignal",
      "NISAR",
      "NASA",
      "ISRO",
      "SAR",
      "L-band radar",
      "GCOV",
      "HDF5",
      "Vale do Taquari",
      "Lajeado",
      "Estrela",
      "Cruzeiro do Sul",
      "Rio Taquari",
      "Rio Grande do Sul",
      "Flood Monitoring",
      "Monitoramento de Cheias",
      "NASA Space Apps Challenge 2026",
      "Sudo Nova",
    ],
    alternates: {
      canonical: `/${lang}/`,
      languages: {
        "pt-BR": "/pt/",
        en: "/en/",
        "x-default": "/en/",
      },
    },
    openGraph: {
      title: dict.meta.title,
      description: dict.meta.description,
      url: `/${lang}/`,
      siteName: "SurfaceSignal · Sudo Nova",
      locale: isPt ? "pt_BR" : "en_US",
      alternateLocale: isPt ? ["en_US"] : ["pt_BR"],
      type: "website",
      images: [
        {
          url: "/surfacesignal-logo.webp",
          width: 1200,
          height: 630,
          alt: dict.meta.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.title,
      description: dict.meta.description,
      images: ["/surfacesignal-logo.webp"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
      },
    },
    other: {
      "geo.region": "BR-RS",
      "geo.placename": "Lajeado, Estrela, Cruzeiro do Sul - Vale do Taquari, RS, Brazil",
      "geo.position": "-29.467;-51.961",
      ICBM: "-29.467, -51.961",
      citation_title:
        "SurfaceSignal: Translating NASA/ISRO NISAR L2 GCOV Radar Data into Plain Language for the Taquari Valley (RS, Brazil)",
      citation_author: "Team Sudo Nova",
      citation_publication_date: "2026",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050b14",
};

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  // Structured data for SEO & GEO (Generative Engine Optimization: ChatGPT, Gemini, Perplexity, Google Dataset Search)
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "SurfaceSignal",
        url: `${SITE_URL}/${lang}/`,
        inLanguage: htmlLang[lang],
        applicationCategory: "ScientificApplication, PublicSafetyApplication",
        operatingSystem: "Any",
        description: dict.meta.description,
        creator: {
          "@type": "Organization",
          name: "Team Sudo Nova",
          url: TEAM_SITE_URL,
        },
        about: {
          "@type": "Place",
          name: "Vale do Taquari (Lajeado, Estrela, Cruzeiro do Sul), RS, Brazil",
          geo: {
            "@type": "GeoCoordinates",
            latitude: -29.467,
            longitude: -51.961,
          },
        },
      },
      {
        "@type": "Dataset",
        name:
          lang === "pt"
            ? "Série Temporal NISAR L2 GCOV (Banda L) — Cheia do Vale do Taquari 2026 (Lajeado e Estrela)"
            : "NISAR L2 GCOV (L-Band) Time Series — 2026 Taquari Valley Flood (Lajeado & Estrela)",
        description:
          lang === "pt"
            ? "Análise radiométrica de 17 cenas HDF5 do satélite radar NISAR (NASA/ISRO, Banda L 24 cm, polarização HHHH, resolução de 10 m em EPSG:32722) sobre Lajeado, Estrela e Cruzeiro do Sul (RS), cruzada com chuva CHIRPS (87,6 mm/72h), boletins SGB, uso do solo ESA WorldCover 10m e relevo Copernicus DEM 30m."
            : "Radiometric analysis of 17 HDF5 granules from the NASA/ISRO NISAR radar satellite (L-band 24 cm, HHHH polarization, 10 m grid in EPSG:32722) over Lajeado, Estrela, and Cruzeiro do Sul (Brazil), crossed with CHIRPS rainfall (87.6 mm/72h), SGB river bulletins, ESA WorldCover 10m, and Copernicus DEM 30m.",
        url: `${SITE_URL}/${lang}/#region`,
        license: "https://creativecommons.org/publicdomain/zero/1.0/",
        isAccessibleForFree: true,
        temporalCoverage: "2026-06-17/2026-10-15",
        spatialCoverage: {
          "@type": "Place",
          name: "Lajeado & Estrela, Vale do Taquari, Rio Grande do Sul, Brazil",
          geo: {
            "@type": "GeoShape",
            box: "-29.5121 -52.0126 -29.4218 -51.9094",
          },
        },
        variableMeasured: [
          "Radar backscatter change Δγ⁰ (dB) at L-band HHHH (±3.0 dB threshold)",
          "Open-water change candidates (γ⁰ ≤ -17.0 dB and Δγ⁰ ≤ -3.0 dB)",
          "72-hour antecedent precipitation (CHIRPS v2.0, mm)",
          "Terrain elevation and hillslope angle (Copernicus DEM GLO-30, m and degrees)",
        ],
        creator: {
          "@type": "Organization",
          name: "Team Sudo Nova (NASA Space Apps Challenge 2026)",
          url: TEAM_SITE_URL,
        },
      },
    ],
  };

  return (
    // The boot script sets data attributes on <html> before React hydrates,
    // which is the one mismatch suppressHydrationWarning is meant for.
    <html
      lang={htmlLang[lang]}
      className={`${atkinson.variable} ${brandFont.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script dangerouslySetInnerHTML={{ __html: preferencesBootScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#content"
          className="sr-only z-30 rounded-xl bg-highlight px-4 py-3 font-bold text-highlight-ink focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        >
          {dict.skipToContent}
        </a>
        <SiteHeader lang={lang} dict={dict} />
        <main id="content" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-line bg-bg-raised hc:border-t-2">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-base sm:grid-cols-[auto_1fr_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sudo-nova-logo.jpeg"
              alt="Sudo Nova"
              width={112}
              height={112}
              loading="lazy"
              className="size-28 rounded-2xl border border-line"
            />
            <div>
              <h2 className="text-lg font-bold text-brand-text">
                {dict.footer.data}
              </h2>
              <p className="text-ink-soft">{dict.footer.dataBody}</p>
            </div>
            <div>
              <h2 className="text-lg font-bold text-brand-text">
                {dict.footer.team}
              </h2>
              <p className="text-ink-soft">{dict.footer.teamBody}</p>
              <a
                href={TEAM_SITE_URL}
                target="_blank"
                rel="noopener"
                className="tool-button mt-3"
              >
                <TeamIcon />
                <span>{dict.about.cta}</span>
                <ExternalIcon className="size-5" />
                <span className="sr-only"> ({dict.about.newTab})</span>
              </a>
            </div>
            <p className="text-ink-soft sm:col-span-3">{dict.footer.ai}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
