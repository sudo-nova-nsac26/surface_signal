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

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.meta.title,
    description: dict.meta.description,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

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
