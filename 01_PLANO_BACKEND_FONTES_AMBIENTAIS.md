# SurfaceSignal — Plano de implementação: integração de fontes ambientais

**Destinatário:** Codex / responsável pelo backend  
**Repositório:** https://github.com/sudo-nova-nsac26/surface_signal  
**Base:** `develop` (inspecionada em 15/11/2026)  
**Branch proposta:** `feature/environmental-data-context`  
**Escopo:** somente backend, ingestão offline, persistência, APIs read-only, publicação estática, testes e documentação. **Não implementar nem redesenhar o frontend.**

## 0. Instrução executiva ao Codex

Implementar integrações reais, verificáveis e incrementais de fontes ambientais no backend do SurfaceSignal, sem reprocessar os HDF5 NISAR existentes e sem alterar os resultados SAR originais. Começar por SGB/ANA (hidrologia), NASA GPM IMERG (chuva), MapBiomas Água (referência histórica), ESA WorldCover (cobertura do solo), IBGE (limites) e Copernicus DEM (relevo). Adicionar uma via de referência/validação Copernicus EMS, e adaptadores de descoberta opcionais para Sentinel-1/Sentinel-2 e RCM, sem prometer disponibilidade de cenas nem comparar sensores diferentes por subtração simples. Todos os dados devem chegar ao frontend por JSON/GeoJSON preparados, via API e pacote estático de mesmos contratos.

**Antes de codificar:** ler `AGENTS.md`, `docs/architecture.md`, `docs/api-contract.md`, `docs/data-sources.md`, `docs/scientific-method.md`, `docs/static-publication.md`, `docs/real-data-execution.md`, `docs/local-analysis-preparation.md`, `docs/frontend-handoff.md`, além de `backend/src/surfacesignal/{cli.py,main.py,config.py,domain.py,publication.py}` e de `providers/`, `processing/`, `api/`, `preparation/`. Verificar commits/PRs novos na `develop` antes de executar. Preservar convenções, contratos e testes. Não criar soluções paralelas ao armazenamento já existente.

### Regras de repositório e segurança

1. `git fetch origin && git switch develop && git pull --ff-only origin develop`; criar `feature/environmental-data-context` a partir da `develop`. Se houver trabalho não commitado, preservar e não sobrescrever.
2. Commits Conventional Commits pequenos; PR **draft** para `develop` ao final. **Não fazer push/merge sem autorização expressa do proprietário.** Não tocar diretamente em `main` nem em `develop`.
3. Não adicionar banco, fila, job HTTP, LLM, serviço em background ou obrigação de hospedagem. Continuar com CLI offline + FastAPI apenas leitura + exportação estática para Next.js.
4. Nunca commitar token Earthdata, credenciais ANA, EODMS ou GEE, `.netrc`, rasters volumosos, arquivos pessoais, URLs assinadas ou observações com licença restritiva. Incluir somente fixtures sintéticas pequenas e metadados públicos autorizados.
5. Dados de teste sintéticos devem ter `synthetic=true`. Ausência de informação = `null`/`unavailable`, nunca valor zero fictício. Não emitir probabilidade de inundação, risco individual, evacuação, previsão ou alerta operacional.
6. Manter compatibilidade de `/api/v1/analyses`, `/api/v1/sources`, `/api/v1/areas`, `/api/v1/analyses/{id}/layers`, `.../statistics`, `.../story`, `.../evidence`, `.../local-analysis` e `.../preparation`. Alterações novas devem ser aditivas e testadas.

## 1. Estado existente que não deve ser reconstruído

- `providers/asf.py`: consulta e download NISAR via ASF; `processing/gcov.py`, `change.py`, `general_change.py`, `history.py`: processamento por pares compatíveis.
- Catálogo versionado: `docs/evidence/asf-catalog.json`, com 19 cenas NISAR PROVISIONAL; relato local de 19 HDF5/17 pares em `docs/real-data-execution.md` (isso **não** implica validação científica).
- `providers/hydro.py` hoje lê CSV (`station`, `observed_at`, `level_m`, `source_url`, `note`) e cruza ±24 h, com caráter apenas contextual. O CSV documentado pode conter somente contexto qualitativo.
- `providers/sources.py`: registro atual de NISAR, ASF, SGB e OPERA. Fonte registrada **não** significa coletor implementado.
- `api/service.py` + `api/routes.py` + `main.py`: repositório de dados locais, rotas GET e modelos Pydantic; `publication.py`: mesmo conteúdo para snapshot estático com hashes/limites; `preparation/`: relatórios locais preparados.
- `frontend/src/data/source.ts`: o único ponto de acesso ao backend no frontend; precisa continuar compatível com modo API e modo estático.

## 2. Catálogo de fontes, finalidade real e prioridade

| Fonte | Papel | Entrada/formato recomendado | Etapa | Critério de habilitação |
|---|---|---|---|---|
| SGB SACE + ANA HidroWebService | Leituras de nível, chuva e vazão, quando existirem e forem verificadas | CSV oficial auditável primeiro; API autenticada depois | P0 | Estação, datum/unidade, data/hora, qualidade e origem verificáveis |
| NASA GPM IMERG V07 | Chuva acumulada anterior ao instante SAR | Recorte NetCDF/HDF/GeoTIFF ou série local documentada | P0 | Coleção/Run, unidade, pixel, intervalo temporal e versão comprovados |
| MapBiomas Água Coleção 5 | Referência de superfície de água histórica (1985–2025), não inundação em 2026 | Export GeoTIFF AOI do GEE; asset oficial | P0 | Ano/coleção/classes/escala e geometria verificáveis |
| ESA WorldCover 2021 v200 | Cobertura do solo histórica (10 m), não monitoramento 2026 | COG por tile e crop | P1 | Legenda/classes, versão 2021, nodata verificáveis |
| IBGE malhas municipais | Limites de Lajeado, Estrela e municípios associados | GeoJSON da API v3 | P1 | Código IBGE, data de referência, CRS e topologia válidos |
| Copernicus DEM GLO-30 | Contexto de elevação/declividade; é DSM, não necessariamente terreno nu | Recorte do raster DEM | P1 | Unidade vertical, datum, cobertura e termos atribuídos |
| Copernicus EMS Mapping | Referência potencial para validação espacial histórica | API de ativações, GeoJSON/GeoTIFF quando houver | P2 | Ativação relevante **com cobertura temporal/espacial**, metodologia e qualidade |
| NASA OPERA DSWx-S1 | Comparação adicional de água superficial; SAR derivado não é verdade independente | Descoberta/crop de produto específico | P2 | Cena e metadados alinhados; QA e semântica documentados |
| Copernicus Sentinel-1 | SAR C-band para estudos separados | STAC/OData; produto GRD, calibração e processamento específicos | P3 | Cena utilizável e processador próprio; nunca subtrair diretamente de NISAR |
| Copernicus Sentinel-2 | Evidência óptica quando cobertura de nuvem permite | L2A/surface reflectance e máscara de nuvens, catalogar antes | P3 | Cenas datadas, QA de nuvens/sombra e método de delineação |
| RADARSAT RCM/CSA | SAR C-band opcional | Pesquisa/metadata EODMS antes de qualquer download | P3 | Cena da AOI/datas, acesso e licença de produto confirmados |

**Observações verificadas em fontes oficiais (15/11/2026):**
- ANA exige solicitação de acesso à API; o portal e o manual podem apresentar orientações/endereços diferentes. Verificar o serviço atual, não codificar e-mail ou endpoint histórico como requisito fixo. O serviço legado tem aviso oficial de transição; não usá-lo como fundação permanente.
- IMERG tem Early/Late/Final e taxas versus acumulados, que não podem ser confundidos. Para histórico, priorizar Final quando disponível; fallback Late explicitamente identificado.
- MapBiomas Água Coleção 5 contém 1985–2025, em 30 m. Para 2026, é **contexto histórico** e não observação contemporânea. Downloads pelo portal podem estar suspensos; usar o asset oficial do GEE, após autenticação individual/autorizada.
- WorldCover 2020 v100 e 2021 v200 usam algoritmos distintos; não inferir mudança 2020→2021 a partir da diferença simples.
- Copernicus DEM GLO-30 é **modelo digital de superfície** (inclui edificações/vegetação); não inferir cota de inundação ou risco por altura.
- RCM: acesso a dados depende do produto, perfil EODMS e licença **da imagem**, não da licença aberta da página do catálogo.

## 3. Arquitetura de implementação

### 3.1. Pipeline explícito

```text
fontes oficiais / downloads autenticados / exportações verificadas
    ↓ (somente CLI: discover, import, fetch)
manifest bruto + checksums + metadados (data/context/raw/, sem publicação)
    ↓ (somente CLI: normalize)
registros UTC, unidades padronizadas, classes e CRS verificados
    ↓ (somente CLI: enrich)
recortes AOI + recortes/estatísticas por análise SAR existente
    ↓
data/context/<area_id>/<analysis_id>/<context_id>/
    ├── environmental-context.json
    ├── reference-layers.json
    ├── supporting/*.geojson  (somente vetores reduzidos e aptos a publicação)
    ├── validation.json       (se houver referência independente)
    └── manifest.json         (hashes e identidade completa)
    ↓
FastAPI GET offline / publicação estática -> frontend/src/data/source.ts
```

A identidade `context_id` deriva de hashes de todos os inputs reais usados, `analysis_id`, geometria AOI, parâmetros, versões das transformações e identificadores de produtos. Timestamp de execução não deve alterar identidade. Outputs incompletos nunca substituem `current.json`; staging e rename atômico conforme o padrão existente. A execução nunca altera `artifacts/<analysis_id>/` nem seus manifests.

### 3.2. Interfaces e diretórios sugeridos (adaptar ao repo real)

```text
backend/src/surfacesignal/
  providers/
    hydro.py                 # ampliar tipagens e importadores, manter compatibilidade
    ana.py                   # adaptador opcional autenticado
    gpm.py                   # IMERG
    mapbiomas.py             # água histórica
    worldcover.py            # classes de cobertura
    ibge.py                  # malhas
    copernicus_dem.py        # DSM
    cems.py                  # candidatos de referência
    copernicus.py            # catalogação Sentinel, sem misturar processamento
    rcm.py                   # disponibilidade EODMS, etapa posterior
    sources.py               # inventário de metadados
  context/
    models.py               # contratos e estados
    importer.py             # importação/normalização
    spatial.py              # clip, resampling, estatísticas, máscaras
    temporal.py             # janelas hidrológicas/chuva
    validation.py           # concordância com referência apropriada
    store.py                # hashes, staging, snapshots e verificação
    engine.py               # build enriquecimento por análise
  api/
    context_routes.py       # apenas GET para produtos prontos
    context_schemas.py
  cli.py                    # `context ...` comandos
  publication.py            # modo estático equivalente
backend/tests/test_context_*.py
config/context/
  stations.example.json     # modelos sem inventar códigos de estação
  providers.example.json    # versões e habilitação
```

Não adicionar dependências pesadas por padrão. `rasterio`, `numpy`, `shapely`, `pyproj`, `httpx` já estão no projeto. Se um SDK Earth Engine/NetCDF for necessário, criar extra opcional e justificar versão/licença; não tornar o funcionamento básico da API dependente do SDK ou de credenciais.

### 3.3. Contrato interno obrigatório para cada importação

```json
{
  "source_id": "gpm-imerg",
  "provider": "NASA GPM",
  "dataset_id": "<id real do produto>",
  "dataset_version": "<versao real>",
  "retrieved_at": "<ISO-8601 UTC>",
  "observed_start": "<ISO-8601 UTC>",
  "observed_end": "<ISO-8601 UTC>",
  "source_url": "<URL sem token>",
  "source_sha256": "<SHA-256 real>",
  "crs": "EPSG:4326",
  "spatial_resolution_m": null,
  "temporal_resolution_seconds": null,
  "native_unit": "mm/h",
  "normalized_unit": "mm",
  "license_id": "<termo realmente conferido>",
  "redistribution_allowed": false,
  "synthetic": false,
  "quality_flags": [],
  "limitations": []
}
```

Esses campos são esquema ilustrativo, não metadados fictícios para publicar. Para vetores, usar `spatial_resolution_m=null` quando inadequado. `redistribution_allowed` precisa ser determinado caso a caso e não pode ser herdado automaticamente da página geral do catálogo.

## 4. Etapas implementáveis, com critérios de aceite

### Etapa P0-A — Auditoria e infraestrutura compartilhada

- Inspecionar testes atuais e publicação estática. Escolher contrato Pydantic `ContextDataset`, `EnvironmentalContextReport`, `ReferenceLayer`, `ContextProvenance`, `ContextValidation` com estados `available|partial|unavailable|not_checked` e `synthetic`.
- Criar `context sources list`, `context import`, `context build`, `context verify` e, se houver necessidade real, `context discover`/`fetch` separados. Suportar `--dry-run`, limites em MB, AOI, data e idempotência.
- Falhas de credencial/serviço externo não interrompem a API nem invalidam processamentos NISAR; marcar fonte como indisponível com motivo sanitizado.
- Separar claramente `sensor_observation`, `historical_context`, `environmental_context`, `independent_reference` e `official_guidance`.
- Testar preservação de outputs antigos, hash, ausência de segredos, resumos nulos e zero regressões.

**Aceite:** dados contextuais sintéticos testados ponta a ponta sem rede; fontes novas desabilitadas não causam erro na API NISAR existente.

### Etapa P0-B — Hidrologia ANA/SGB

- Implementar importação CSV/JSON **oficiais** com dados de estação: `station_id`, `station_name`, coordenadas quando disponíveis, parâmetro (`river_level|rainfall|discharge`), valor, unidade nativa, hora UTC, timezone original, método, validação/qualidade, datum/zero da régua quando documentados, URL e checksum. Sem supor equivalência entre níveis de estações.
- Conservar `HydroRecord` legado e `--hydro-csv` para não quebrar cálculos já publicados. Normalização para novo esquema ocorre em um adaptador à parte.
- Se API disponível, usar autenticação apenas na CLI; paginação, janela temporal, retries com backoff e timeout. Não usar APIs legadas descontinuadas como caminho principal.
- Definir por configuração a lista de estações relevantes; selecionar somente por código e metadados verificados, não por proximidade presumida. Registrar lacunas, medições rejeitadas e timezone.
- Série temporal visível com medições individuais e diferença temporal frente a cada aquisição SAR. Cotação de nível só com unidade/datum; cota de inundação apenas quando identificada por estação/autoridade e data de vigência.
- Agregar eventos por estação, não somar alturas ou transformar nível em probabilidade de inundação.

**Aceite:** fixture com fuso UTC-03, níveis cm, lacunas, leituras duplicadas e valor nulo; conversão correta de unidade, `observed_at` UTC e registro de dados ausentes.

### Etapa P0-C — NASA GPM IMERG

- Descobrir produto oficial IMERG (Run, V07/subversão, coleção, formato), então importar recorte AOI e tempo via arquivo local ou integração de download autorizada. Não inventar endpoint quando a documentação oferecer múltiplas plataformas.
- Gerar precipitação acumulada em janelas **terminadas no instante de cada aquisição** (ex.: 24, 48, 72 horas) e série temporal regional quando o produto suportar. Anotar o polígono ou pixel utilizado e amostragem espacial (média por AOI, se aplicável).
- Se taxa em `mm/h`, acumular `taxa × duração_em_horas` sobre intervalos válidos; não somar taxas diretamente. Se quantidade em `mm`, não aplicar essa transformação. Implementar cobertura temporal mínima configurável e `null` quando não cumprida.
- Preservar `run=early|late|final`, versão, QA, resolução, eventuais intervalos sem amostra, latência, aquisição UTC e espacialidade. Não mostrar 10 km como chuva por pixel SAR.

**Aceite:** cálculo de acumulação com fixtures artificiais, teste de meia hora/horário limite, nodata e conversão mm/h→mm; falta de produto gera status explícito, não chuva zero.

### Etapa P0-D — MapBiomas Água Coleção 5

- Acesso por exportação local GeoTIFF **recortada do GEE**, com asset e banda explicitamente registrados; não exigir login GEE no runtime da API.
- Importar separadamente água anual, mensal (quando aplicável) e frequência histórica; respeitar cobertura até 2025. Anotar ano base e, no mensal, mês/ano; evitar afirmar que um dado de 2025 é evento de 2026.
- Transformar em `historical_water_reference` e calcular interseção/estatísticas por polígono SAR válido, com máscaras de nodata, classe e transformação geoespacial documentadas. Definir se agregação é área em cobertura válida ou fração de polígono, nunca contar pixels de forma arbitrária.
- Gerar GeoJSON recortado/simplificado só se couber no orçamento de publicação. Evitar vetorizar toda a região se a granularidade produzir milhares de feições; preferir resumo tabular + visualização pré-preparada opcional.

**Aceite:** fixture categórica com classe água, nodata, CRS distinto e recorte parcial; relatório distingue explicitamente `historical_reference_year=2025` de `analysis_after=2026`.

### Etapa P1-A — ESA WorldCover + IBGE

- WorldCover 2021 v200 como camada **estática** de cobertura: ler tiles COG/crops com classes e nodata oficiais; resumo percentual em cada polígono/cobertura SAR. Denominar `land_cover_reference_year=2021`, não "vegetação atual".
- IBGE: usar a API v3 de malhas para buscar os municípios por códigos confirmados; validar GeoJSON, CRS EPSG:4326, nomes e versão. Se a API falhar, aceitar arquivo GeoJSON oficial importado manualmente (com proveniência), não estimar polígonos.
- Fazer overlay para `municipalities_intersecting_candidate`, somente interseção geométrica (não atribuir ocorrência efetiva de danos ou pessoas afetadas). Manter AOI atual de 5 km como *analyst-defined*; não substituí-la silenciosamente pela união municipal.

**Aceite:** presença de `water|tree_cover|cropland|built_up|other|unknown` conforme mapeamento validado; sem resultado falso para região sem dados; IBGE válido ou `unavailable` fundamentado.

### Etapa P1-B — Copernicus DEM GLO-30

- Importar tiles/recortes DSM, verificar unidades e datum; calcular estatísticas descritivas de elevação e declividade por AOI/candidato após reprojeção métrica correta.
- Não comparar altura DSM a cota de nível de estação sem referência vertical/datum comum e modelagem hidrológica. Não classificar mapa de risco.
- Não publicar raster bruto se exceder limites ou licença; exportar estatísticas e referência/citação, ou overlay derivado sob termos permitidos.

**Aceite:** teste em superfície artificial conhecida (declividade e recorte), nodata, projeção, nenhuma classificação de inundação derivada apenas de altitude.

### Etapa P2 — Validação e referências independentes

- Copernicus EMS: consultar a API de ativações por datas e região; **somente** habilitar validação quando houver produto que intersecte a AOI e seja temporalmente comparável. Sem cobertura ⇒ `not_available`/`not_validated`.
- Se existir referência adequada, guardar produto, data, classes, método, qualidade e mapeamento dos rótulos. Calcular matriz de confusão e precision/recall/IoU **somente** na interseção de cobertura válida e com tolerância temporal declarada. Não chamar de ground truth quando a própria referência for modelada SAR.
- OPERA DSWx-S1: catalogar e comparar com ressalva de dependência SAR compartilhada; não classificar como validação independente definitiva.
- Imagens Sentinel-2: se houver imagem L2A contemporânea com pouca nuvem, gerar máscara de nuvens/sombras e evidência óptica; não fazer RGB como equivalente a máscara validada de inundação.

**Aceite:** suite com uma referência artificial válida, uma parcialmente sobreposta e uma indisponível. Métricas só no primeiro caso elegível; denominador e QA explícitos.

### Etapa P3 — Expansão multissensor condicional

- Sentinel-1 via Copernicus Data Space: usar STAC/OData oficiais; pesquisar AOI/datas e relatar cenas/QA/licença antes de baixar ou processar. C-band GRD requer calibração, ruído, geometria e normalização próprias. Pares exclusivamente comparáveis dentro do próprio sensor e com parâmetros justificados.
- RCM via EODMS: implementar **discovery/readiness** primeiro (metadados acessíveis e relatório de cobertura). Exigir autorização/licença por produto antes de download, publicação ou criação de camada. Produto indisponível continua somente no registro de fontes.
- Nunca alimentar bandas Sentinel/RCM na rotina NISAR GCOV presumindo identidade de gamma0 e limiar -3/-17 dB. Novo processador só com especificação/QA e testes próprios.

**Aceite:** caso sem cenas retorna status verificável; nenhum arquivo restrito publicado; dados heterogêneos não são combinados em estatísticas de mesma série sem explicação científica.

## 5. APIs aditivas propostas — contrato que o frontend consumirá

Implementar somente rotas GET; nenhum download, rede ou rasterização na requisição. Formalizar em Pydantic/OpenAPI com exemplos. Os caminhos abaixo são o contrato **alvo**; ainda não existem na `develop`.

1. `GET /api/v1/analyses/{analysis_id}/environmental-context` — `EnvironmentalContextReport` da comparação NISAR selecionada. `404` com código `context_not_prepared` se ainda não construído; `503` se conteúdo pronto falhou na validação. Não inferir valores em branco.
2. `GET /api/v1/areas/{area_id}/environmental-events?start=YYYY-MM-DD&end=YYYY-MM-DD&offset=0&limit=50` — `Page[EnvironmentalEvent]` de leituras/eventos associados à área, com hora e station_id. Ordenação explícita e intervalo UTC; dados de uma estação não geram estado de toda a bacia.
3. `GET /api/v1/areas/{area_id}/reference-layers` — `{area_id, items:[ReferenceLayer]}` com `layer_id`, `status`, `title`, `role`, `reference_year`, `legend`, `artifact_url|null`, `source_id`, `limitations` e `redistribution_allowed` (internamente validado).
4. `GET /api/v1/analyses/{analysis_id}/validation` — retorno tipado `{status, reference, metrics, coverage, limitations, provenance}`, onde `metrics=null` quando não houve validação qualificada. Não criar score de confiança substituto.
5. Manter `GET /api/v1/sources` retrocompatível; ampliar modelos aditivamente com `integration_status` (`registered|discovery_only|import_ready|integrated|blocked`), `role`, `coverage_period`, `terms_url`, `update_note`. Se o schema atual não tolerar, criar `/api/v1/context/sources` e documentar a diferença em vez de quebrar a rota antiga.

### Exemplo de contrato (esquema, não medição real)

```json
{
  "schema_version": "1.0",
  "analysis_id": "<analysis_id real>",
  "area_id": "vale-do-taquari",
  "data_status": "partial",
  "synthetic": false,
  "generated_at": "<UTC do build>",
  "observed_at": "<UTC da cena AFTER>",
  "rainfall": {
    "status": "unavailable",
    "source_id": "gpm-imerg",
    "product": null,
    "run": null,
    "resolution_km_approx": null,
    "windows_mm": {"24h": null, "48h": null, "72h": null},
    "coverage_fraction": null,
    "limitations": ["Produto ainda não importado"]
  },
  "hydrology": {
    "status": "unavailable",
    "stations": [],
    "records": [],
    "limitations": ["Sem leitura numérica qualificada"]
  },
  "historical_water": {
    "status": "unavailable",
    "reference_year": null,
    "collection": "MapBiomas Água Coleção 5",
    "overlap_km2": null,
    "overlap_fraction": null,
    "limitations": []
  },
  "land_cover": {"status": "unavailable", "reference_year": 2021, "classes": [], "limitations": []},
  "topography": {"status": "unavailable", "elevation_m": null, "slope_deg": null, "limitations": []},
  "validation": {"status": "not_validated", "reference_id": null, "metrics": null, "limitations": []},
  "sources": [],
  "limitations": ["Contexto não confirma inundação"],
  "is_operational_alert": false,
  "provenance": {"input_sha256": [], "method_version": "environmental-context-v1"}
}
```

**Observação:** o exemplo tem `data_status=partial` apenas para demonstrar os campos; o implementador deverá definir regras rigorosas para `partial` versus `unavailable` e nunca publicar esse placeholder como se fosse dado real.

## 6. Publicação estática — item obrigatório para não bloquear o frontend

`publication.py` já mapeia endpoints JSON para `frontend/public/data/api/v1/`. Estender `publish build` de forma **opt-in** com `--include-environmental-context` para:

```text
frontend/public/data/api/v1/
  analyses/<analysis_id>/environmental-context.json
  analyses/<analysis_id>/validation.json
  areas/<area_id>/environmental-events.json
  areas/<area_id>/reference-layers.json
  areas/<area_id>/references/<nome-autorizado>.geojson
  context-sources.json  # se /api/v1/context/sources for criado
```

- Static e HTTP devem expor exatamente os mesmos schemas. O frontend filtra localmente `start`, `end` e paginação da lista estática, como já faz para `scenes`.
- Exportação deve excluir credenciais, URLs com assinatura, caminhos de host, HDF5, raster bruto, arquivos sem autorização e métricas não suportadas.
- Validar todas as URLs internas e tamanho total; baixar artefatos somente em CLI; usar compressão/simplificação de vetores e recusar excedentes (não truncar em silêncio).
- `--exclude-synthetic` obrigatório no pacote de demonstração real; registros independentes preservam seu próprio `synthetic` e `data_status`.
- Testar geração determinística, manifesto de exportação/hash, URL-resolver, ausência de dados, rota correspondente e convivência com `--include-preparation`.

## 7. Exemplos de execução esperados (propostos; criar as subcommands)

Executar a partir da raiz do repositório; os exemplos não dependem de sintaxe Bash de variáveis e funcionam no Fish.

```sh
uv sync --project backend --frozen --extra dev
uv run --project backend surfacesignal --root "$PWD" context sources list
uv run --project backend surfacesignal --root "$PWD" context import --source ana-hidroweb --file /caminho/estacoes-verificadas.csv --area vale-do-taquari --dry-run
uv run --project backend surfacesignal --root "$PWD" context import --source gpm-imerg --file /caminho/imerg-recorte.tif --area vale-do-taquari --dry-run
uv run --project backend surfacesignal --root "$PWD" context import --source mapbiomas-water --file /caminho/mapbiomas-agua-2025-recorte.tif --area vale-do-taquari --dry-run
uv run --project backend surfacesignal --root "$PWD" context build --area vale-do-taquari --all-analyses --dry-run
uv run --project backend surfacesignal --root "$PWD" context build --area vale-do-taquari --all-analyses
uv run --project backend surfacesignal --root "$PWD" context verify --area vale-do-taquari
uv run --project backend surfacesignal --root "$PWD" publish build --area vale-do-taquari --output frontend/public/data/api/v1 --validate --exclude-synthetic --include-environmental-context --max-export-bytes 250000000
```

Definir efetivamente flags e nomes de importação depois da inspeção; gerar ajuda CLI e atualizar documentação. **Não rodar `context import` com arquivos não existentes; caminhos são exemplos.** `--frozen` só depois de atualizar/pinar o lock ao adicionar dependências; testar lockfiles.

## 8. Validação obrigatória

Testar sem rede (fixtures sintéticas pequenas):

- Parse e integração de GPM: acumulação, cobertura e taxa versus total, bordas de janelas UTC, ausência de intervalo.
- SGB/ANA: cm vs m, nível vs vazão, estação/datum, fuso original, falta de medição, duplicidade, status de QA.
- MapBiomas/WorldCover: class codes, nodata, resolução real, CRS diferente, área de interseção e casos sem cobertura.
- DEM: DSM vs DTM explicitado, unidades, nodata e máscaras.
- IBGE: resposta GeoJSON/TopoJSON segundo `Accept`, fallback oficial local, código de município e reprojeção.
- EMS/OPERA/Sentinel/RCM: descoberta vazia e restrições de licença; ausência não é erro científico.
- Separação SAR/ambiente: outputs GCOV originais inalterados; parâmetros e hashes têm identidade própria.
- API: 200/404/422/503, ausência de acesso remoto por GET, limites, CORS, paginação e objetos com `null`.
- Exportação estática: compatibilidade com `source.ts`, IDs, URLs, hashes, orçamento, segredo ausente, `--exclude-synthetic`.
- Cenários: sem nenhuma nova fonte, só GPM, só hidrologia, todas disponíveis, referência espacial inadequada.

Comandos existentes para checagem:

```sh
uv run --project backend ruff check backend
uv run --project backend ruff format --check backend
uv run --project backend pytest backend/tests -q
uv run --project backend surfacesignal --root "$PWD" history verify --area vale-do-taquari
```

A verificação histórica em uma máquina sem os 131 GB reais pode não ser executável; não alegar sucesso nesse caso. **Não rodar download da coleção NISAR outra vez.**

## 9. Definition of Done por entrega

**DOD P0:** fonte ANA/SGB + GPM + MapBiomas integrada por importação real documentada ou explicitamente indisponível; todos os testes offline; enriquecimento de ao menos um par real verificado; endpoint e snapshot estático com contrato correspondente. Sem transformar contexto em validação.

**DOD P1:** WorldCover + IBGE + DEM com coberturas/crops e métricas testadas; legendas e datas de referência em respostas; sem camada de risco.

**DOD P2:** pesquisa de referências EMS/OPERA e imagem óptica; métricas somente com referência qualificada ou `not_validated` explícito. Nenhum falso score de confiança.

**DOD P3:** catálogo de descoberta para Sentinel-1/2 e RCM; inventário de cenas e licenças real, relatório de lacunas; processamento novo opcional, somente após especificação e testes próprios. Se acesso não permitir, marcar `blocked` e não simular imagens.

Em todas as fases: atualizar `docs/data-sources.md`, `docs/scientific-method.md`, `docs/limitations.md`, `docs/api-contract.md`, `docs/static-publication.md`, `AGENTS.md` e criar `docs/environmental-data-integration.md`. Entregar ao frontend exemplos de JSON reais **sem segredo** e arquivos de teste estáticos pequenos. PR documenta fontes confirmadas, fontes bloqueadas, testes executados, limites, conflitos e evidências.

## 10. Referências oficiais consultadas

- NISAR GCOV: https://nisar-docs.asf.alaska.edu/gcov/
- ANA HidroWeb: https://www.snirh.gov.br/hidroweb/acesso-api
- ANA manual oficial: https://www.gov.br/ana/pt-br/assuntos/monitoramento-e-eventos-criticos/monitoramento-hidrologico/orientacoes-manuais/manuais/manual-hidrowebservice_publica.pdf/view
- SGB Taquari: https://sace.sgb.gov.br/bacia_taquari/
- NASA GPM IMERG: https://gpm.nasa.gov/data/imerg
- MapBiomas GEE assets: https://brasil.mapbiomas.org/downloads/assets-no-google-earth-engine/
- MapBiomas Água anual: https://brasil.mapbiomas.org/iniciativas-e-produtos/agua/mapeamento-anual/superficie-de-agua-anual/
- ESA WorldCover: https://esa-worldcover.org/en/data-access
- IBGE API de malhas: https://servicodados.ibge.gov.br/api/docs/malhas?versao=3
- Copernicus DEM: https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM
- Copernicus EMS Mapping: https://mapping.emergency.copernicus.eu/about/how-to-harvest-cems-mapping-data/
- Copernicus Data Space STAC: https://documentation.dataspace.copernicus.eu/APIs/STAC.html
- Copernicus APIs: https://dataspace.copernicus.eu/analyse/apis
- CSA RADARSAT RCM: https://donnees-data.asc-csa.gc.ca/en/dataset/rcm

