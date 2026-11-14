# Validation levels

1. **Mathematical/software verification:** offline synthetic tests assert known power/dB,
   masks, grid centers/orientation, delta, metric area, components, reprojection, integrity,
   safe artifact access, and reproducibility. These verify code, not real flood accuracy.
2. **Independent sensor/product agreement:** not executed on real aligned imagery. OPERA
   DSWx-S1 product documentation was inspected; no raster downloaded/aligned. A `reference_status`
   helper rejects missing sources and labels temporal offsets >24 h as context only. Within
   24 h means eligible for comparison, not automatically valid. Class mapping, shared valid
   masks, spatial alignment and acquisition timing require explicit review first.
   `agreement()` computes TP/FP/FN/TN, precision, recall, IoU and F1 on supplied aligned Boolean
   arrays; undefined denominators return null. It does not grant validation status automatically.
3. **Field validation:** none. No field survey, ground truth or pixelwise accuracy claim.

SGB level/bulletin context is not a spatial reference. The July 23 bulletin uses 16:00
America/Sao_Paulo = 19:00 UTC, 2 h 33 m 50 s before the 21:33:50 UTC descending acquisition.
The article supplies qualitative station status; level_m stays null. The 24-hour context
window is a configurable analysis convention, not a universal flood-observation tolerance.

Older 2023/2024 event maps cannot label July 2026. OPERA is partly independent but shares
radar ambiguities with NISAR. No numerical agreement metric is filled for this real case.
