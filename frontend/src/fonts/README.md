# Local font assets

The existing SurfaceSignal typography is bundled so `next build` does not fetch
Google Fonts. These unmodified Latin WOFF2 subsets were already served by this
project's `next/font/google` output; PT/EN glyphs and weights are unchanged.

- Atkinson Hyperlegible 400 and 700: Braille Institute. [Upstream](https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegible), licence in `Atkinson-OFL.txt`.
- Poppins 700: Indian Type Foundry. [Upstream](https://github.com/google/fonts/tree/main/ofl/poppins), licence in `Poppins-OFL.txt`.

Both use SIL Open Font License 1.1. These third-party font licences do not set or
change the repository's licence. `next/font/local` emits fonts as static assets.

SHA-256 of these unmodified bundled files:

```text
a60206dd4793eb886952e48dc3e1c1d59942c004b2ab1e0086e7ccd156a7852d  atkinson-hyperlegible-latin-400.woff2
1cc7c0c5fbf16d1be3cb6d95c89fc0afd0e11f264e239ac97c64a326c5d88fe4  atkinson-hyperlegible-latin-700.woff2
197a3cbd7290c242c5c765268cdd69a9a39867fdc80cd13071f243a81c56fb76  poppins-latin-700.woff2
```
