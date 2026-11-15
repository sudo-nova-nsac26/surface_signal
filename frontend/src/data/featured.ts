/**
 * The comparisons the guided story shows, out of the 17 the backend prepared.
 *
 * All five come from the same acquisition group (descending pass, track 53,
 * frame 103: same path, same angle, same time of day), so they can be read
 * one after the other without mixing different geometries. They are matched
 * by the dates of the two passes; the identity used everywhere else is the
 * backend's comparison_id. A pair missing from the data is simply skipped.
 *
 * Why these: comparisons around the documented July river event, plus the two
 * comparisons of the period with the largest signal increase and the largest
 * signal decrease (from the backend statistics). "Largest" describes the
 * measured area only; it is not severity or risk.
 */
export type FeaturedReason = "before" | "flood" | "after" | "increase" | "decrease";

export const FEATURED: { before: string; after: string; reason: FeaturedReason }[] = [
  { before: "2026-06-29", after: "2026-07-11", reason: "before" },
  { before: "2026-07-11", after: "2026-07-23", reason: "flood" },
  { before: "2026-07-23", after: "2026-08-16", reason: "after" },
  { before: "2026-09-09", after: "2026-09-21", reason: "increase" },
  { before: "2026-09-21", after: "2026-10-03", reason: "decrease" },
];

/** "flood" is a legacy timeline key for the July context, never a validated map class. */
export const FEATURED_START: FeaturedReason = "flood";
