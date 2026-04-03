"""Warm the SQLite ``foods`` cache by resolving each query through the same stack as the app.

Reads one food query per line (UTF-8), calls ``resolve_food_row`` so USDA → OFF → baselines apply,
then writes/updates ``foods``. Use a delay between requests to respect API rate limits.

Requires the same environment as the running API (e.g. ``USDA_FDC_API_KEY`` in ``.env``).

Usage (from repo root)::

    python scripts/prefetch_foods_cache.py queries.txt
    python scripts/prefetch_foods_cache.py queries.txt --delay 0.5 --database data/app.db

Lines starting with ``#`` and blank lines are skipped.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent


def _ensure_repo_path() -> None:
    root = str(_REPO_ROOT)
    if root not in sys.path:
        sys.path.insert(0, root)


def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(_REPO_ROOT / ".env")
    except ImportError:
        pass


def _read_queries(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    out: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        out.append(s)
    return out


async def _run(queries: list[str], delay_s: float) -> tuple[int, int]:
    from app import db
    from app.food_resolve import resolve_food_row

    conn = db.get_connection()
    ok = 0
    miss = 0
    for i, q in enumerate(queries, start=1):
        key = q.strip().lower()
        if not key:
            continue
        if delay_s > 0 and i > 1:
            await asyncio.sleep(delay_s)
        row = await resolve_food_row(conn, key)
        if row is None:
            miss += 1
            print(f"[{i}/{len(queries)}] miss: {q!r}", flush=True)
        else:
            ok += 1
            print(f"[{i}/{len(queries)}] ok: {key!r} -> id={row['id']}", flush=True)
    return ok, miss


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prefetch foods cache via lookup_food + resolve_food_row (rate-limited).",
    )
    parser.add_argument(
        "file",
        type=Path,
        help="Text file: one query per line",
    )
    parser.add_argument(
        "-d",
        "--database",
        help="SQLite database path (overrides SQLITE_PATH)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.35,
        metavar="SEC",
        help="Seconds to sleep between requests (default: 0.35)",
    )
    args = parser.parse_args()

    if args.database:
        os.environ["SQLITE_PATH"] = str(args.database)
    elif not os.environ.get("SQLITE_PATH"):
        os.environ["SQLITE_PATH"] = str(_REPO_ROOT / "data" / "app.db")

    _load_dotenv()
    _ensure_repo_path()

    path: Path = args.file
    if not path.is_file():
        raise SystemExit(f"File not found: {path}")

    queries = _read_queries(path)
    if not queries:
        raise SystemExit("No queries to process (file empty or only comments).")

    from app import db

    db.reset_for_testing()

    ok, miss = asyncio.run(_run(queries, max(0.0, args.delay)))
    print(f"Done. resolved={ok} unresolved={miss}")


if __name__ == "__main__":
    main()
