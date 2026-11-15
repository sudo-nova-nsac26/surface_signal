"""Small illustrative OpenAPI responses; never used as application observations."""

from surfacesignal.interpretation.engine import institutional_stories, methodology
from surfacesignal.processing.capabilities import capabilities


def example(kind):
    empty_interpretation = {
        "language": "pt",
        "summary": "Exemplo ilustrativo: nenhuma observação publicada.",
        "limitations": ["Não é uma região medida."],
        "spatial_aggregation": "not_computed",
        "continuous_environmental_trend": "not_inferred",
    }
    unavailable = {
        "status": "unavailable",
        "method": "general-radar-change-v1",
        "units": {"area": "km2"},
        "parameters": None,
        "statistics": None,
        "derived_id": None,
        "validation_status": "not_validated",
    }
    values = {
        "capabilities": {
            "items": [c.model_dump(mode="json") for c in capabilities()],
            "total": len(capabilities()),
            "offset": 0,
            "limit": 50,
        },
        "methodology": methodology().model_dump(mode="json"),
        "stories": institutional_stories("pt").model_dump(mode="json"),
        "layers": {"analysis_id": None, "items": []},
        "statistics": {
            "analysis_id": "illustrative-example",
            "general_change": unavailable,
            "open_water": {**unavailable, "method": "open-water-change-v2"},
        },
        "timeline": {
            "area_id": "illustrative-example",
            "scene_count": 0,
            "comparison_count": 0,
            "analysis_count": 0,
            "observations": [],
            "comparisons": [],
            "groups": [],
            "events": [],
            "interpretation": empty_interpretation,
            "data_status": "no_data",
        },
        "overview": {
            "area_id": "illustrative-example",
            "area": {
                "area_id": "illustrative-example",
                "name": "Exemplo ilustrativo",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
                },
                "source_url": "https://example.org/illustrative",
                "description": "Synthetic example geometry",
                "crs": "EPSG:4326",
                "max_pixels": 4000000,
            },
            "summary": "Exemplo ilustrativo sem observações.",
            "scene_count": 0,
            "comparison_count": 0,
            "analysis_count": 0,
            "group_count": 0,
            "period_start": None,
            "period_end": None,
            "latest_observation": None,
            "analysis_types": [],
            "availability": "no_observations",
            "valid_coverage_km2_by_analysis": {},
            "change_range_db": {"min": None, "max": None},
            "comparisons_with_water_candidates": 0,
            "temporal_summary": empty_interpretation,
            "warnings": ["Exemplo ilustrativo."],
            "links": {},
            "data_status": "no_data",
        },
        "story": {
            "analysis_id": "illustrative-example",
            "language": "pt",
            "narrative_id": "illustrative-example:pt:v1",
            "title": "Exemplo ilustrativo",
            "summary": "EXEMPLO ILUSTRATIVO — DADOS SINTÉTICOS. Resultados indisponíveis.",
            "observation": "Exemplo sem medições.",
            "result": "Nenhuma medida fornecida.",
            "interpretation": "Não é possível determinar uma causa.",
            "water_interpretation": "Faltam resultados com pixels válidos.",
            "general_state": "insufficient_data",
            "water_state": "insufficient_data",
            "alternative_explanations": [],
            "limitations": ["Exemplo ilustrativo; não é alerta."],
            "key_metrics": [],
            "methodology": {},
            "sources": [],
            "synthetic": True,
            "data_status": "synthetic",
            "validation_status": "not_validated",
            "is_operational_alert": False,
        },
    }
    return {
        200: {
            "content": {
                "application/json": {
                    "examples": {
                        "illustrative": {
                            "summary": "Illustrative contract example; not measured regional results",
                            "value": values[kind],
                        }
                    }
                }
            }
        }
    }
