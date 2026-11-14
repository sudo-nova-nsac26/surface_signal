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
    lead: "Você avança com botões grandes, um passo de cada vez. Não precisa girar nem arrastar o mapa.",
    steps: [
      "Mundo",
      "Brasil",
      "Rio Grande do Sul",
      "Vale do Taquari: Lajeado e Estrela",
    ],
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
