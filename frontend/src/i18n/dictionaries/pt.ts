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
    home: "voltar ao início",
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
    continue: "Continuar",
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
    auto3d: "Seu aparelho parece rápido: vamos abrir o mapa em 3D. Você pode trocar quando quiser.",
    auto2d: "Para ficar leve no seu aparelho, vamos abrir o mapa em 2D. Você pode trocar para 3D quando quiser.",
    upcomingLabel: "Ainda não disponível",
    explore: "Explorar o mapa",
    more: "Como funciona",
    mouseHint: "Role para aproximar. No 3D, segure a rodinha do mouse (ou o botão direito) e arraste para girar.",
    compare: {
      title: "Antes e depois",
      lead: "Deslize para ver o que apareceu no mapa entre as duas datas.",
      before: "Antes",
      after: "Depois",
      slider: "Mover entre antes e depois",
      showing: "Mostrando: {state}",
      stateBefore: "antes",
      stateAfter: "depois",
      stateBetween: "passando de antes para depois",
      legendWater: "Água que apareceu",
      layersTitle: "O que mostrar",
      switchOn: "ligado",
      switchOff: "desligado",
      noShapes:
        "Este exemplo ainda não tem as manchas medidas pelo satélite. Elas aparecem aqui quando os dados reais chegarem.",
      notPrepared:
        "Esta comparação ainda não foi preparada, por isso não há manchas para mostrar.",
      locked: "Ainda não disponível",
    },
    timeline: {
      title: "Linha do tempo",
      lead: "Passe de uma comparação para a outra. Cada uma mostra o que mudou entre duas passagens do satélite.",
      counter: "Comparação {current} de {total}",
      compared: "{after} comparada com {before}",
      slider: "Escolha a comparação",
      prev: "Anterior",
      next: "Próxima",
      play: "Reproduzir",
      pause: "Pausar",
      ready: "Comparação pronta",
      readyBody: "O mapa mostra o que mudou entre as duas datas.",
      notReady: "Ainda não preparada",
      notReadyBody:
        "O satélite passou nessas datas, mas esses dados são muito grandes e ainda estão sendo preparados.",
      illustrativeBody:
        "Este é um exemplo para montar a tela, não a medida real do satélite.",
      morning: "Passagem da manhã",
      evening: "Passagem do fim da tarde",
      river: "Boletim do rio nesse dia ({stations})",
      source: "Ver a fonte",
      legendPass: "Passagem do satélite",
      legendPair: "Comparação escolhida",
      empty: "Ainda não há passagens registradas para este lugar.",
    },
    places: {
      world: {
        name: "Mundo",
        description:
          "Este é o nosso planeta. O satélite NISAR dá a volta nele e observa quase toda a terra firme a cada 12 dias. Toque na bolinha do Brasil para começar.",
      },
      brazil: {
        name: "Brasil",
        description:
          "O Brasil. Vamos para o sul do país, onde o rio subiu em julho de 2026.",
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
