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
    home: "back to the start",
    tagline: "Surface change, explained for everyone",
  },
  about: {
    label: "About us",
    newTab: "opens the Sudo Nova team site in a new tab",
    cta: "Meet team Sudo Nova",
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
  hero: {
    eyebrow: "Taquari Valley, Brazil · July 2026 flood",
    title: "The Taquari flood, seen from space",
    titleLines: ["The Taquari flood,", "seen from space."],
    lead: "A radar in space sees through clouds and in the dark. We turn what it sees into simple pictures: we compare Lajeado and its region before and after the flood to show how far the water reached and its many impacts and changes on the planet.",
    start: "Start",
    startHint: "Takes about 2 minutes",
    facts: [
      { label: "Where", value: "Lajeado and region" },
      { label: "What we compare", value: "before × after the flood" },
      { label: "Back over the same place", value: "every 12 days" },
    ],
  },
  how: {
    title: "How it works",
    lead: "From space to your street, in four steps. Drag the line on the drawing to compare before and after.",
    next: "Next step",
    continue: "Continue",
    sceneNote: "Real river, streets and bridges (OpenStreetMap). The new water is only an illustration.",
    before: "Before · Jul 11",
    after: "After · Jul 23",
    newWater: "New water",
    impactsTitle: "Possible impacts",
    impacts: {
      streets: "Flooded streets",
      houses: "Houses hit",
      bridge: "Damaged bridge",
      landslide: "Ground slid",
      crops: "Crops covered",
    },
    divider: "Line between before and after",
    dividerValue: "{before}% before, {after}% after",
    dragHint: "Drag",
    stepOf: "Step {current} of {total}",
    steps: [
      {
        title: "The satellite passes over",
        body: "NISAR, from NASA and India's space agency, flies 747 km up and passes over the same place every 12 days.",
        detail: "It repeats the same path and the same angle, so two radar pictures can be compared as if taken from the same spot.",
      },
      {
        title: "The radar sees in the dark",
        body: "It does not need the sun: it sends a signal to the ground and listens to the echo that comes back.",
        detail: "The signal goes through clouds and rain. Still water acts like a mirror and bounces the echo away, which is why it looks dark in the picture.",
      },
      {
        title: "We compare two dates",
        body: "We put side by side what the radar saw before the flood (July 11) and during it (July 23).",
        detail: "We only compare passes of the same kind: same path, same side and same time of day. Drag the line to see the difference.",
      },
      {
        title: "We show what changed",
        body: "We paint on the map the places where the surface changed: water in the streets, houses hit, a damaged bridge, ground that slid and crops covered.",
        detail: "On the globe, each kind of change becomes a layer you switch on and off. A patch is a clue to what the satellite saw, not a confirmation: in an emergency, follow Civil Defense.",
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
    auto3d: "Your device looks fast: the map will open in 3D. You can switch whenever you like.",
    auto2d: "To keep things light on your device, the map will open in 2D. You can switch to 3D whenever you like.",
    upcomingLabel: "Not available yet",
    explore: "Explore the map",
    more: "How it works",
    mouseHint: "Scroll to zoom. In 3D, hold the mouse wheel (or the right button) and drag to rotate.",
    compare: {
      title: "What changed",
      showChanges: "Show the changes",
      showChangesHint:
        "Turns the patches on the map on or off. The background map is current: it does not show the surface on the earlier date.",
      intensity: "Patch strength",
      layersTitle: "Layers",
      on: "on",
      off: "off",
      symbols: { radar_increase: "▲", radar_decrease: "▼", open_water: "●" },
      hints: {
        radar_increase: "The radar return got stronger",
        radar_decrease: "The radar return got weaker",
        open_water: "May be new open water (a hypothesis)",
      },
      signalNote:
        "Increase and decrease describe the radar signal. On their own they do not mean better, worse or damage.",
      otherLayers: "Other layers",
      status: {
        available: "Available",
        exploratory: "Being studied",
        unavailable: "Not yet",
      },
      numbersTitle: "Numbers for this comparison",
      validArea: "Area actually analysed",
      increase: "Signal increase",
      decrease: "Signal decrease",
      changed: "Change under the criteria",
      water: "Possible open water",
      groups: "{count} pixel groups",
      unit: "km²",
      unavailable: "unavailable",
      areaNote:
        "The dashed line is the area chosen for study. The area actually analysed is smaller: it only counts where the radar had a valid reading on both dates.",
      notValidated: "Real result · not yet checked on the ground",
      synthetic: "Example · not a real measurement",
      storyMore: "Read the full explanation",
      observation: "What was done",
      result: "Result",
      interpretation: "What it may mean",
      alternatives: "Other possible explanations",
      limitations: "Limits",
      sources: "Sources",
      noWater:
        "No water candidates in this comparison. That does not mean there was no flood or change.",
      loading: "Loading the results…",
      error: "We could not load the results right now.",
      retry: "Try again",
    },
    timeline: {
      title: "Timeline",
      counter: "Comparison {current} of {total}",
      compared: "{before} → {after}",
      slider: "Choose the comparison",
      prev: "Previous",
      next: "Next",
      play: "Play",
      pause: "Pause",
      morning: "Morning pass",
      evening: "Late afternoon pass",
      river: "River bulletin that day ({stations})",
      source: "See the source",
      sameGroup:
        "All from the same kind of pass (same path and same angle), so the comparison is fair.",
      empty: "The satellite results are not available right now.",
      error: "We could not load the timeline.",
      retry: "Try again",
    },
    featured: {
      before: {
        title: "Before the flood",
        body: "Two passes before the flood. A reference: the radar saw few changes.",
      },
      flood: {
        title: "During the flood",
        body: "The July 23 pass, a few hours after the bulletin that put the river above flood level.",
      },
      after: {
        title: "After the flood",
        body: "Compares the July 23 pass with the August 16 pass, the next one of the same kind.",
      },
      increase: {
        title: "Largest signal increase",
        body: "The comparison with the largest area of signal increase in the period. Larger area does not mean more serious.",
      },
      decrease: {
        title: "Largest signal decrease",
        body: "The comparison with the largest area of signal decrease in the period. Larger area does not mean more serious.",
      },
    },
    places: {
      world: {
        name: "World",
        description:
          "This is our planet. The NISAR satellite circles it and observes almost all land every 12 days. Tap the Brazil dot to begin.",
      },
      brazil: {
        name: "Brazil",
        description:
          "Brazil. We are heading to the south of the country, where the river rose in July 2026.",
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
  nav: {
    label: "Page sections",
    map: "Map",
    how: "How it works",
    layers: "Layers",
    region: "Region",
    data: "Data",
    faq: "Questions",
    help: "If there is a flood",
    about: "About us",
  },
  listen: {
    start: "Listen",
    stop: "Stop",
    startLabel: "Read this section aloud",
    unsupported: "This browser cannot read aloud.",
  },
  sources: {
    title: "Where the data comes from",
    lead: "Everything here comes from public sources. Nothing is made up: what is still an example is labelled.",
    items: [
      {
        name: "NISAR satellite",
        who: "NASA and ISRO (India's space agency)",
        body: "A radar launched in 2025. Its files are public and distributed by NASA's Alaska Satellite Facility (ASF).",
      },
      {
        name: "River status",
        who: "Geological Survey of Brazil (SGB)",
        body: "Official bulletins of the Taquari River level, used to know how the river was close to the time of the pass.",
      },
      {
        name: "Place outlines",
        who: "IBGE (Brazil's statistics institute)",
        body: "Outlines of Brazil and Rio Grande do Sul, under an open licence.",
      },
      {
        name: "Map and relief",
        who: "OpenStreetMap, OpenFreeMap and Terrain Tiles",
        body: "Streets, names and the 3D relief. Free, made by communities and open projects.",
      },
    ],
    honestTitle: "What is real and what is still an example",
    real: "Real",
    realBody: "The analysed area, the satellite's passes over it and the river bulletins.",
    sample: "Example, for now",
    sampleBody: "The change patches on the map. Until the real measurement is ready, they are labelled “Illustrative data”.",
  },
  faq: {
    title: "Common questions",
    items: [
      {
        q: "Why did we make this site?",
        a: "The Taquari River has overflowed several times in recent years. Many people, especially older adults and deaf people, do not get or do not understand warnings and technical maps. We wanted to show what a NASA satellite saw in a way anyone can understand: large letters, plain colors and no technical terms.",
      },
      {
        q: "How can a satellite see through clouds?",
        a: "It uses radar, not an ordinary camera. The radar sends its own signal and listens to the echo. Clouds and rain do not block that signal, and it works at night too.",
      },
      {
        q: "Do you plan to cover other regions and countries?",
        a: "Yes. That is why the map starts on a globe: the whole world is already there, with other countries, states and regions marked as “coming soon”. The NISAR satellite observes almost all of the planet's land every 12 days, so the same method can be taken to other places.",
      },
      {
        q: "Who made this site?",
        a: "Team Sudo Nova, for the NASA Space Apps Challenge 2026. It is not an official NASA or ISRO product.",
      },
    ],
  },
  help: {
    title: "If there is a flood",
    lead: "This site is not an official alert. If you are in danger in Brazil, get help now:",
    contacts: [
      { number: "199", name: "Civil Defense", body: "Call for danger, shelter and guidance." },
      { number: "193", name: "Fire Department", body: "Call for rescue and emergencies with people." },
      { number: "40199", name: "Alerts by text message", body: "Text your street's postal code (CEP) to get Civil Defense alerts on your phone. It is free." },
    ],
    shareTitle: "Share with people who live in the Valley",
    shareBody: "Send it to family and neighbours. The more people understand what the satellite saw, the better.",
    whatsapp: "Send on WhatsApp",
    copy: "Copy link",
    copied: "Link copied",
    shareText: "See what the NISAR satellite saw during the Taquari River flood in Lajeado and Estrela, explained in plain words:",
    newTab: "opens in a new tab",
  },
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
