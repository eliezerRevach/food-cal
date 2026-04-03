"""Deterministic kcal and protein from grams and per-100g values."""


def kcal_and_protein(
    grams: float,
    kcal_per_100g: float,
    protein_per_100g: float,
) -> tuple[float, float]:
    factor = grams / 100.0
    return factor * kcal_per_100g, factor * protein_per_100g
