"""Stable capability registry; interpretation is never a physical measurement."""

from surfacesignal.interpretation.models import Capability, Localized


def bilingual(pt, en):
    return Localized(pt=pt, en=en)


def capabilities():
    definitions = [
        (
            "general_change",
            "Mudanças gerais SAR",
            "General SAR changes",
            "implemented",
            "observation",
            "general-radar-change-v1",
            ["delta_gamma0_db"],
            ["delta_gamma0_db"],
            [],
        ),
        (
            "radar_increase",
            "Aumento do sinal",
            "Signal increase",
            "implemented",
            "observation",
            "general-radar-change-v1",
            ["delta_gamma0_db"],
            ["delta_gamma0_db"],
            ["general_change"],
        ),
        (
            "radar_decrease",
            "Diminuição do sinal",
            "Signal decrease",
            "implemented",
            "observation",
            "general-radar-change-v1",
            ["delta_gamma0_db"],
            ["delta_gamma0_db"],
            ["general_change"],
        ),
        (
            "open_water",
            "Possível mudança de água aberta",
            "Possible open-water change",
            "experimental",
            "thematic_candidates",
            "open-water-change-v2",
            ["delta_gamma0_db", "after_gamma0_db"],
            ["prepared_water_candidates"],
            ["radar_decrease"],
        ),
        (
            "vegetation",
            "Vegetação e agricultura",
            "Vegetation and agriculture",
            "exploratory",
            "explanation_only",
            "Independent reference and seasonal analysis required",
            ["land_cover_reference", "seasonal_series"],
            ["radar_change_context"],
            ["general_change"],
        ),
        (
            "soil_moisture",
            "Umidade do solo",
            "Soil moisture",
            "exploratory",
            "explanation_only",
            "Physical retrieval and independent calibration required",
            ["calibrated_retrieval", "ground_reference"],
            ["radar_change_context"],
            ["general_change"],
        ),
        (
            "urban",
            "Áreas urbanas",
            "Urban areas",
            "exploratory",
            "explanation_only",
            "Independent building and change reference required",
            ["building_reference", "independent_validation"],
            ["radar_change_context"],
            ["general_change"],
        ),
        (
            "ground_motion",
            "Movimento do terreno",
            "Ground motion",
            "unavailable",
            "unavailable",
            "Interferometric phase analysis required; GCOV intensity is insufficient",
            ["appropriate_phase_products", "insar_method"],
            [],
            [],
        ),
    ]
    return [
        Capability(
            capability_id=key,
            name=bilingual(pt, en),
            description=bilingual(
                "Observação exploratória do sinal."
                if result == "observation"
                else "Hipótese temática; consulte os dados necessários e as limitações.",
                "Exploratory signal observation."
                if result == "observation"
                else "Thematic hypothesis; consult required data and limitations.",
            ),
            scientific_method=method,
            required_data=required,
            available_data=available,
            implementation_status=status,
            result_type=result,
            dependencies=dependencies,
            limitations=bilingual(
                "Não determina a causa nem confirma impactos. Requer validação independente.",
                "Does not determine causes or confirm impacts. Independent validation is required.",
            ),
        )
        for key, pt, en, status, result, method, required, available, dependencies in definitions
    ]
