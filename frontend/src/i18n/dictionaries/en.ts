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
    lead: "Tap the dots on the map or the large buttons to get closer, one place at a time.",
  },
  map: {
    label: "Map of the journey to the Taquari Valley",
    loading: "Preparing the map…",
    unsupported:
      "This device could not open the map. You can still read the explanation of each place.",
    view: "How you want to see the map",
    view2d: "2D",
    view2dHint: "Flat map, lighter",
    view3d: "3D",
    view3dHint: "Globe and relief",
    breadcrumb: "Where you are",
    back: "Back",
    goTo: "Go to {name}",
    dotHint: "Tap the dot to get closer",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    rotateLabel: "Rotate",
    rotateLeft: "Rotate left",
    rotateRight: "Rotate right",
    tiltLabel: "Tilt",
    tiltMore: "Tilt more",
    tiltLess: "Tilt less",
    resetView: "Back to the starting view",
    hint3d: "In 3D you can rotate and tilt the map: drag with the mouse wheel pressed, with two fingers, or use the buttons on the side.",
    area: "Analysed area",
    gestureDesktop: "Hold Ctrl and scroll to zoom the map",
    gestureMac: "Hold ⌘ and scroll to zoom the map",
    gestureMobile: "Use two fingers to move the map",
    upcomingLabel: "Not available yet",
    explore: "Explore the map",
    more: "How it works",
    mouseHint: "Scroll to zoom. In 3D, hold the mouse wheel (or the right button) and drag to rotate.",
    upcoming: {
      "north-america": "North America",
      europe: "Europe",
      africa: "Africa",
      asia: "Asia",
      oceania: "Oceania",
      "brazil-north": "North region",
      "brazil-northeast": "Northeast region",
      "brazil-central-west": "Central-West region",
      "brazil-southeast": "Southeast region",
      parana: "Paraná",
      "santa-catarina": "Santa Catarina",
    },
    places: {
      world: {
        name: "World",
        description:
          "This is our planet. The NISAR satellite circles it and observes almost all land every 12 days. Tap the dot to begin.",
      },
      "south-america": {
        name: "South America",
        description:
          "South America. We are heading to the south of Brazil, where the river rose in July 2026.",
      },
      "brazil-south": {
        name: "South region of Brazil",
        description:
          "The South region brings together Paraná, Santa Catarina and Rio Grande do Sul.",
      },
      "rio-grande-do-sul": {
        name: "Rio Grande do Sul",
        description:
          "Rio Grande do Sul. The Taquari River runs through the middle of the state, between the highlands and the capital.",
      },
      "taquari-valley": {
        name: "Taquari Valley: Lajeado and Estrela",
        description:
          "Lajeado and Estrela sit on opposite banks of the Taquari River. The dashed line shows the area we compared.",
      },
    },
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
