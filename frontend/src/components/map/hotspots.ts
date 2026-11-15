import type { Feature, FeatureCollection, Polygon } from "geojson";
import type { LngLat } from "@/data/region";
import type { Locale } from "@/i18n/config";

export interface MapHotspot {
  id: string;
  code: string;
  kind: "floodplain" | "river_corridor" | "hillslope";
  center: LngLat;
  /** [west, south, east, north] */
  bounds: [number, number, number, number];
  municipality: string;
  elevationApproxM: number;
  slopeApproxDeg: number;
  dominantLandUse: { pt: string; en: string };
  title: { pt: string; en: string };
  subtitle: { pt: string; en: string };
  beforeAfter: { pt: string; en: string };
  whatHappened: { pt: string; en: string };
  consequences: { pt: string; en: string };
  technicalNote: { pt: string; en: string };
}

export const VALLEY_HOTSPOTS: MapHotspot[] = [
  {
    id: "estrela-varzea",
    code: "Q1",
    kind: "floodplain",
    center: [-51.9248, -29.4526],
    bounds: [-51.9305, -29.4565, -51.9195, -29.4485],
    municipality: "Estrela",
    elevationApproxM: 16,
    slopeApproxDeg: 1.8,
    dominantLandUse: {
      pt: "Várzea agrícola e mata ciliar próxima ao Rio Taquari",
      en: "Agricultural floodplain and riverside trees near the Taquari River",
    },
    title: {
      pt: "Q1 · Várzea baixa e lavouras de Estrela",
      en: "Q1 · Low floodplain and farmlands in Estrela",
    },
    subtitle: {
      pt: "Estrela (margem leste) · Terreno plano e baixo (~16 m, inclinação ~1,8°)",
      en: "Estrela (east bank) · Flat, low terrain (~16 m, slope ~1.8°)",
    },
    beforeAfter: {
      pt: "Antes da chuva, o radar via solo firme e vegetação de lavoura. Depois dos 87,6 mm de chuva acumulada, surgiram várias manchas azuis seguidas onde o terreno plano passou a refletir como lâmina d’água ou solo encharcado.",
      en: "Before the rain, radar saw firm ground and crop cover. After 87.6 mm of cumulative rainfall, clusters of blue patches appeared where flat land began reflecting like standing water or saturated soil.",
    },
    whatHappened: {
      pt: "Com a subida do Rio Taquari (acima da cota de inundação segundo o boletim do SGB) e o relevo de apenas ~16 m de altitude, a água se espalhou pelas áreas abertas de cultivo e margens naturais.",
      en: "With the Taquari River rising above flood threshold (per the SGB bulletin) and terrain at only ~16 m elevation, water spread across open farmlands and natural riverbanks.",
    },
    consequences: {
      pt: "Para moradores e produtores: indica alagamento temporário de áreas rurais e retenção de água nas várzeas. Ajuda a planejar drenagem e evitar acesso de maquinário enquanto o solo está saturado.",
      en: "For residents and farmers: indicates temporary flooding of rural plots and water retention in floodplains. Helps plan drainage and avoid machinery access while soil is saturated.",
    },
    technicalNote: {
      pt: "Dados técnicos: NISAR L2 GCOV (queda de retroespalhamento compatível com reflexão especular) + Copernicus DEM GLO-30 (~16 m EGM2008) + ESA WorldCover 2021 (predomínio classe 40 cropland).",
      en: "Technical data: NISAR L2 GCOV (backscatter drop consistent with specular reflection) + Copernicus DEM GLO-30 (~16 m EGM2008) + ESA WorldCover 2021 (predominantly class 40 cropland).",
    },
  },
  {
    id: "lajeado-estrela-pontes",
    code: "Q2",
    kind: "river_corridor",
    center: [-51.9465, -29.4738],
    bounds: [-51.9555, -29.4785, -51.9395, -29.4695],
    municipality: "Lajeado / Estrela",
    elevationApproxM: 19,
    slopeApproxDeg: 3.4,
    dominantLandUse: {
      pt: "Margens do Rio Taquari, mata ciliar e corredor urbano/rodoviário",
      en: "Taquari River banks, riparian trees, and urban/highway corridor",
    },
    title: {
      pt: "Q2 · Calha central entre Lajeado e Estrela",
      en: "Q2 · Central channel between Lajeado and Estrela",
    },
    subtitle: {
      pt: "Divisa Lajeado–Estrela · Corredor do Rio Taquari (~19 m, inclinação ~3,4°)",
      en: "Lajeado–Estrela border · Taquari River corridor (~19 m, slope ~3.4°)",
    },
    beforeAfter: {
      pt: "Na primeira data o rio corria dentro da calha habitual. Na segunda data, o satélite registrou alargamento da faixa de água e manchas de mudança tanto de queda (azul) quanto de aumento de reflexo (laranja) nas margens baixas.",
      en: "On the first date the river stayed within its usual channel. On the second date, the satellite recorded a wider water corridor and both signal-drop (blue) and signal-increase (orange) patches along low banks.",
    },
    whatHappened: {
      pt: "Este trecho concentra o fluxo principal do Rio Taquari exatamente onde ficam as réguas hidrológicas de Lajeado e Estrela monitoradas pelo Serviço Geológico do Brasil (SGB). O sinal laranja ocorre onde a água entra sob árvores e estruturas (efeito de duplo rebote do radar).",
      en: "This stretch funnels the main flow of the Taquari River right where the Lajeado and Estrela gauges monitored by SGB are located. Orange signal increases happen where water enters beneath trees and structures (radar double-bounce).",
    },
    consequences: {
      pt: "Submersão de barrancos baixos, acessos ribeirinhos e vegetação de margem. Em quadras urbanas densas, prédios e árvores podem ocultar parte da lâmina d’água para o satélite — consulte sempre a Defesa Civil local.",
      en: "Submersion of low riverbanks, riverside access points, and bank vegetation. In dense urban blocks, buildings and trees can mask part of the water from the satellite — always check local Civil Defense.",
    },
    technicalNote: {
      pt: "Dados técnicos: Combinação de `radar_decrease` (água aberta) e `radar_increase` (interação dupla água-tronco/estrutura na mata ciliar) + Boletim SGB 23/07 19:00 UTC (acima da cota de inundação).",
      en: "Technical data: Combination of `radar_decrease` (open water) and `radar_increase` (water-trunk/structure double-bounce in riparian zone) + SGB Bulletin Jul 23 19:00 UTC (above flood stage).",
    },
  },
  {
    id: "sul-estrela-lavouras",
    code: "Q3",
    kind: "floodplain",
    center: [-51.9535, -29.5082],
    bounds: [-51.9605, -29.5128, -51.9445, -29.5030],
    municipality: "Estrela",
    elevationApproxM: 17,
    slopeApproxDeg: 1.5,
    dominantLandUse: {
      pt: "Campos de cultivo (lavoura) e áreas abertas de planície",
      en: "Cropland fields and open floodplain terrain",
    },
    title: {
      pt: "Q3 · Planície agrícola sul (Estrela)",
      en: "Q3 · Southern agricultural plain (Estrela)",
    },
    subtitle: {
      pt: "Sul de Estrela · Maior concentração de manchas em lavouras (~17 m, inclinação ~1,5°)",
      en: "Southern Estrela · High patch concentration on cropland (~17 m, slope ~1.5°)",
    },
    beforeAfter: {
      pt: "Antes, os talhões agrícolas apareciam secos e uniformes. Depois do evento chuvoso, formou-se um corredor denso de manchas azuis e laranjas sobre terrenos que nos últimos 40 anos (JRC) ficam secos mais de 86% do tempo.",
      en: "Before, agricultural plots appeared dry and uniform. After the rain event, a dense corridor of blue and orange patches formed over land that over the past 40 years (JRC) stays dry more than 86% of the time.",
    },
    whatHappened: {
      pt: "Terrenos planos de cultivo (~17 m de altitude) acumularam água da chuva intensa (68,5 mm só no dia 21/07) combinada com a drenagem lenta durante a cheia do rio.",
      en: "Flat cropland (~17 m elevation) pooled water from intense rainfall (68.5 mm on July 21 alone) combined with slow drainage while the river was high.",
    },
    consequences: {
      pt: "Forte indicativo de lâmina d’água parada ou solo saturado em áreas produtivas. Permite identificar quais talhões agrícolas funcionam como bacias naturais de acumulação após temporais.",
      en: "Strong indicator of standing water or saturated soil across productive land. Helps identify which agricultural plots act as natural retention basins after heavy storms.",
    },
    technicalNote: {
      pt: "Dados técnicos: Maior cluster contínuo de `open_water_change_candidate` + JRC GSW v1.5 (1984–2024) com frequência histórica < 14% nas manchas + CHIRPS v3 (87,6 mm em 3d).",
      en: "Technical data: Largest contiguous cluster of `open_water_change_candidate` + JRC GSW v1.5 (1984–2024) with < 14% historical water occurrence inside patches + CHIRPS v3 (87.6 mm in 3d).",
    },
  },
  {
    id: "lajeado-bacia-sul",
    code: "Q4",
    kind: "floodplain",
    center: [-51.9732, -29.5052],
    bounds: [-51.9785, -29.5088, -51.9685, -29.5015],
    municipality: "Lajeado",
    elevationApproxM: 21,
    slopeApproxDeg: 2.9,
    dominantLandUse: {
      pt: "Transição entre área urbana de Lajeado, árvores e baixadas de arroios",
      en: "Transition between Lajeado urban area, trees, and stream lowlands",
    },
    title: {
      pt: "Q4 · Baixadas e arroios no sul de Lajeado",
      en: "Q4 · Lowlands and streams in southern Lajeado",
    },
    subtitle: {
      pt: "Lajeado · Áreas baixas próximas a arroios e bairros (~21 m, inclinação ~2,9°)",
      en: "Lajeado · Low areas near streams and neighborhoods (~21 m, slope ~2.9°)",
    },
    beforeAfter: {
      pt: "Entre as duas passagens do satélite, surgiram manchas concentradas ao longo dos fundos de vale e áreas abertas próximas à malha urbana sul de Lajeado.",
      en: "Between the two satellite passes, concentrated patches appeared along valley bottoms and open ground near southern Lajeado's urban footprint.",
    },
    whatHappened: {
      pt: "Quando o Rio Taquari sobe, ele represa as águas dos arroios menores de Lajeado (efeito de remanso), fazendo a água subir nas baixadas próximas.",
      en: "When the Taquari River rises, it backs up smaller streams in Lajeado (backwater effect), causing water to pool in nearby lowlands.",
    },
    consequences: {
      pt: "Atenção para áreas de várzea próximas a vias e bairros baixos. Importante para planejamento urbano: mostra onde o escoamento tributário encontra resistência quando o rio principal está cheio.",
      en: "Highlights lowland pockets near roads and low neighborhoods. Useful for urban planning: shows where tributary drainage backs up when the main river is high.",
    },
    technicalNote: {
      pt: "Dados técnicos: Resposta em tributários / fundos de vale em Lajeado (malha IBGE 4311403) com altitude média local ~21 m (Copernicus DEM GLO-30).",
      en: "Technical data: Tributary / valley-bottom response in Lajeado (IBGE mesh 4311403) at ~21 m local mean elevation (Copernicus DEM GLO-30).",
    },
  },
  {
    id: "curva-norte-taquari",
    code: "Q5",
    kind: "river_corridor",
    center: [-51.9445, -29.4282],
    bounds: [-51.9545, -29.4345, -51.9330, -29.4225],
    municipality: "Lajeado / Estrela",
    elevationApproxM: 20,
    slopeApproxDeg: 4.6,
    dominantLandUse: {
      pt: "Curva do Rio Taquari, bancos de areia e vegetação ribeirinha",
      en: "Taquari River bend, sandbars, and riverbank vegetation",
    },
    title: {
      pt: "Q5 · Curva norte do Rio Taquari",
      en: "Q5 · Northern bend of the Taquari River",
    },
    subtitle: {
      pt: "Norte de Lajeado e Estrela · Curva do rio (~20 m, inclinação ~4,6°)",
      en: "North of Lajeado and Estrela · River bend (~20 m, slope ~4.6°)",
    },
    beforeAfter: {
      pt: "Mudanças nas bordas da curva do rio, onde bancos de areia, barrancos e vegetação ribeirinha ficaram submersos ou úmidos na passagem de cheia.",
      en: "Changes along the river bend edges, where sandbars, banks, and riparian vegetation became submerged or wet during the high-water pass.",
    },
    whatHappened: {
      pt: "Nas curvas do Rio Taquari, a velocidade da água muda e o nível mais alto cobre faixas de margem que costumam ficar expostas em dias secos.",
      en: "Along bends of the Taquari River, water speed shifts and higher river stages cover bank strips that usually stay exposed on dry days.",
    },
    consequences: {
      pt: "Mostra o comportamento natural de cheia e vazante na entrada norte da área estudada, auxiliando no monitoramento de erosão de margem e assoreamento.",
      en: "Shows natural high- and low-water behavior at the northern entrance of the study area, aiding riverbank erosion and sediment monitoring.",
    },
    technicalNote: {
      pt: "Dados técnicos: Variação de retroespalhamento ao longo de barra fluvial interna e talude externo na curva norte do Rio Taquari.",
      en: "Technical data: Backscatter variation along inner point bar and outer bank on the northern bend of the Taquari River.",
    },
  },
  {
    id: "encostas-oeste-relevo",
    code: "Q6",
    kind: "hillslope",
    center: [-51.9782, -29.4698],
    bounds: [-51.9845, -29.4742, -51.9720, -29.4655],
    municipality: "Lajeado / Cruzeiro do Sul",
    elevationApproxM: 58,
    slopeApproxDeg: 8.5,
    dominantLandUse: {
      pt: "Encostas mais altas, cobertura de árvores e transição para relevo ondulado",
      en: "Higher hillslopes, tree cover, and transition to rolling terrain",
    },
    title: {
      pt: "Q6 · Encostas e relevo mais alto (Oeste)",
      en: "Q6 · Hillslopes and higher terrain (West)",
    },
    subtitle: {
      pt: "Relevo e Encostas · Terreno elevado (~58 m, inclinação ~8,5° no Copernicus DEM)",
      en: "Terrain & Slopes · Elevated ground (~58 m, ~8.5° slope in Copernicus DEM)",
    },
    beforeAfter: {
      pt: "Diferente da várzea baixa (~18 m), aqui o terreno sobe para ~58 m com encostas mais inclinadas. O radar registrou manchas de mudança de rugosidade da superfície (mais de 31.000 m² no ponto), sem formar lâmina contínua de rio.",
      en: "Unlike the low floodplain (~18 m), terrain here rises to ~58 m with steeper slopes. Radar recorded surface roughness changes (over 31,000 m² in this spot) without forming a continuous river sheet.",
    },
    whatHappened: {
      pt: "Em encostas e morros (que você pode ver em relevo ativando o modo 3D no topo!), mudanças fortes no reflexo do radar indicam alteração na superfície: solo encharcado após os 87,6 mm de chuva, mudança na vegetação, preparo da terra ou possível exposição de solo.",
      en: "On hillslopes and hills (which you can view in 3D relief using the 3D toggle at the top!), strong radar reflection changes indicate surface alteration: wet soil after 87.6 mm of rain, vegetation change, land preparation, or possible exposed ground.",
    },
    consequences: {
      pt: "Como usar hoje e até onde vamos ampliar: hoje cruzamos a inclinação real (Copernicus DEM 30m) + relevo 3D + mudança de textura do radar para apontar encostas que mudaram após chuvas fortes. No próximo passo de expansão com o produto interferométrico NISAR L2 GUNW, poderemos medir deslocamentos milimétricos do terreno para detectar movimentação de encostas e deslizamentos!",
      en: "How to use today & future expansion: today we combine real slope (Copernicus DEM 30m) + 3D relief + radar texture change to flag hillslopes that changed after heavy rain. In our next expansion step using the NISAR L2 GUNW interferometric product, we will measure millimeter-scale ground displacement to detect slope movement and landslides!",
    },
    technicalNote: {
      pt: "Dados técnicos: Polígono `general-change` (~31.600 m²) sobre terreno elevado (Copernicus DEM GLO-30 > 50 m, declividade local ~8,5°). Limite científico atual: amplitude GCOV mede rugosidade/umidade, não fase interferométrica (InSAR GUNW).",
      en: "Technical data: `general-change` polygon (~31,600 m²) on elevated terrain (Copernicus DEM GLO-30 > 50 m, local slope ~8.5°). Current scientific boundary: GCOV amplitude measures roughness/moisture, not interferometric phase (InSAR GUNW).",
    },
  },
];

export function buildHotspotsGeoJson(
  hotspots: MapHotspot[],
  lang: Locale,
  selectedId: string | null,
): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: hotspots.map((spot): Feature<Polygon> => {
      const [w, s, e, n] = spot.bounds;
      return {
        type: "Feature",
        properties: {
          id: spot.id,
          code: spot.code,
          kind: spot.kind,
          title: spot.title[lang],
          municipality: spot.municipality,
          selected: spot.id === selectedId,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [w, s],
              [e, s],
              [e, n],
              [w, n],
              [w, s],
            ],
          ],
        },
      };
    }),
  };
}

export interface HotspotLiveStats {
  waterPolygonCount: number;
  decreasePolygonCount: number;
  increasePolygonCount: number;
  generalDecreaseM2: number;
  generalIncreaseM2: number;
}

function pointInBounds(pt: [number, number], bounds: [number, number, number, number]): boolean {
  const [w, s, e, n] = bounds;
  return pt[0] >= w && pt[0] <= e && pt[1] >= s && pt[1] <= n;
}

function firstCoord(geometry: unknown): [number, number] | null {
  if (!geometry || typeof geometry !== "object") return null;
  const g = geometry as { type?: string; coordinates?: unknown };
  if (g.type === "Polygon" && Array.isArray(g.coordinates)) {
    const ring = g.coordinates[0];
    if (Array.isArray(ring) && Array.isArray(ring[0]) && typeof ring[0][0] === "number" && typeof ring[0][1] === "number") {
      return [ring[0][0], ring[0][1]];
    }
  }
  if (g.type === "MultiPolygon" && Array.isArray(g.coordinates)) {
    const poly = g.coordinates[0];
    const ring = Array.isArray(poly) ? poly[0] : null;
    if (Array.isArray(ring) && Array.isArray(ring[0]) && typeof ring[0][0] === "number" && typeof ring[0][1] === "number") {
      return [ring[0][0], ring[0][1]];
    }
  }
  return null;
}

export function computeHotspotLiveStats(
  spot: MapHotspot,
  waterGeoJson: FeatureCollection | null,
  generalGeoJson: FeatureCollection | null,
): HotspotLiveStats {
  let waterPolygonCount = 0;
  let decreasePolygonCount = 0;
  let increasePolygonCount = 0;
  let generalDecreaseM2 = 0;
  let generalIncreaseM2 = 0;

  if (waterGeoJson && Array.isArray(waterGeoJson.features)) {
    for (const f of waterGeoJson.features) {
      const pt = firstCoord(f?.geometry);
      if (pt && pointInBounds(pt, spot.bounds)) {
        waterPolygonCount += 1;
      }
    }
  }

  if (generalGeoJson && Array.isArray(generalGeoJson.features)) {
    for (const f of generalGeoJson.features) {
      const pt = firstCoord(f?.geometry);
      if (!pt || !pointInBounds(pt, spot.bounds)) continue;
      const props = (f.properties ?? {}) as Record<string, unknown>;
      const cls = props.class;
      const areaM2 = typeof props.area_m2 === "number" && Number.isFinite(props.area_m2) ? props.area_m2 : 0;
      if (cls === "radar_decrease") {
        decreasePolygonCount += 1;
        generalDecreaseM2 += areaM2;
      } else if (cls === "radar_increase") {
        increasePolygonCount += 1;
        generalIncreaseM2 += areaM2;
      }
    }
  }

  return {
    waterPolygonCount,
    decreasePolygonCount,
    increasePolygonCount,
    generalDecreaseM2,
    generalIncreaseM2,
  };
}
