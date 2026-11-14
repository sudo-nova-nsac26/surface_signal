/**
 * Portuguese copy. Written in plain language for readers with no technical
 * background: short sentences, no radar jargon, no acronyms without context.
 * The shape of this object is the contract every other language must follow.
 */
const pt = {
  meta: {
    title: "SurfaceSignal — o que o satélite viu no Rio Taquari",
    description:
      "Veja em cores simples o que um radar da NASA observou em Lajeado e Estrela na cheia de julho de 2026. Feito para qualquer pessoa entender.",
  },
  skipToContent: "Pular para o conteúdo",
  brand: {
    name: "SurfaceSignal",
    tagline: "Mudanças na superfície, explicadas para todos",
  },
  language: {
    label: "Idioma",
  },
  a11y: {
    open: "Acessibilidade",
    title: "Ajustes de acessibilidade",
    textSize: "Tamanho do texto",
    textSizes: { md: "Normal", lg: "Grande", xl: "Muito grande" },
    contrast: "Alto contraste",
    contrastHint: "Fundo preto e cores fortes",
    motion: "Reduzir movimento",
    motionHint: "Sem animações nem voos de câmera",
    on: "Ligado",
    off: "Desligado",
    close: "Fechar ajustes",
  },
  notice: {
    title: "Este site não é um alerta oficial",
    body: "Ele mostra o que um satélite observou. Em emergência, ligue 199 (Defesa Civil) ou 193 (Bombeiros). Para receber alertas por mensagem de texto, envie o CEP da sua rua por SMS para 40199.",
  },
  hero: {
    eyebrow: "Vale do Taquari · Rio Grande do Sul",
    title: "O que o satélite viu no Rio Taquari",
    lead: "Um radar no espaço enxerga a água mesmo de noite e com nuvens. Aqui você vê, em cores simples, o que mudou em Lajeado e Estrela na cheia de julho de 2026.",
    start: "Começar",
    startHint: "Leva cerca de 2 minutos",
    facts: [
      { label: "Onde", value: "Lajeado e Estrela, no Rio Taquari" },
      { label: "Quando", value: "11 e 23 de julho de 2026" },
      { label: "Quem observou", value: "Satélite NISAR, da NASA e da ISRO" },
    ],
  },
  how: {
    title: "Como funciona",
    next: "Próximo passo",
    sceneNote: "Desenho explicativo. Não é o mapa real.",
    before: "Antes",
    after: "Depois",
    newWater: "Água nova",
    steps: [
      {
        title: "O satélite passa",
        body: "O satélite NISAR, da NASA e da agência espacial da Índia, passa pelo mesmo lugar a cada 12 dias.",
      },
      {
        title: "Comparamos duas datas",
        body: "Colocamos lado a lado o que o radar viu antes e depois da cheia.",
      },
      {
        title: "Mostramos o que mudou",
        body: "Pintamos no mapa só os lugares onde a superfície mudou. Sem termos técnicos.",
      },
    ],
  },
  layers: {
    title: "O que você pode ver",
    status: {
      available: "Disponível",
      exploratory: "Em teste",
      unavailable: "Ainda não",
    },
    water: {
      name: "Água",
      body: "Onde o rio passou da margem normal.",
    },
    vegetation: {
      name: "Plantas e lavouras",
      body: "Onde a cobertura de plantas mudou. Este resultado ainda está em teste.",
    },
    slopes: {
      name: "Encostas e morros",
      body: "Medir o movimento do solo exige outro tipo de dado do satélite. Por isso ainda não mostramos.",
    },
  },
  story: {
    title: "A viagem até o Vale do Taquari",
    lead: "Toque nas bolinhas do mapa ou nos botões grandes para chegar mais perto, um lugar de cada vez.",
  },
  map: {
    label: "Mapa da viagem até o Vale do Taquari",
    loading: "Preparando o mapa…",
    unsupported:
      "Este aparelho não conseguiu abrir o mapa. Você ainda pode ler a explicação de cada lugar.",
    view: "Como você quer ver o mapa",
    view2d: "2D",
    view2dHint: "Mapa plano, mais leve",
    view3d: "3D",
    view3dHint: "Globo e relevo",
    breadcrumb: "Onde você está",
    back: "Voltar",
    goTo: "Ir para {name}",
    dotHint: "Toque na bolinha para chegar mais perto",
    zoomIn: "Aproximar",
    zoomOut: "Afastar",
    rotateLabel: "Girar",
    rotateLeft: "Girar para a esquerda",
    rotateRight: "Girar para a direita",
    tiltLabel: "Inclinar",
    tiltMore: "Inclinar mais",
    tiltLess: "Inclinar menos",
    resetView: "Voltar à vista inicial",
    hint3d: "No 3D você pode girar e inclinar o mapa: arraste com a rodinha do mouse pressionada, com dois dedos, ou use os botões ao lado.",
    area: "Área analisada",
    gestureDesktop: "Segure Ctrl e role para aproximar o mapa",
    gestureMac: "Segure ⌘ e role para aproximar o mapa",
    gestureMobile: "Use dois dedos para mover o mapa",
    upcomingLabel: "Ainda não disponível",
    explore: "Explorar o mapa",
    more: "Como funciona",
    mouseHint: "Role para aproximar. No 3D, segure a rodinha do mouse (ou o botão direito) e arraste para girar.",
    timeline: {
      title: "Linha do tempo",
      lead: "Cada ponto é uma passagem do satélite sobre o vale. As faixas mostram as comparações prontas.",
      pass: "Passagem do satélite em {date}",
      pair: "Comparação de {before} a {after}",
      event: "Boletim do rio em {date}: {stations}",
      eventShort: "Boletim do rio",
      legendPass: "Passagem do satélite",
      legendPair: "Comparação pronta",
      legendEvent: "Boletim do rio (SGB)",
      showing: "Mostrando a comparação de {before} a {after}.",
      none: "Ainda não há comparação pronta. As passagens já estão no catálogo da NASA.",
      empty: "Ainda não há passagens registradas para este lugar.",
    },
    upcoming: {
      "north-america": "América do Norte",
      europe: "Europa",
      africa: "África",
      asia: "Ásia",
      oceania: "Oceania",
      "brazil-north": "Região Norte",
      "brazil-northeast": "Região Nordeste",
      "brazil-central-west": "Região Centro-Oeste",
      "brazil-southeast": "Região Sudeste",
      parana: "Paraná",
      "santa-catarina": "Santa Catarina",
      "rs-serra": "Serra Gaúcha",
      "rs-metropolitana": "Região Metropolitana",
      "rs-litoral": "Litoral Norte",
      "rs-sul": "Região Sul",
      "rs-campanha": "Campanha",
      "rs-fronteira-oeste": "Fronteira Oeste",
      "rs-missoes": "Missões",
      "rs-planalto": "Planalto Médio",
      "rs-central": "Região Central",
      "rs-rio-pardo": "Vale do Rio Pardo",
    },
    places: {
      world: {
        name: "Mundo",
        description:
          "Este é o nosso planeta. O satélite NISAR dá a volta nele e observa quase toda a terra firme a cada 12 dias. Toque na bolinha para começar.",
      },
      "south-america": {
        name: "América do Sul",
        description:
          "A América do Sul. Vamos para o sul do Brasil, onde o rio subiu em julho de 2026.",
      },
      "brazil-south": {
        name: "Região Sul do Brasil",
        description:
          "A Região Sul reúne Paraná, Santa Catarina e Rio Grande do Sul.",
      },
      "rio-grande-do-sul": {
        name: "Rio Grande do Sul",
        description:
          "O Rio Grande do Sul. O Rio Taquari corre no centro do estado, entre a serra e a capital.",
      },
      "taquari-valley": {
        name: "Vale do Taquari: Lajeado e Estrela",
        description:
          "Lajeado e Estrela ficam uma de cada lado do Rio Taquari. A linha tracejada mostra a área que comparamos.",
      },
    },
  },
  region: {
    title: "O que temos para esta região",
    loading: "Carregando os dados…",
    error: "Não conseguimos carregar os dados agora.",
    retry: "Tentar de novo",
    availability: {
      analysis: "Comparação pronta",
      catalog: "Imagens disponíveis",
      "no-pair": "Ainda sem comparação",
    },
    analysisBody: "Temos a comparação entre {before} e {after}.",
    catalogBody:
      "O satélite já passou {count} vezes por aqui. As passagens de {before} e {after} podem ser comparadas, mas essa comparação ainda não foi preparada.",
    noPairBody:
      "O satélite ainda não fez duas passagens que possam ser comparadas neste lugar.",
    river:
      "O Serviço Geológico do Brasil informou a situação do rio em {stations} cerca de {hours} horas antes de o satélite passar.",
    source: "Ver a fonte",
    illustrativeBody:
      "Os desenhos no mapa ainda são exemplos. Eles serão trocados pela medida real do satélite.",
    and: "e",
  },
  illustrative: "Dado ilustrativo",
  footer: {
    data: "Dados",
    dataBody:
      "Radar NISAR (NASA e ISRO), distribuído pelo Alaska Satellite Facility. Situação do rio: Serviço Geológico do Brasil (SGB).",
    team: "Quem fez",
    teamBody:
      "Time Sudo Nova, para o NASA Space Apps Challenge 2026. Não é um produto oficial da NASA nem da ISRO.",
    ai: "Parte do código e dos textos foi feita com apoio de ferramentas de inteligência artificial e revisada pelo time.",
  },
};

export type Dictionary = typeof pt;

export default pt;
