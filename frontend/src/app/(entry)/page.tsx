import { GlobeLoader } from "@/components/GlobeLoader";
import { LanguageEntry } from "@/components/LanguageEntry";
import Link from "next/link";

const FAST_LOCALE_REDIRECT = `
(function(){
  try {
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"];
    var target = "en";
    for (var i = 0; i < list.length; i++) {
      var tag = String(list[i] || "").trim().toLowerCase();
      if (/^pt(?:-|$)/.test(tag)) { target = "pt"; break; }
      if (/^en(?:-|$)/.test(tag)) { target = "en"; break; }
    }
    window.location.replace("/" + target + "/" + window.location.search + window.location.hash);
  } catch (e) {
    window.location.replace("/en/");
  }
})();
`;

export default function EntryPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#050b14] text-slate-100">
      <script dangerouslySetInnerHTML={{ __html: FAST_LOCALE_REDIRECT }} />
      <GlobeLoader />

      {/* Accessible & no-JS fallback links required by static export validator */}
      <nav
        aria-label="Language / Idioma"
        className="relative z-10 -mt-16 pb-8 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400"
      >
        <Link
          className="rounded-full border border-slate-700/80 bg-slate-900/70 px-3.5 py-1.5 font-bold text-slate-200 hover:border-cyan-400"
          href="/en/"
          lang="en"
          hrefLang="en"
        >
          English
        </Link>
        <Link
          className="rounded-full border border-slate-700/80 bg-slate-900/70 px-3.5 py-1.5 font-bold text-slate-200 hover:border-cyan-400"
          href="/pt/"
          lang="pt-BR"
          hrefLang="pt-BR"
        >
          Português
        </Link>
      </nav>
      <noscript>
        <div className="mx-auto max-w-md pb-8 text-center text-sm text-slate-300">
          <p>JavaScript is disabled. Use the links above to continue.</p>
          <p lang="pt-BR">JavaScript está desativado. Use os links acima para continuar.</p>
        </div>
      </noscript>
      <LanguageEntry />
    </main>
  );
}
