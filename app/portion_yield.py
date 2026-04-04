"""Longest-phrase match for bone-in / yield rules (portion_yield_rules in SQLite)."""

from __future__ import annotations

import sqlite3


def normalize_label(s: str) -> str:
    return " ".join(s.strip().lower().split())


def lookup_yield(conn: sqlite3.Connection, label: str) -> tuple[float, bool] | None:
    """Return (edible_ratio, bone_in) if `label` contains a seeded phrase, longest phrase wins."""
    hay = normalize_label(label)
    if not hay:
        return None
    rows = conn.execute(
        """
        SELECT phrase, edible_ratio, bone_in
        FROM portion_yield_rules
        ORDER BY length(phrase) DESC
        """
    ).fetchall()
    for r in rows:
        needle = normalize_label(str(r["phrase"]))
        if not needle:
            continue
        if needle in hay:
            ratio = float(r["edible_ratio"])
            if ratio <= 0 or ratio > 1:
                continue
            return (ratio, bool(r["bone_in"]))
    return None


def effective_grams(conn: sqlite3.Connection, label: str, grams: float | None) -> float | None:
    """Scale grams by edible_ratio when a rule matches; pass through None or non-finite."""
    if grams is None:
        return None
    matched = lookup_yield(conn, label)
    if matched is None:
        return grams
    ratio, _bone = matched
    return grams * ratio
