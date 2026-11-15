import { notFound } from "next/navigation";
import { DataLab } from "@/components/lab/DataLab";
import { hasLocale } from "@/i18n/config";

/**
 * Development-only data lab: shows every kind of backend data on a map, one
 * comparison at a time, with sizes and timings. It is not linked anywhere
 * and answers 404 in production builds.
 */
export default async function LabPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <DataLab initialLang={lang} />;
}
