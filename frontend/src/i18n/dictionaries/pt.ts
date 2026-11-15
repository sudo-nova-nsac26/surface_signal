import { environmentPt } from "./environment";
/**
 * Portuguese copy. Written in plain language for readers with no technical
 * background: short sentences, no radar jargon, no acronyms without context.
 * The shape of this object is the contract every other language must follow.
 */
const pt = {
  environment: environmentPt,
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
    lead: "Pensado para idosos, daltônicos, pessoas com baixa visão, dislexia ou sensibilidade visual.",
    textSize: "Tamanho do texto",
    textSizeBadge: "👵 Idosos · Baixa visão",
    textSizes: { md: "Normal", lg: "Grande", xl: "Muito grande" },
    contrast: "Alto contraste",
    contrastBadge: "👁️ Deficiência visual · Catarata",
    contrastHint: "Fundo preto e cores fortes (contraste > 17:1)",
    colorblind: "Modo daltônico",
    colorblindBadge: "🎨 Daltonismo (Deuteranopia / Protanopia)",
    colorblindHint: "Troca o azul do mapa por grafite, ouro e magenta",
    readingSpacing: "Leitura espaçada",
    readingSpacingBadge: "📖 Dislexia · TDAH · Idosos",
    readingSpacingHint: "Mais espaço entre letras, palavras e linhas",
    speechSlow: "Voz pausada",
    speechSlowBadge: "🔊 Baixa visão · Leitura por áudio",
    speechSlowHint: "Narração mais calma nos botões 'Ouvir' do site",
    motion: "Reduzir movimento",
    motionBadge: "🌀 Labirintite · Sensibilidade vestibular",
    motionHint: "Sem animações nem voos de câmera no globo",
    deafNote: "🦻 Surdos / Deficiência auditiva: sirenes e rádio não alcançam a todos — aqui tudo é 100% visual e em texto simples.",
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
    title: "O que você pode ver e até onde podemos ampliar",
    lead: "Veja o que já está ativo hoje no mapa do Vale do Taquari (com dados reais de radar, relevo 3D, chuva e uso do solo) e como a plataforma evolui com novos dados e integrações.",
    status: {
      available: "Ativo no mapa",
      exploratory: "Ativo + Em expansão",
      unavailable: "Próxima fase",
    },
    water: {
      name: "Água e cheias",
      body: "Onde o Rio Taquari passou da margem normal e onde surgiram lâminas d'água sobre várzeas e áreas baixas.",
      today: "Hoje no mapa: manchas Antes x Depois (NISAR GCOV), cruzadas com histórico de 40 anos de água (JRC), chuva diária (CHIRPS), nível do rio (SGB) e limites municipais (IBGE).",
    },
    vegetation: {
      name: "Plantas e lavouras",
      body: "Onde a cobertura agrícola ou florestal mudou de comportamento no radar após a chuva extrema no vale.",
      today: "Hoje no mapa: cruzamento automático com uso do solo (ESA WorldCover 10 m — 34,2% das manchas em lavouras e 30,5% em mata ciliar) e aumento ou queda do eco do radar.",
    },
    slopes: {
      name: "Encostas, relevo e morros",
      body: "O que acontece nas áreas mais altas e inclinadas do vale quando chove forte sobre os morros.",
      today: "Hoje no mapa: Relevo 3D e inclinação em graus (Copernicus DEM 30 m, de 18 m a 58+ m) + mudança de rugosidade na encosta (ponto Q6). Próximo passo: fase InSAR (GUNW).",
    },
    expansion: {
      badge: "Visão de futuro e escala",
      title: "Até onde podemos ampliar o SurfaceSignal?",
      lead: "Nossa base já processa passagens reais do satélite NISAR e camadas ambientais oficiais. Veja o que já entregamos hoje e onde podemos chegar:",
      items: [
        {
          tag: "1 · Já ativo hoje",
          title: "Água, lavouras, relevo 3D e rugosidade em encostas",
          body: "Inspeção interativa nos quadradinhos Q1 a Q6 com imagem real de satélite, chuva de 3 dias (CHIRPS), boletim do rio (SGB), altitude/inclinação (Copernicus 30 m) e textura em encostas.",
        },
        {
          tag: "2 · Integração Hidrológica ao Vivo",
          title: "Nível do Rio Taquari em tempo real",
          body: "Conectar o mapa às réguas telemétricas em tempo real (SGB/ANA e projetos já desenvolvidos na região do Vale do Taquari), acompanhando a subida da água hora a hora junto às manchas do satélite.",
        },
        {
          tag: "3 · Próximo Salto de Radar (NISAR GUNW)",
          title: "Deslizamentos e movimento milimétrico de encostas",
          body: "Hoje o produto GCOV mostra onde a superfície da encosta mudou de textura. Com a fase interferométrica (NISAR L2 GUNW), mediremos deslocamentos milimétricos do solo para alertar riscos em morros.",
        },
        {
          tag: "4 · Apoio à Defesa Civil e Cidadãos",
          title: "Infraestrutura crítica e rotas seguras por altitude",
          body: "Cruzar automaticamente a cota de inundação e o relevo de 30 m com hospitais, escolas, pontes (como a BR-386) e rotas de saída seguras em terrenos mais altos.",
        },
        {
          tag: "5 · Fusão de Sensores",
          title: "Radar + Fotos Ópticas de Alta Resolução Antes/Depois",
          body: "Combinar o radar (que enxerga através das nuvens durante a tempestade) com imagens ópticas (Sentinel-2 / Planet) assim que o céu abre, confirmando visualmente cada quadradinho.",
        },
        {
          tag: "6 · Escala Nacional e Global (12 dias)",
          title: "De Lajeado e Estrela para qualquer bacia hidrográfica",
          body: "Como o NISAR revisita todo o planeta a cada 12 dias (faixa de 240 km, dia e noite), o mesmo pipeline pode monitorar outras bacias do RS, do Brasil e do mundo.",
        },
      ],
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
        open_water: { title: "Água", note: "Possível água nova" },
        radar_decrease: { title: "Sinal mais fraco", note: "Onde a superfície mudou. Possível: água, umidade ou plantas." },
        radar_increase: { title: "Sinal mais forte", note: "Onde a superfície mudou. Possível: água, umidade ou plantas." },
      },
      tapHint: "Toque nos cartões para ligar ou desligar cada camada.",
      learnMore: "Saber mais",
      learnMoreHint: "Explicação, outras camadas e detalhes",
      close: "Fechar",
      tabs: "Mais informações",
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
        "Por que mostramos: as manchas marcam onde a superfície do chão mudou entre as duas datas, por exemplo onde chegou água, a terra ficou mais úmida ou as plantas mudaram. Elas mostram onde olhar; sozinhas, não dizem se ficou melhor ou pior.",
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
    title: "Dos dados técnicos (HDF5) à linguagem simples",
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
    region: "Dados HDF5",
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
    lead: "Tudo o que aparece aqui vem de fontes públicas e oficiais, cruzadas na mesma grade de tempo e espaço.",
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
        a: "Nosso desafio é mostrar as mudanças que um satélite vê na superfície de uma região de um jeito simples, que qualquer pessoa entenda. Escolhemos o Vale do Taquari porque o rio já transbordou várias vezes nos últimos anos e muita gente, principalmente pessoas idosas e surdas, não recebe ou não entende os avisos e os mapas técnicos. Por isso: letras grandes, cores simples e nenhum termo técnico.",
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
