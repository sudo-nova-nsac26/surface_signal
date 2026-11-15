"""Versioned editorial paraphrases checked against primary sources on 2026-11-15.

Source locators and scope are preserved. Human adoption/review remains required;
these templates do not assert approval by the referenced authorities.
"""

from surfacesignal.preparation.models import Action, GuidanceSource

VERSION = "preparation-content-v1"
SOURCES = [
    GuidanceSource(
        source_id="mdhc-2025",
        title="Guia de Orientação para Salvaguarda dos Direitos Humanos de Públicos Prioritários em Contextos de Desastres e Emergências Climáticas (2025)",
        publisher="Ministério dos Direitos Humanos e da Cidadania",
        url="https://www.gov.br/mdh/pt-br/assuntos/noticias/2025/novembro/brasil-atualiza-protocolo-nacional-para-protecao-integral-de-criancas-e-adolescentes-em-situacoes-de-desastres/cartilha_dh_cop_30_digital.pdf",
        retrieved_on="2026-11-15",
        locator="Printed pages 61, 82 and 84",
        applicability="General family preparation, individual needs and accessible communication; not local operational instructions.",
    ),
    GuidanceSource(
        source_id="santa-maria-preparation",
        title="Dicas de Prevenção e Preparação",
        publisher="Prefeitura de Santa Maria — Resiliência Climática e Relações Comunitárias",
        url="https://santamaria.rs.gov.br/smrcrc/1687-dicas-de-prevencao-e-preparacao",
        retrieved_on="2026-11-15",
        locator="Preparação: plano familiar, contatos e documentos protegidos",
        applicability="Only general preparation advice is reused; Santa Maria operational procedures do not apply to Lajeado or Estrela.",
    ),
    GuidanceSource(
        source_id="midr-preparation-2026",
        title="MIDR esclarece que kit de emergência é medida preventiva e não tem relação com alerta nacional",
        publisher="Ministério da Integração e do Desenvolvimento Regional",
        url="https://www.gov.br/mdr/pt-br/noticias/midr-esclarece-que-kit-de-emergencia-e-medida-preventiva-e-nao-tem-relacao-com-alerta-nacional/",
        retrieved_on="2026-11-15",
        locator="Note published 2026-11-07",
        applicability="Permanent preventive preparation and following state/municipal guidance; does not establish a current local event.",
    ),
]

COPY = {
    "pt": {
        "report_labels": {
            "data": "Dados",
            "context": "Contexto",
            "analysis": "Análise",
            "valid": "Área observada",
            "changed": "Área com mudança",
            "water": "Área candidata a água",
            "sources": "Fontes",
            "evidence": "Evidência",
            "status": "Situação",
            "proposed": "proposta",
            "limits": "Limitações",
            "provenance": "Proveniência",
            "unknown": "não medido",
            "residents": "moradores",
            "municipal": "equipes municipais",
            "overlap": "sobreposição",
        },
        "notice": "Proposta de preparação para revisão humana. As observações são das datas indicadas e não descrevem necessariamente a situação atual. Não é um aviso oficial. Consulte as orientações da Defesa Civil do seu município.",
        "limits": [
            "Mudanças observadas não confirmam inundação, danos ou locais seguros.",
            "Sem uma referência espacial independente alinhada, as interpretações continuam sem validação.",
            "Não calculamos recorrência, previsão nem soma de áreas entre datas.",
            "Sem uma máscara vetorial de cobertura válida, ausência de sobreposição significa cobertura desconhecida.",
        ],
        "generic_reason": "Preparação geral baseada em orientação pública; não depende de detecção pelo satélite.",
        "family": "Converse com sua família e preparem um plano considerando as necessidades de cada pessoa.",
        "contacts": "Combine formas alternativas de comunicação e mantenha contatos importantes também em papel.",
        "documents": "Organize documentos importantes e proteja-os da água como parte da preparação familiar.",
        "official": "Consulte as orientações da Defesa Civil do seu município antes de adotar este plano.",
        "municipal": "Revise se os materiais de preparação do município incluem comunicação acessível e necessidades individuais.",
        "review": "Revise os registros e a evidência histórica associados a {name}; avalie se é necessária verificação pela equipe responsável.",
        "review_reason": "Há sobreposição geométrica com mudança observada entre {before} e {after}; isso não confirma que o local foi atingido.",
        "objective": "Organizar a preparação",
        "verification": "Revisar evidência local",
        "role": "Equipe municipal responsável por análise territorial",
        "title": "Análise local — ",
        "plan": "Proposta de preparação — ",
        "synthetic": "Dado ilustrativo. ",
    },
    "en": {
        "report_labels": {
            "data": "Data",
            "context": "Context",
            "analysis": "Analysis",
            "valid": "Observed area",
            "changed": "Changed area",
            "water": "Water candidate area",
            "sources": "Sources",
            "evidence": "Evidence",
            "status": "Status",
            "proposed": "proposed",
            "limits": "Limitations",
            "provenance": "Provenance",
            "unknown": "not measured",
            "residents": "residents",
            "municipal": "municipal teams",
            "overlap": "overlap",
        },
        "notice": "Preparation proposal for human review. Observations refer to the stated dates and do not necessarily describe current conditions. This is not an official warning. Check your municipality's Civil Defense guidance.",
        "limits": [
            "Observed changes do not confirm flooding, damage or safe places.",
            "Interpretations remain unvalidated without an aligned independent spatial reference.",
            "Recurrence, forecasts and sums of areas across dates are not computed.",
            "Without a vector valid-coverage mask, no overlap means coverage is unknown.",
        ],
        "generic_reason": "General preparation based on public guidance; independent of satellite detections.",
        "family": "Talk with your family and prepare a plan that considers each person's needs.",
        "contacts": "Agree on alternative ways to communicate and keep important contacts on paper too.",
        "documents": "Organize important documents and protect them from water as part of family preparation.",
        "official": "Check your municipality's Civil Defense guidance before adopting this plan.",
        "municipal": "Review whether municipal preparation materials include accessible communication and individual needs.",
        "review": "Review the records and historical evidence associated with {name}; assess whether verification by the responsible team is needed.",
        "review_reason": "There is geometric overlap with observed change between {before} and {after}; this does not confirm that the location was affected.",
        "objective": "Organize preparation",
        "verification": "Review local evidence",
        "role": "Municipal team responsible for territorial analysis",
        "title": "Local analysis — ",
        "plan": "Preparation proposal — ",
        "synthetic": "Illustrative data. ",
    },
}


def guidance(lang, audience):
    copy = COPY[lang]
    entries = [("official", "midr-preparation-2026")]
    entries += (
        [
            ("family", "mdhc-2025"),
            ("contacts", "mdhc-2025"),
            ("documents", "santa-maria-preparation"),
        ]
        if audience == "residents"
        else [("municipal", "mdhc-2025")]
    )
    return [
        Action(
            action_id=key,
            audience=audience,
            objective=copy["objective"],
            task=copy[key],
            reason=copy["generic_reason"],
            basis="general_guidance",
            origin="official_guidance_paraphrase",
            evidence_ids=[],
            source_ids=[source],
        )
        for key, source in entries
    ]
