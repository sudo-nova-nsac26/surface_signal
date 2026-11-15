# SurfaceSignal — Handoff detalhado para implementação do frontend ambiental

**Destinatário:** Yuri / responsável pelo frontend (ou Codex atuando somente no `frontend/`)  
**Projeto:** https://github.com/sudo-nova-nsac26/surface_signal  
**Base analisada:** branch `develop`, 15/11/2026  
**Branch recomendada:** `feature/environmental-context-ui`, criada a partir da `develop` atualizada e **somente após** alinhar as interfaces com o backend.  
**Dependência:** o backend precisa publicar os novos contratos do documento `01_PLANO_BACKEND_FONTES_AMBIENTAIS.md`. **Eles são propostos e ainda não existem na branch analisada.**

## 1. Objetivo do frontend

Mostrar ao visitante, sem exigir conhecimento de satélites:

1. **O que o radar observou** entre duas datas (alteração de sinal; não inundação confirmada).
2. **O que estava acontecendo no ambiente** naquela janela: chuva acumulada (NASA GPM), leituras de rios/estações (ANA/SGB), tipo de superfície (ESA WorldCover), histórico de presença de água (MapBiomas) e relevo (Copernicus DEM).
3. **Qual a relação entre essas evidências** e a observação SAR — inclusive divergências, lacunas, limitações e distância temporal.
4. **Como sabemos?** Links das fontes, versões, datas, unidade, extensão geográfica e indicação de validação independente ou ausência dela.

Não criar alerta meteorológico, status de risco, mapa de áreas seguras, previsão, probabilidade de inundação ou afirmação de vítimas/danos a partir de radar. A interface permanece exploratória e bilíngue. Toda informação não medida fica com estado explícito de indisponibilidade, nunca `0`.

## 2. Estado atual e arquivos que devem ser lidos

Antes de alterar, ler `AGENTS.md`, `docs/frontend-handoff.md`, `docs/api-contract.md`, `docs/static-publication.md`, `docs/interpretation-model.md` e o contrato atualizado pelo backend; em seguida, inspecionar:

```text
frontend/src/data/source.ts              # única entrada de dados; API ou JSON estático
frontend/src/data/api-types.ts           # interfaces TypeScript de respostas
frontend/src/data/region.ts              # transformação dos registros para modelos amigáveis
frontend/src/data/area-labels.ts         # nomes humanos das regiões
frontend/src/components/map/MapStage.tsx # estado da etapa selecionada, comparador, overlays
frontend/src/components/map/MapView.tsx  # MapLibre GL; layers/geoJSON/câmera
frontend/src/components/map/Timeline.tsx # passos temporais e boletins
frontend/src/components/map/ComparePanel.tsx # antes/depois + toggles atuais
frontend/src/app/[lang]/page.tsx         # seções: como funciona, camadas, região, fontes
frontend/src/i18n/dictionaries/pt.ts
frontend/src/i18n/dictionaries/en.ts
frontend/src/preferences/store.ts       # tamanho, contraste e movimento
frontend/public/data/api/v1/            # snapshot real somente quando instalado
frontend/public/data/demo/api/v1/       # dados ilustrativos isolados
```

Situação da `develop` inspecionada:

- Next.js 16 + TypeScript + Tailwind 4 + MapLibre 6, com idiomas PT/EN e cuidados de acessibilidade.
- `source.ts` alterna entre `NEXT_PUBLIC_API_BASE_URL` e `/data/api/v1/`; componentes não constroem URLs nem chamam serviços oficiais de dados.
- `MapStage.tsx` controla o passo da linha do tempo (`selectedStep`), o compare antes/depois, o toggle de água e a URL dos polígonos NISAR.
- `ComparePanel.tsx` lista estática `water` (interativo), `vegetation` (exploratory) e `slopes` (unavailable). **Não trocar `slopes` para "disponível" apenas por importar DEM**: declividade contextual não equivale a movimento do terreno InSAR.
- `Timeline.tsx` usa passos de aquisição NISAR e boletins; não misturar um evento hidrológico com uma aquisição ou um par SAR.
- `MapView.tsx` já tem fonte de polígonos, relevo 3D, seleção de local e efeitos de globo; a nova integração deve ser aditiva, sem reescrever câmera, movimentos ou estilo.
- `region.ts` tem `ComparisonView`, `TimelineStep`, e carrega cenas/análises. Os novos dados devem ser vinculados por `analysisId` real, não por "mesma data" inferida ou índice do array.
- Snapshot estático grande pode ser entregue fora do Git; não assumir que está versionado ou presente em toda máquina.

## 3. Proposta de UX: apresentar evidências, não adicionar toggles sem contexto

### 3.1. Dentro do mapa principal

Conservar o mapa e o comparador já existentes. Acrescentar, em uma região lateral/aba expansível, um painel **"Entenda esta mudança"** com três grupos, na ordem:

**A. Sinal do satélite (seção principal)**  
Título: "O que mudou entre 11 e 23 de julho?" (datas **dinâmicas** da comparação real). Texto curto: "O radar registrou mudanças no reflexo do sinal nesta região. Isso pode ter diferentes causas." Mostrar área medida somente se existir, com `km²` e contexto de **cobertura válida**; não chamá-la de "área inundada". Link para explicação metodológica.

**B. O que sabemos sobre o ambiente (cartões curtos)**

- **Chuva antes da passagem** — "Chuva estimada nas últimas 24 h: 42 mm" *somente quando o backend fornecer esse valor real*. No estado vazio: "Não temos uma estimativa de chuva para esta passagem". Fonte NASA GPM IMERG, janela e resolução.
- **Nível do rio** — estação e hora: "Estrela — leitura às 17h30: ..." *somente quando a leitura e o horário vierem da API*. Mostrar unidade e referência de medição; sem comparar níveis entre estações diferentes. Na ausência: "Sem leitura numérica para este período".
- **Histórico de água** — "Nesta área, o MapBiomas registrou presença histórica de água (referência até 2025)". Preferir classe/fração medida à inferência subjetiva. Deixar claro que não é observação de 2026.
- **Cobertura do solo** — "Tipo de superfície segundo o mapa de 2021: ...". Mostrar distribuição real por classe e `unknown`/área válida quando fornecidos.
- **Relevo** — altitude/declividade como *contexto* se o backend disponibilizar. Não escrever "maior risco".

**C. Evidências e limitações**  
Uma frase em linguagem comum: "A observação é compatível com mais de uma explicação; a causa não foi confirmada." Um botão/expansão "Ver fontes e limites" reúne órgão, link, produto, data da referência, resolução aproximada, cobertura e status de validação. Mostrar conflitos: chuva ausente, aquisição ocorrida depois do evento, camada histórica antiga ou nuvens em observação óptica.

**Obrigatório:** manter aviso persistente de que o SurfaceSignal **não é um alerta oficial**. Sem linguagem de instrução emergencial derivada da detecção; preservar os contatos institucionais existentes.

### 3.2. Camadas no mapa — dois grupos visualmente distintos

**Mudanças observadas (temporais):**
- "Possível mudança em água aberta" — o polígono do algoritmo NISAR atual, identificado como candidato/experimental.
- "Sinal mais intenso" e "Sinal menos intenso" — se GeoJSONs derivados reais estiverem disponíveis; legenda sem sugerir causa.

**Informações de referência (não são mudanças no período):**
- "Água observada em anos anteriores" — MapBiomas, com data/coleção na legenda.
- "Tipos de superfície" — ESA WorldCover (2021); classes mapeadas, legenda e atributos corretos.
- "Limites dos municípios" — IBGE (referência cartográfica), não a área real de inundação.
- "Altura da superfície" / "Relevo" — DSM/Copernicus, **não** "movimento da encosta" nem "áreas em risco".
- Sentinel-2 ou produto de referência EMS: apresentar só se estiver publicado, com data e qualidade; usar "imagem de referência" em vez de "verdade comprovada".

**Importante:** as camadas raster de alta resolução não devem ser carregadas como um GeoJSON gigante. O backend deve fornecer estatísticas e GeoJSON simplificado ou tiles/COG de um provedor autorizado; a V1 pode apresentar mapas de referência como cartão estatístico e metadados sem desenho de cada pixel. Nunca publicar tiles de acesso restrito sem licença.

### 3.3. Linha do tempo — não misturar observações de naturezas diferentes

Manter cada passo como par de aquisições NISAR compatíveis. Acrescentar marcas ou informações adicionais **de outra categoria visual**:

- marcador de passagem SAR = aquisição de satélite;
- marcador de medição = leitura de estação hidrológica;
- faixa/janela = período de chuva acumulada;
- registro contextual = boletim datado do SGB;
- símbolo de mapa de validação = produto independente, se existente.

O seletor de comparações continua controlando `analysisId`. A mudança de passo carrega o contexto específico desse ID e associa cada leitura a `observed_at` e distância temporal; não pressupor que dados referentes ao mesmo dia ocorreram no mesmo instante. Usar horários internamente em UTC e formato local `America/Sao_Paulo` só para exibição. Nunca juntar órbitas ascendentes e descendentes em uma única série quantitativa de "evolução da inundação".

### 3.4. Seção "De onde vêm os dados"

A seção de fontes existente deve virar uma lista acessível e honesta de fontes, orientada por status:

| Tipo | O que explicar ao usuário | Status possível |
|---|---|---|
| NISAR/ASF | Satélite/arquivo usados nas mudanças SAR | Integrado |
| SGB/ANA | Leitura de estações; boletins qualitativos em separado | Integrado / parcial / aguardando autorização |
| GPM | Chuva estimada, resolução mais ampla que o radar | Integrado / indisponível |
| MapBiomas Água | História até 2025, não observação do evento em 2026 | Integrado / indisponível |
| ESA WorldCover | Cobertura do solo de 2021 | Integrado / indisponível |
| IBGE | Limites municipais simplificados | Integrado / indisponível |
| Copernicus DEM | Modelo de superfície, não mapa de risco | Integrado / indisponível |
| Copernicus EMS/OPERA | Referências adicionais quando houver cobertura | Somente pesquisa / integrado |
| Sentinel-1/2 | Cenas adicionais, não necessariamente analisadas | Pesquisa de disponibilidade / integrado |
| RADARSAT RCM | Dados canadenses, acesso e licença podem restringir | Planejado / sem cenas / restrito |

Evitar mostrar tudo como "fontes utilizadas nesta análise" se algumas estiverem apenas cadastradas. Separar **"Usadas nesta comparação"** de **"Outras fontes avaliadas"**.

## 4. Contrato de integração frontend ↔ backend

Endpoints propostos em `01_PLANO_BACKEND_FONTES_AMBIENTAIS.md` (a implementar):

| HTTP | JSON estático | Quando carregar |
|---|---|---|
| `GET /api/v1/analyses/{id}/environmental-context` | `/data/api/v1/analyses/{id}/environmental-context.json` | Quando o passo selecionado tiver análise real |
| `GET /api/v1/areas/{id}/environmental-events?start=&end=` | `/data/api/v1/areas/{id}/environmental-events.json` | Uma vez por área/janela; filtrar localmente em modo estático |
| `GET /api/v1/areas/{id}/reference-layers` | `/data/api/v1/areas/{id}/reference-layers.json` | Uma vez ao abrir a região |
| `GET /api/v1/analyses/{id}/validation` | `/data/api/v1/analyses/{id}/validation.json` | Sob demanda na aba "Evidências" |
| `GET /api/v1/context/sources` (opcional) | `/data/api/v1/context-sources.json` | Na seção de proveniência; se rota adicional não for criada, usar `/api/v1/sources` |

### Tipos TypeScript alvo (ajustar ao OpenAPI real, não adivinhar campo)

```ts
export type ContextAvailability =
  | "available"
  | "partial"
  | "unavailable"
  | "not_checked";

export interface EvidenceSource {
  source_id: string;
  name: string;
  url: string;
  product?: string | null;
  reference_year?: number | null;
  observed_start?: string | null;
  observed_end?: string | null;
  resolution_m?: number | null;
  limitations: string[];
}

export interface HydroObservation {
  station_id: string;
  station_name: string;
  observed_at: string; // ISO UTC
  parameter: "river_level" | "rainfall" | "discharge";
  value: number | null;
  unit: string;
  quality_status: string;
  source_id: string;
  time_offset_hours?: number | null;
}

export interface EnvironmentalContextReport {
  schema_version: string;
  area_id: string;
  analysis_id: string;
  observed_at: string;
  generated_at: string;
  data_status: ContextAvailability;
  synthetic: boolean;
  rainfall: {
    status: ContextAvailability;
    source_id: string;
    product: string | null;
    run: string | null;
    resolution_km_approx: number | null;
    windows_mm: Record<string, number | null>;
    coverage_fraction: number | null;
    limitations: string[];
  };
  hydrology: {
    status: ContextAvailability;
    stations: unknown[];
    records: HydroObservation[];
    limitations: string[];
  };
  historical_water: {
    status: ContextAvailability;
    reference_year: number | null;
    collection: string;
    overlap_km2: number | null;
    overlap_fraction: number | null;
    limitations: string[];
  };
  land_cover: {
    status: ContextAvailability;
    reference_year: number | null;
    classes: Array<{class_id: string; label: string; percent: number | null}>;
    limitations: string[];
  };
  topography: {
    status: ContextAvailability;
    elevation_m: number | null;
    slope_deg: number | null;
    limitations: string[];
  };
  validation: {
    status: string;
    reference_id: string | null;
    metrics: Record<string, number | null> | null;
    limitations: string[];
  };
  sources: EvidenceSource[];
  limitations: string[];
  is_operational_alert: false;
  provenance: Record<string, unknown>;
}

export interface ReferenceLayer {
  layer_id: string;
  status: ContextAvailability;
  title: string;
  role: "historical_context" | "environmental_context" | "independent_reference";
  reference_year: number | null;
  legend: Array<{value: string | number; label: string; color?: string}>;
  artifact_url: string | null;
  source_id: string;
  limitations: string[];
}
```

**ATENÇÃO:** esses tipos são uma proposta; quando o backend entregar `/openapi.json`, confrontar cada campo, normalizar os nomes e preferir gerar interfaces a partir do schema sem adicionar dependência complexa desnecessária. Se faltar um campo no backend, reportar o gap: não preencher com valores inventados ou traduzir `unknown` em `0`.

### Implementação em `frontend/src/data/source.ts`

Criar funções sem fazer fetch direto em componentes:

```ts
// Assinaturas desejadas. Implementação deve usar os utilitários getJson,
// API_BASE, STATIC_ROOT e o padrão de cancelamento já existentes no arquivo.
export function getEnvironmentalContext(
  analysisId: string,
  signal?: AbortSignal,
): Promise<EnvironmentalContextReport>;

export function listEnvironmentalEvents(
  areaId: string,
  start?: string,
  end?: string,
  signal?: AbortSignal,
): Promise<EnvironmentalEvent[]>;

export function listReferenceLayers(
  areaId: string,
  signal?: AbortSignal,
): Promise<ReferenceLayer[]>;

export function getAnalysisValidation(
  analysisId: string,
  signal?: AbortSignal,
): Promise<AnalysisValidation>;
```

Regras do `source.ts`:

- Modo **API**: usar `GET /api/v1/...`, `getAllPages()` em listas paginadas, `AbortSignal` em todas as operações, `encodeURIComponent` nos IDs.
- Modo **estático**: resolver arquivos `environmental-context.json`, `environmental-events.json`, `reference-layers.json`, `validation.json` dentro de `/data/api/v1`. Filtrar intervalo no cliente apenas após verificar horários válidos, usando UTC. Não tentar adicionar query string a um arquivo `.json`.
- Reutilizar `DataSourceError`; para `404` esperado de `context_not_prepared`, mostrar estado de "Ainda não preparado". Erros de integridade/503 ou JSON malformado mostram "Não foi possível carregar estes dados", sem trocar por uma amostra.
- Validar URLs de `artifact_url`: só aceitar caminhos relativos internos permitidos ou URLs de origem explicitamente aprovadas (proteger contra links maliciosos injetados em JSON). A camada de dados não deve expor tokens.
- Não carregar todo `analyses.json` repetidamente ao clicar em cada cartão; usar/cachear o índice já carregado. Cancelar solicitações em mudança de passo e ignorar respostas atrasadas por `analysisId`.
- Se o backend alterar a estrutura do contrato na versão 1.x, concentrar adaptadores em `src/data/`, não introduzir conversão de unidades dentro de React.

## 5. Componentes e organização sugeridos

```text
frontend/src/
  data/
    api-types.ts            # ampliar contratos existentes
    source.ts               # funções de acesso API/estático
    environmental.ts        # dados -> modelos de apresentação, estados, rótulos factuais
    region.ts               # associar contexto ao analysisId selecionado
  components/
    environment/
      EnvironmentalContextPanel.tsx
      RainfallCard.tsx
      RiverGaugeCard.tsx
      HistoricalWaterCard.tsx
      LandCoverCard.tsx
      TerrainCard.tsx
      EvidenceSources.tsx
      ContextAvailability.tsx
    map/
      MapStage.tsx           # orquestrar seleção, estados e sobreposições
      MapView.tsx            # camadas GeoJSON opcionais
      ComparePanel.tsx       # preservar controles existentes; seção de referências separada
      Timeline.tsx           # marcações complementares, sem alterar passos SAR
  i18n/dictionaries/
    pt.ts
    en.ts
```

Priorizar um painel compacto em vez de cinco cartões enormes no celular. No desktop, exibir painéis em lateral sem ocultar o mapa; no mobile, usar gaveta/sheet ou cartão expansível abaixo dos controles de mapa. Não bloquear zoom/rotação nem a intro do globo; não reescrever `MapView`.

### Fluxo de dados e estado

```text
seleção de região
  ├─ loadRegionView() [já existe]
  ├─ listReferenceLayers(areaId) [novo, cache por área]
  └─ listEnvironmentalEvents(areaId) [novo, cache por área]
        ↓
seleção de passo NISAR (TimelineStep)
  ├─ se `step.analysis === null`: mostrar contexto do período da área, MAS não inventar observação SAR
  └─ se analysisId válido:
        ├─ getEnvironmentalContext(analysisId)
        ├─ getAnalysisValidation(analysisId) sob demanda
        └─ getArtifactJson/URL atual para polígonos SAR
                ↓
EnvironmentalContextPanel + ComparePanel + MapView
```

`MapStage` tem que manter states `selectedStep`, `compare`, `waterOn`, e adicionar estado de `context` com chave `analysisId`. Se o usuário passar rápido por cinco etapas, a resposta da primeira não pode sobrescrever a quinta. Preferir `AbortController` e checagem da chave do request. Para apresentação, usar view model derivado/memoizado (`src/data/environmental.ts`) em vez de duplicar lógica em componentes.

### Renderização do mapa com MapLibre

- Usar fontes/layers com IDs estáveis e diferentes dos já utilizados (`change-candidates`, `analysed-area`, `terrain` etc.). Prefixo sugerido `env-` para overlays novos.
- Adicionar/remover camadas no lifecycle do estilo apenas após `map.isStyleLoaded()` e com verificações de existência. Evitar recriar o mapa ou o estilo a cada toggle.
- Não chamar `setProjection`, `setTerrain` ou `easeTo` em efeito disparado por cada cartão: esses comportamentos já são delicados no projeto. Preservar sincronismo da intro 2D/3D.
- Para overlays `GeoJSON`, pedir ao backend geometria simplificada EPSG:4326, tamanho limitado, FeatureCollection com properties de legenda e versão; não buscar os HDF5 NISAR, TIFF brutos ou arquivos de credencial do browser.
- Camadas ambientais estáticas independem do controle antes/depois. O controle antes/depois modifica somente as formas de mudança observada. Ex.: o histórico MapBiomas não deve desaparecer quando o usuário arrasta o slider para `before`.
- Quando não houver camada adequada, exibir dados em cartão textual, sem fingir que há polígonos.
- Desenhar legenda em cada overlay, com data/ano e fonte; respeitar unidades e classes oficiais. Não utilizar a mesma cor para fenômenos com significado diferente apenas por conveniência.

## 6. Matriz de estados — obrigatória

| Condição do backend | O que mostrar | O que não mostrar |
|---|---|---|
| Comparação NISAR real com evidência ambiental disponível | Polígono SAR, contexto, fonte e horário | "Enchente confirmada" sem validação |
| Análise SAR ausente | "Não processado" + eventuais observações regionais independentes | Polígonos fictícios |
| Fonte cadastrada porém sem dado na AOI | "Fonte avaliada — dados não disponíveis para este período" | Estado de integrado/resultado de 0 |
| Chuva `windows_mm.24h = null` | "Sem estimativa para 24 h" | "Não choveu" |
| Chuva `windows_mm.24h = 0` real e válida | "0 mm de chuva estimada" com QA | "Sem dados" |
| Nível do rio sem datum/cota oficial | Medição com unidade e limitações | Comparação com cota de inundação inventada |
| MapBiomas 2025 em evento de 2026 | "Histórico de água até 2025" | "Água detectada em 2026" |
| WorldCover 2021 | "Uso/cobertura segundo mapa 2021" | "Vegetação atual" |
| DEM/declividade presente | "Relevo estimado" | "Risco alto" ou "Movimento do terreno" |
| Validação `not_validated` | "Ainda não confirmado por referência independente" | Selo de validado |
| Somente dado sintético | Etiqueta inequívoca "Dado ilustrativo" | Apresentação como real |
| Falha HTTP 503 / bundle inválido | Erro recuperável e detalhes sem exposição de segredo | Fallback silencioso para demo |
| Fonte RCM restrita | "Dados RCM não disponibilizados para esta análise" | Mapa RCM inventado |

## 7. Linguagem, acessibilidade e visual

- **Português simples primeiro**, tradução equivalente em inglês. Frases curtas, verbos diretos; glossário opcional para "radar", "estimativa de chuva", "cobertura do solo".
- "O satélite observou uma mudança" ≠ "A água chegou até aqui". "Pode estar relacionado" e "não confirmado" são preferíveis a causalidade afirmativa.
- `Intl.NumberFormat` com local `pt-BR`/`en-US` para mm, m e km²; preservar `null` como ausência; valores de chuva/eventos carregam a janela temporal.
- Datas ISO UTC no payload; `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'` para exibição. Incluir hora e nome da fonte ao comparar leituras perto da passagem.
- Links com texto compreensível: "Fonte: ANA, estação X", "Metodologia do MapBiomas Água", "Detalhes da aquisição NISAR"; não mostrar apenas "clique aqui".
- Cores não são único canal: ícone/legenda/texto, foco visível, `aria-live` de progresso/erro sem excesso de anúncio, controles >=48 px, compatibilidade com teclado e `prefers-reduced-motion`/preferências já existentes.
- Em celular fraco, carregamento por demanda; GeoJSON simplificado; não adicionar gráfica pesada e não fazer vários fetches paralelos de rasters.
- Preservar identidade Sudo Nova: navy/ciano/âmbar, contraste, responsividade e animações já ajustadas; não mudar paleta de dados arbitrariamente.
- Auditoria de acessibilidade: leitores de tela acessam os mesmos fatos; elementos visuais de chuva e níveis têm texto alternativo com unidade, período, data e estado.

## 8. Sequência recomendada de implementação

**FE-0 — Auditoria e contrato**  
Ler o backend atualizado, inspecionar OpenAPI, coletar exemplos JSON reais e um conjunto sintético rotulado. Garantir equivalência HTTP/estático. Criar branch; nenhuma UI sem contrato documentado.

**FE-1 — Tipos e fonte de dados**  
Implementar `api-types.ts` e quatro funções em `source.ts` com testes de 200/404/503, abort, estático, intervalos UTC e null. Uma função de apresentação em `environmental.ts` gera estados, legendas e textos factuais.

**FE-2 — Painel textual (entrega mínima funcional)**  
Criar `EnvironmentalContextPanel` e cartões de chuva, nível do rio, água histórica e superfície. Ligá-los ao `selectedStep.analysis.analysisId`. Implementar skeleton, "dados não preparados" e indisponibilidade por fonte. **Esta etapa entrega valor mesmo sem nenhuma camada nova no mapa.**

**FE-3 — Fontes e transparência**  
Atualizar seção de dados da página, com fontes realmente utilizadas nesta comparação e outras catalogadas; o visitante abre detalhes e links oficiais. Validação ausente fica explícita, e métricas aparecem somente se qualificadas.

**FE-4 — Overlays ambientais opcionais**  
Adicionar grupo de camadas de referência em `ComparePanel` e `MapView`; legenda, ano, status e ativação. Somente GeoJSON/tiles permitidos publicados; não modificar a animação de antes/depois nem o relevo 3D usado pelo próprio mapa.

**FE-5 — Linha do tempo enriquecida**  
Marcas discretas de leitura de estação, chuva e boletim, sem reordenar os 17 pares SAR já preparados. Se a densidade de eventos estiver alta, agregar visualmente com descrição acessível, não ocultar informação na tipografia.

**FE-6 — Qualidade e entrega**  
Verificação visual mobile/desktop, baixo desempenho, modo reduzido de movimento, alto contraste, teclado, PT/EN, erros offline, sem backend (static mode), backend local (API mode). PR draft para `develop`; não push sem autorização.

## 9. Testes, critérios de aceite e observações para revisão

### Testes unitários (adotar ferramentas existentes; não adicionar infraestrutura sem justificar)

- `source.ts` resolve corretamente API e static para os quatro endpoints; filtra lista estática em UTC; monta URLs com IDs válidos.
- Requisição anterior cancelada/obsoleta nunca sobrescreve contexto da análise selecionada.
- `0` verdadeiro, `null`, campo opcional, data inválida, status parcial, sintético e validação ausente têm visualização distinta.
- Camadas de referência não respondem ao slider antes/depois; só SAR muda opacidade.
- Ordem de eventos e datas não usa fuso horário local para comparação cronológica.
- Nível de estação nunca confunde cm/m; essa transformação é do backend e o frontend mostra unidade recebida.
- Na ausência de uma referência EMS, nenhuma métrica de validação aparece.
- Dados históricos MapBiomas/WorldCover preservam ano e não sugerem que houve inundação em 2026.

### Testes de interface

- Celular pequeno, desktop, zoom de texto, contraste alto, teclado, navegação com VoiceOver/NVDA quando possível.
- API backend desligada: mostrar erro apropriado; modo static completo continua funcionando quando o bundle estiver instalado.
- Rede lenta: cartões exibem skeleton; mudança rápida de comparação não contamina estado.
- 17 pares reais: performance aceitável na linha do tempo; não carregar todas as análises contextuais em paralelo no começo.
- Não expor rota interna, arquivo HDF5, senha ou URL assinada em console/HTML.
- Português e inglês com mesma semântica e números; texto do tipo "alerta de cheia" nunca deriva automaticamente de detecção SAR.

### Critérios de aceite para poder marcar como concluído

1. Visitante seleciona uma comparação real e visualiza contexto ambiental efetivamente disponível, com valores, unidade e fonte.
2. Um contexto ausente ou bloqueado aparece como indisponível, sem falsa confiança nem queda da página.
3. A mesma interface funciona em `NEXT_PUBLIC_API_BASE_URL` (API mode) e em snapshot de `/data/api/v1` (static mode), quando os arquivos correspondentes existirem.
4. A camada e a descrição conservam a diferença entre **mudança SAR**, **histórico de água**, **cobertura do solo**, **chuva**, **nível do rio** e **referência de validação**.
5. Acessibilidade PT/EN, responsividade e modo 2D/3D existentes continuam íntegros.
6. `npx tsc --noEmit`, `npm run lint`, `npm run build` passam; testes adicionais de integração do data adapter e smoke da UI documentados.
7. PR draft descreve screenshots, estados de erro, contratos usados, arquivos alterados e o que permanece não verificado.

## 10. Como executar em desenvolvimento (Fish ou Bash)

```sh
# na raiz do repositório, após atualizar a develop com cuidado
git switch -c feature/environmental-context-ui
cd frontend
npm ci
npm run dev

# em outra janela ou depois de parar o servidor
npx tsc --noEmit
npm run lint
npm run build
```

Configuração:

- **Static mode:** sem `NEXT_PUBLIC_API_BASE_URL`; instalar em `frontend/public/data/api/v1/` o bundle **gerado** pelo backend (não copiar HDF5). A presença apenas das amostras de `demo/` não significa que o bundle real esteja instalado.
- **API mode:** `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`; o backend precisa estar rodando com CORS autorizado para a origem do frontend. A variável é pública, logo jamais adicionar token a ela.
- Não depender de Cloudflare/Firebase em ambiente de desenvolvimento. Deploy permanece tarefa separada.

## 11. O que pedir ao backend antes de começar FE-2

Solicitar estes artefatos concretos (sem credenciais):

1. `openapi.json` com os modelos e endpoints efetivamente implementados.
2. Um `environmental-context.json` real de uma análise elegível, com metadados de origem verificados.
3. Um exemplo de contexto sem dados e um com `synthetic=true` marcado, ambos testados.
4. `reference-layers.json`, `environmental-events.json` e, se existir, `validation.json`.
5. Um pacote estático gerado e verificado com `publish build --include-environmental-context` (flag proposta), com as URLs dos artefatos resolvendo.
6. Inventário de licenças/atribuição e legenda oficial de cada camada. Não presumir que uma imagem do RCM ou um raster DEM possa ser republicado livremente.
7. Confirmação de que dados SGB/ANA são numéricos quando a interface mostrar números; boletim narrativo não vira medição.

**Bloqueio real:** se a API e o pacote estático ainda não existem, implementar FE-1 e a UI com fixtures sintéticas claramente separadas, mas não habilitar cartões falsamente preenchidos na experiência pública. Nunca reconstruir o processamento geoespacial no browser.

## 12. Mensagem curta para repassar ao responsável frontend

> Integre as novas fontes ambientais ao SurfaceSignal sem mudar a arquitetura do mapa. Os dados prontos virão do backend pelo `source.ts` nos modos API/estático. Comece pelos tipos, carregamento por `analysisId` e painel "Entenda esta mudança" com chuva GPM, nível SGB/ANA, histórico MapBiomas, cobertura WorldCover e relevo DEM. Cada cartão mostra fonte, data, unidade, limitações e ausência real quando aplicável. Depois acrescente camadas de referência GeoJSON autorizadas e eventos de estação na timeline. MapBiomas 2025 e WorldCover 2021 são históricos; declividade DEM não é deslocamento InSAR; detecção NISAR não confirma inundação. Preserve 2D/3D, antes/depois, acessibilidade, PT/EN, `source.ts` e static mode. Não invente dados nem implemente download/processamento no navegador.

