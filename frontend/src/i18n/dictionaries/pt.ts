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
  about: {
    label: "Sobre nós",
    newTab: "abre o site do time Sudo Nova em outra aba",
    cta: "Conheça o time Sudo Nova",
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
  hero: {
    eyebrow: "Vale do Taquari, RS · Cheia de julho de 2026",
    title: "A cheia do Taquari, vista do espaço",
    titleLines: ["A cheia do Taquari,", "vista do espaço."],
    lead: "Um radar no espaço enxerga através das nuvens e no escuro. Transformamos o que ele vê em imagens simples: comparamos Lajeado e região antes e depois da cheia para mostrar até onde a água chegou e seus diversos impactos e mudanças no planeta.",
    start: "Começar",
    startHint: "Leva cerca de 2 minutos",
    facts: [
      { label: "Onde", value: "Lajeado e região" },
      { label: "O que comparamos", value: "antes × depois da cheia" },
      { label: "Volta ao mesmo lugar", value: "a cada 12 dias" },
    ],
  },
  how: {
    title: "Como funciona",
    lead: "Do espaço até o seu bairro, em quatro passos. Arraste a linha do desenho para comparar antes e depois.",
    next: "Próximo passo",
    continue: "Continuar",
    sceneNote: "Rio, ruas e pontes reais (OpenStreetMap). A água nova é só uma ilustração.",
    before: "Antes · 11 jul",
    after: "Depois · 23 jul",
    newWater: "Água nova",
    impactsTitle: "Possíveis impactos",
    impacts: {
      streets: "Ruas alagadas",
      houses: "Casas atingidas",
      bridge: "Ponte danificada",
      landslide: "Terra deslizou",
      crops: "Lavoura coberta",
    },
    divider: "Linha entre antes e depois",
    dividerValue: "{before}% antes, {after}% depois",
    dragHint: "Arraste",
    stepOf: "Passo {current} de {total}",
    steps: [
      {
        title: "O satélite passa",
        body: "O NISAR, da NASA e da agência espacial da Índia, voa a 747 km de altura e passa pelo mesmo lugar a cada 12 dias.",
        detail: "Ele repete o mesmo caminho e o mesmo ângulo. Assim, duas fotos de radar podem ser comparadas como se fossem tiradas do mesmo ponto.",
      },
      {
        title: "O radar enxerga no escuro",
        body: "Ele não depende do sol: manda um sinal para o chão e escuta o eco que volta.",
        detail: "O sinal atravessa nuvens e chuva. Água parada funciona como um espelho e manda o eco para longe, por isso aparece escura na imagem.",
      },
      {
        title: "Comparamos duas datas",
        body: "Colocamos lado a lado o que o radar viu antes da cheia (11 de julho) e durante (23 de julho).",
        detail: "Só comparamos passagens do mesmo tipo: mesmo caminho, mesmo lado e mesmo horário. Arraste a linha para ver a diferença.",
      },
      {
        title: "Mostramos o que mudou",
        body: "Pintamos no mapa os lugares onde a superfície mudou: água nas ruas, casas atingidas, ponte danificada, terra que deslizou e lavouras cobertas.",
        detail: "No globo, cada tipo de mudança vira uma camada que você liga e desliga. Uma mancha é uma pista do que o satélite viu, não uma confirmação: em emergências, siga a Defesa Civil.",
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
      whatToSee: "O que você quer ver?",
      summaryChanged:
        "O radar notou mudanças em {area} km², {percent}% da área analisada. É mais ou menos o tamanho de {fields} campos de futebol.",
      summaryWater: "Possível água nova em {area} km² (cerca de {fields} campos de futebol).",
      summaryWaterTiny: "Possível água nova numa área pequena: menos de um campo de futebol ({area} km²).",
      summaryNoWater: "Nenhum lugar com cara de água nova nesta comparação.",
      summaryMissing: "Esta comparação não tem números disponíveis.",
      cards: {
        open_water: { title: "Possível água nova", body: "Parece água onde antes não havia" },
        radar_decrease: { title: "Refletiu menos o radar", body: "Pode ser água, umidade ou plantas" },
        radar_increase: { title: "Refletiu mais o radar", body: "Pode ser plantas, umidade ou mudança no chão" },
      },
      understand: "Entender esta comparação",
      technical: "Detalhes técnicos",
      technicalNote:
        "Números como o backend mediu. Um grupo de pixels é um conjunto de pontos vizinhos de 10 m, não um acontecimento.",
      threshold: "Limiar de mudança",
      minGroup: "Menor grupo considerado",
      pixelsUnit: "pixels",
      scenes: "Imagens comparadas",
      title: "O que mudou",
      showChanges: "Mostrar as mudanças",
      showChangesHint:
        "Liga ou desliga as manchas sobre o mapa. O mapa de fundo é atual: ele não mostra como a superfície estava na data anterior.",
      intensity: "Força das manchas",
      layersTitle: "Camadas",
      on: "ligado",
      off: "desligado",
      symbols: { radar_increase: "▲", radar_decrease: "▼", open_water: "●" },
      hints: {
        radar_increase: "O retorno do radar ficou mais forte",
        radar_decrease: "O retorno do radar ficou mais fraco",
        open_water: "Pode ser água aberta nova (hipótese)",
      },
      signalNote:
        "Aumento e diminuição descrevem o sinal do radar. Sozinhos, não querem dizer melhora, piora ou dano.",
      otherLayers: "Outras camadas",
      status: {
        available: "Disponível",
        exploratory: "Em estudo",
        unavailable: "Ainda não",
      },
      numbersTitle: "Números desta comparação",
      validArea: "Área analisada de fato",
      increase: "Aumento do sinal",
      decrease: "Diminuição do sinal",
      changed: "Mudança pelos critérios",
      water: "Possível água aberta",
      groups: "{count} grupos de pixels",
      unit: "km²",
      unavailable: "indisponível",
      areaNote:
        "A linha tracejada é a área escolhida para estudo. A área analisada de fato é menor: só conta onde o radar teve leitura válida nas duas datas.",
      notValidated: "Resultado real · ainda não conferido em campo",
      synthetic: "Exemplo · não é medida real",
      storyMore: "Ler a explicação completa",
      observation: "O que foi feito",
      result: "Resultado",
      interpretation: "O que pode significar",
      alternatives: "Outras explicações possíveis",
      limitations: "Limites",
      sources: "Fontes",
      noWater:
        "Nenhum candidato de água nesta comparação. Isso não quer dizer que não houve cheia ou mudança.",
      loading: "Carregando os resultados…",
      error: "Não conseguimos carregar os resultados agora.",
      retry: "Tentar de novo",
    },
    timeline: {
      title: "Linha do tempo",
      counter: "Comparação {current} de {total}",
      compared: "{before} → {after}",
      slider: "Escolha a comparação",
      prev: "Anterior",
      next: "Próxima",
      play: "Reproduzir",
      pause: "Pausar",
      morning: "Passagem da manhã",
      evening: "Passagem do fim da tarde",
      river: "Boletim do rio nesse dia ({stations})",
      source: "Ver a fonte",
      sameGroup:
        "Todas do mesmo tipo de passagem (mesmo caminho e mesmo ângulo), para comparar de forma justa.",
      empty: "Os resultados do satélite não estão disponíveis agora.",
      error: "Não conseguimos carregar a linha do tempo.",
      retry: "Tentar de novo",
    },
    featured: {
      before: {
        title: "Antes da cheia",
        body: "Duas passagens antes da cheia. Serve de referência: o radar viu poucas mudanças.",
      },
      flood: {
        title: "Durante a cheia",
        body: "A passagem de 23 de julho, poucas horas depois do boletim que indicava o rio acima da cota de inundação.",
      },
      after: {
        title: "Depois da cheia",
        body: "Compara a passagem de 23 de julho com a de 16 de agosto, a seguinte do mesmo tipo.",
      },
      increase: {
        title: "Maior aumento do sinal",
        body: "A comparação com a maior área de aumento do sinal no período. Maior área não quer dizer mais grave.",
      },
      decrease: {
        title: "Maior diminuição do sinal",
        body: "A comparação com a maior área de diminuição do sinal no período. Maior área não quer dizer mais grave.",
      },
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
  nav: {
    label: "Seções da página",
    map: "Mapa",
    how: "Como funciona",
    layers: "Camadas",
    region: "Região",
    data: "Dados",
    faq: "Dúvidas",
    help: "Em caso de cheia",
    about: "Sobre nós",
  },
  listen: {
    start: "Ouvir",
    stop: "Parar",
    startLabel: "Ouvir esta seção em voz alta",
    unsupported: "Este navegador não consegue ler em voz alta.",
  },
  sources: {
    title: "De onde vêm os dados",
    lead: "Tudo o que aparece aqui vem de fontes públicas. Nada é inventado: o que ainda é exemplo fica marcado.",
    items: [
      {
        name: "Satélite NISAR",
        who: "NASA e ISRO (agência espacial da Índia)",
        body: "Radar lançado em 2025. Os arquivos são públicos e distribuídos pelo Alaska Satellite Facility (ASF), da NASA.",
      },
      {
        name: "Situação do rio",
        who: "Serviço Geológico do Brasil (SGB)",
        body: "Boletins oficiais do nível do Rio Taquari, usados para saber como estava o rio perto da hora da passagem.",
      },
      {
        name: "Limites dos lugares",
        who: "IBGE",
        body: "Contornos do Brasil e do Rio Grande do Sul, com licença aberta.",
      },
      {
        name: "Mapa e relevo",
        who: "OpenStreetMap, OpenFreeMap e Terrain Tiles",
        body: "Ruas, nomes e o relevo do 3D. Gratuitos e feitos por comunidades e projetos abertos.",
      },
    ],
    honestTitle: "O que é real e o que ainda é exemplo",
    real: "Real",
    realBody: "A área analisada, as passagens do satélite por aqui e os boletins do rio.",
    sample: "Exemplo, por enquanto",
    sampleBody: "As manchas de mudança no mapa. Enquanto a medida real não fica pronta, elas são marcadas como “Dado ilustrativo”.",
  },
  faq: {
    title: "Dúvidas comuns",
    items: [
      {
        q: "Por que fizemos este site?",
        a: "O Rio Taquari já transbordou várias vezes nos últimos anos. Muita gente, principalmente pessoas idosas e surdas, não recebe ou não entende os avisos e os mapas técnicos. Queríamos mostrar o que um satélite da NASA viu de um jeito que qualquer pessoa entenda: letras grandes, cores simples e nenhum termo técnico.",
      },
      {
        q: "Como um satélite vê através das nuvens?",
        a: "Ele usa radar, não uma câmera comum. O radar manda o próprio sinal e escuta o eco. Nuvem e chuva não bloqueiam esse sinal, e ele funciona também de noite.",
      },
      {
        q: "Vocês pretendem ampliar para outras regiões e países?",
        a: "Sim. É por isso que o mapa começa num globo: o mundo inteiro já está lá, com outros países, estados e regiões marcados como “em breve”. O satélite NISAR observa quase toda a terra firme do planeta a cada 12 dias, então o mesmo método pode ser levado para outros lugares.",
      },
      {
        q: "Quem fez este site?",
        a: "O time Sudo Nova, para o desafio NASA Space Apps 2026. Não é um produto oficial da NASA nem da ISRO.",
      },
    ],
  },
  help: {
    title: "Em caso de cheia",
    lead: "Este site não é um alerta oficial. Em perigo, procure ajuda agora:",
    contacts: [
      { number: "199", name: "Defesa Civil", body: "Ligue em situações de risco, para abrigo e orientação." },
      { number: "193", name: "Bombeiros", body: "Ligue para resgate e emergências com pessoas." },
      { number: "40199", name: "Alertas por SMS", body: "Envie o CEP da sua rua por SMS para receber alertas da Defesa Civil no celular. É gratuito." },
    ],
    shareTitle: "Compartilhe com quem mora no Vale",
    shareBody: "Mande para a família e os vizinhos. Quanto mais gente entende o que o satélite viu, melhor.",
    whatsapp: "Enviar no WhatsApp",
    copy: "Copiar link",
    copied: "Link copiado",
    shareText: "Veja o que o satélite NISAR viu na cheia do Rio Taquari, em Lajeado e Estrela, explicado em palavras simples:",
    newTab: "abre em outra aba",
  },
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
