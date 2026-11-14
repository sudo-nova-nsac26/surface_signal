import { NextResponse, type NextRequest } from "next/server";

/**
 * The site lives under /pt and /en. Visitors who open the bare address are
 * sent to the language their browser asks for, falling back to English.
 */
function pickLocale(acceptLanguage: string): "pt" | "en" {
  for (const part of acceptLanguage.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();
    if (tag.startsWith("pt")) return "pt";
    if (tag.startsWith("en")) return "en";
  }
  return "en";
}

export function proxy(request: NextRequest) {
  const locale = pickLocale(request.headers.get("accept-language") ?? "");
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: "/",
};
