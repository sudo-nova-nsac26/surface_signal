import { LanguageEntry } from "@/components/LanguageEntry";
import Link from "next/link";

export default function EntryPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6 py-12">
      <h1 className="font-brand text-4xl font-bold">SurfaceSignal</h1>
      <p lang="pt-BR">Escolha seu idioma.</p>
      <p>Choose your language.</p>
      <nav aria-label="Language / Idioma" className="flex flex-wrap gap-4">
        <Link className="tool-button" href="/pt/" lang="pt-BR" hrefLang="pt-BR">Português</Link>
        <Link className="tool-button" href="/en/" lang="en" hrefLang="en">English</Link>
      </nav>
      <noscript>
        <p lang="pt-BR">JavaScript está desativado. Use os links acima para continuar.</p>
        <p>JavaScript is disabled. Use the links above to continue.</p>
      </noscript>
      <LanguageEntry />
    </main>
  );
}
