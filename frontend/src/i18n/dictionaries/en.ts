import type { Dictionary } from "./pt";

const en: Dictionary = {
  meta: {
    title: "SurfaceSignal — what the satellite saw on the Taquari River",
    description:
      "See, in plain colors, what a NASA radar observed in Lajeado and Estrela, Brazil, during the July 2026 flood. Built for anyone to understand.",
  },
  skipToContent: "Skip to content",
  brand: {
    name: "SurfaceSignal",
    tagline: "Surface change, explained for everyone",
  },
  language: {
    label: "Language",
  },
  a11y: {
    open: "Accessibility",
    title: "Accessibility settings",
    textSize: "Text size",
    textSizes: { md: "Normal", lg: "Large", xl: "Extra large" },
    contrast: "High contrast",
    contrastHint: "Black background and strong colors",
    motion: "Reduce motion",
    motionHint: "No animations or camera flights",
    on: "On",
    off: "Off",
    close: "Close settings",
  },
  notice: {
    title: "This site is not an official alert",
    body: "It shows what a satellite observed. In an emergency in Brazil, call 199 (Civil Defense) or 193 (Fire Department). To get alerts by text message, send your street's postal code (CEP) by SMS to 40199.",
  },
  hero: {
    eyebrow: "Taquari Valley · Rio Grande do Sul, Brazil",
    title: "What the satellite saw on the Taquari River",
    lead: "A radar in space can see water at night and through clouds. Here you can see, in plain colors, what changed in Lajeado and Estrela during the July 2026 flood.",
    start: "Start",
    startHint: "Takes about 2 minutes",
    facts: [
      { label: "Where", value: "Lajeado and Estrela, on the Taquari River" },
      { label: "When", value: "July 11 and 23, 2026" },
      { label: "Who observed", value: "NISAR satellite, by NASA and ISRO" },
    ],
  },
  how: {
    title: "How it works",
    next: "Next step",
    sceneNote: "Explanatory drawing. Not the real map.",
    before: "Before",
    after: "After",
    newWater: "New water",
    steps: [
      {
        title: "The satellite passes over",
        body: "NISAR, a satellite from NASA and India's space agency, passes over the same place every 12 days.",
      },
      {
        title: "We compare two dates",
        body: "We put side by side what the radar saw before and after the flood.",
      },
      {
        title: "We show what changed",
        body: "We paint only the places where the surface changed. No technical terms.",
      },
    ],
  },
  layers: {
    title: "What you can see",
    status: {
      available: "Available",
      exploratory: "Being tested",
      unavailable: "Not yet",
    },
    water: {
      name: "Water",
      body: "Where the river went beyond its normal banks.",
    },
    vegetation: {
      name: "Plants and crops",
      body: "Where plant cover changed. This result is still being tested.",
    },
    slopes: {
      name: "Slopes and hills",
      body: "Measuring ground movement needs a different kind of satellite data. That is why we do not show it yet.",
    },
  },
  story: {
    title: "The journey to the Taquari Valley",
    lead: "You move forward with large buttons, one step at a time. No need to rotate or drag the map.",
    steps: [
      "World",
      "Brazil",
      "Rio Grande do Sul",
      "Taquari Valley: Lajeado and Estrela",
    ],
  },
  region: {
    title: "What we have for this region",
    loading: "Loading data…",
    error: "We could not load the data right now.",
    retry: "Try again",
    availability: {
      analysis: "Comparison ready",
      catalog: "Images available",
      "no-pair": "No comparison yet",
    },
    analysisBody: "We have the comparison between {before} and {after}.",
    catalogBody:
      "The satellite has passed over this place {count} times. The passes of {before} and {after} can be compared, but that comparison has not been prepared yet.",
    noPairBody:
      "The satellite has not yet made two passes that can be compared over this place.",
    river:
      "The Geological Survey of Brazil reported the river status at {stations} about {hours} hours before the satellite passed.",
    source: "See the source",
    illustrativeBody:
      "The shapes on the map are still examples. They will be replaced by the real satellite measurement.",
    and: "and",
  },
  illustrative: "Illustrative data",
  footer: {
    data: "Data",
    dataBody:
      "NISAR radar (NASA and ISRO), distributed by the Alaska Satellite Facility. River status: Geological Survey of Brazil (SGB).",
    team: "Who made this",
    teamBody:
      "Team Sudo Nova, for the NASA Space Apps Challenge 2026. Not an official NASA or ISRO product.",
    ai: "Parts of the code and text were produced with the support of AI tools and reviewed by the team.",
  },
};

export default en;
