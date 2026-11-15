from surfacesignal.interpretation.content import LIMITATIONS, SOURCES, TOPICS
from surfacesignal.interpretation.models import (
    InstitutionalStory,
    Localized,
    Methodology,
    Metric,
    Stories,
    Story,
)


def methodology():
    return Methodology(
        stages=[
            "radar_observation",
            "change_detection",
            "environmental_hypothesis",
            "independent_validation",
        ],
        methods={
            "general_change": {
                "algorithm": "general-radar-change-v1",
                "default_threshold_db": 3.0,
                "inclusive": True,
                "min_component_pixels": 9,
                "connectivity": 4,
                "threshold_kind": "uncalibrated_heuristic",
                "area_unit": "km2",
                "area_basis": "projected_metre_grid_determinant",
            },
            "open_water": {
                "algorithm": "open-water-change-v2",
                "delta_threshold_db": -3.0,
                "after_threshold_db": -17.0,
                "relation": "Thematic interpretation of decreases; filters and thresholds may differ from general change.",
            },
        },
        limitations=Localized(pt=" ".join(LIMITATIONS["pt"]), en=" ".join(LIMITATIONS["en"])),
        sources=SOURCES,
        examples=[
            {
                "synthetic": True,
                "delta_gamma0_db": 3.0,
                "classification_before_component_filter": "radar_increase",
            }
        ],
    )


def institutional_stories(lang):
    if lang not in ("pt", "en"):
        raise ValueError("Unsupported language")
    return Stories(
        language=lang,
        items=[
            InstitutionalStory(
                story_id=key,
                title=pt if lang == "pt" else en,
                text=pttext if lang == "pt" else entext,
                sources=SOURCES,
            )
            for key, pt, en, pttext, entext in TOPICS
        ],
    )


def build_story(analysis, derived, lang="pt"):
    if lang not in ("pt", "en"):
        raise ValueError("Unsupported language")
    pt = lang == "pt"
    general = derived["statistics"] if derived else {}
    valid, changed = general.get("valid_area_km2"), general.get("changed_area_km2")
    state = "insufficient_data"
    if valid and changed is not None:
        state = (
            "no_candidates"
            if changed == 0
            else "small_changes"
            if changed / valid < 0.01
            else "extensive_changes"
            if changed / valid >= 0.5
            else "changes"
        )
    water = analysis.statistics.get("candidate_pixels")
    water_state = (
        "insufficient_data"
        if water is None or not analysis.statistics.get("valid_pixels")
        else "no_candidates"
        if water == 0
        else "candidates_identified"
    )
    summaries = {
        "insufficient_data": (
            "Resultados gerais ainda indisponíveis ou sem pixels comparáveis válidos.",
            "General results are unavailable or have no valid comparable pixels.",
        ),
        "no_candidates": (
            "Nenhuma região satisfez os critérios selecionados. Isso não significa que nenhuma mudança tenha ocorrido.",
            "No regions met the selected criteria. This does not mean no change occurred.",
        ),
        "small_changes": (
            "As mudanças selecionadas ocupam menos de 1% da área válida; isso não mede sua importância ambiental.",
            "Selected changes occupy less than 1% of the valid area; this does not measure their environmental importance.",
        ),
        "extensive_changes": (
            "As mudanças selecionadas ocupam pelo menos metade da área válida; essa extensão não indica, por si só, um desastre.",
            "Selected changes occupy at least half the valid area; this extent alone does not indicate a disaster.",
        ),
        "changes": (
            "O sinal aumentou ou diminuiu em regiões que satisfazem os critérios selecionados.",
            "The signal increased or decreased in regions meeting the selected criteria.",
        ),
    }
    summary = summaries[state][0 if pt else 1]
    if analysis.synthetic:
        summary = (
            "EXEMPLO ILUSTRATIVO — DADOS SINTÉTICOS. "
            if pt
            else "ILLUSTRATIVE EXAMPLE — SYNTHETIC DATA. "
        ) + summary
    water_text = (
        (
            "Alguns pixels combinam diminuição do sinal e retorno baixo, compatíveis com possível água aberta. Não confirma transbordamento de rios."
            if pt
            else "Some pixels combine decreasing signal and low return, compatible with possible open water. This does not confirm river overflow."
        )
        if water_state == "candidates_identified"
        else (
            "A análise não identificou regiões que satisfizessem os critérios selecionados. Isso não significa que nenhuma mudança tenha ocorrido."
            if pt
            else "The analysis identified no regions meeting the selected criteria. This does not mean no change occurred."
        )
        if water_state == "no_candidates"
        else (
            "Faltam resultados de água com pixels válidos."
            if pt
            else "Water results with valid pixels are missing."
        )
    )
    labels = [
        ("valid_area_km2", "Área válida", "Valid area"),
        ("increase_area_km2", "Aumento", "Increase"),
        ("decrease_area_km2", "Diminuição", "Decrease"),
        ("changed_area_km2", "Mudança selecionada", "Selected change"),
        ("unchanged_area_km2", "Sem mudança selecionada", "No selected change"),
    ]
    metrics = [
        Metric(key=k, label=p if pt else e, value=general.get(k), unit="km2") for k, p, e in labels
    ]
    metrics.append(
        Metric(
            key="candidate_area_km2",
            label="Candidatos de água" if pt else "Water candidates",
            value=analysis.statistics.get("candidate_area_km2"),
            unit="km2",
        )
    )

    def number(value):
        return (
            (f"{value:.4f}".replace(".", ",") if pt else f"{value:.4f}")
            if value is not None
            else ("indisponível" if pt else "unavailable")
        )

    result = "; ".join(f"{m.label}: {number(m.value)} km²" for m in metrics) + "."
    return Story(
        analysis_id=analysis.analysis_id,
        language=lang,
        narrative_id=f"{analysis.analysis_id}:{derived['derived_id'] if derived else 'water'}:{lang}:v1",
        title="O que mudou no sinal do radar" if pt else "What changed in the radar signal",
        summary=summary,
        observation="Comparamos a intensidade do retorno do radar entre duas observações compatíveis."
        if pt
        else "We compared radar return intensity between two compatible observations.",
        result=result,
        interpretation="A causa não está estabelecida. Água, vegetação, umidade e condições de observação podem influenciar o sinal."
        if pt
        else "The cause is not established. Water, vegetation, moisture and observation conditions may influence the signal.",
        water_interpretation=water_text,
        general_state=state,
        water_state=water_state,
        alternative_explanations=[
            "Variações de umidade",
            "Mudanças na vegetação ou cobertura",
            "Condições da água superficial",
            "Condições de observação e sombra",
        ]
        if pt
        else [
            "Moisture variations",
            "Vegetation or land-cover changes",
            "Surface water conditions",
            "Observation conditions and shadow",
        ],
        limitations=LIMITATIONS[lang],
        key_metrics=metrics,
        methodology={
            "methodology_id": "surface-signal-mvp-v1",
            "mission": "NISAR NASA/ISRO",
            "provider": "ASF / NASA Earthdata",
            "product": "GCOV gamma0",
            "parameters": analysis.parameters,
            "general_parameters": derived["parameters"] if derived else None,
            "scenes": [s.model_dump(mode="json", exclude={"metadata"}) for s in analysis.scenes],
            "provenance": analysis.provenance,
            "derived_id": derived["derived_id"] if derived else None,
        },
        sources=list(
            dict.fromkeys(
                SOURCES + analysis.evidence.sources + [s.url for s in analysis.scenes if s.url]
            )
        ),
        synthetic=analysis.synthetic,
        data_status="synthetic" if analysis.synthetic else "real",
    )
