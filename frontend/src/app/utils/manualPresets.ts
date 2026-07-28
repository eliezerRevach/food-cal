/** Server-backed manual entry presets (with one-time localStorage migration). */

import {
  deleteManualPresetRemote,
  fetchManualPresets,
  saveManualPresetRemote,
} from './api';

const STORAGE_KEY = 'foodcal-manual-presets';
/** Max presets stored and max rows shown in browse-all dropdown. */
export const MAX_PRESETS = 100;

export type ManualFoodPreset = {
  id: string;
  name: string;
  grams: number;
  protein: number;
  calories: number;
  savedAt: number;
};

let cache: ManualFoodPreset[] | null = null;
let hydratePromise: Promise<void> | null = null;
let migratedLocal = false;

export function presetSignature(
  p: Pick<ManualFoodPreset, 'name' | 'grams' | 'protein' | 'calories'>,
): string {
  const n = p.name.trim().toLowerCase();
  return `${n}|${p.grams}|${p.protein}|${p.calories}`;
}

function isManualFoodPreset(x: unknown): x is ManualFoodPreset {
  if (x === null || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.grams === 'number' &&
    typeof o.protein === 'number' &&
    typeof o.calories === 'number' &&
    typeof o.savedAt === 'number'
  );
}

function readLocalRaw(): ManualFoodPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isManualFoodPreset);
  } catch {
    return [];
  }
}

function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function sortNewest(list: ManualFoodPreset[]): ManualFoodPreset[] {
  return [...list].sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * Match presets whose name contains `q` (case-insensitive). When `requiredWords` is set, each
 * word must also appear in the name — so "לאפה ש" requires "לאפה" in the name, not only "ש".
 * Newest first.
 */
export function matchManualPresetsFromList(
  list: ManualFoodPreset[],
  q: string,
  limit: number,
  requiredWords: string[] = [],
): ManualFoodPreset[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 1) return [];
  const reqs = requiredWords.map((w) => w.trim().toLowerCase()).filter((w) => w.length > 0);
  return sortNewest(list)
    .filter((p) => {
      const name = p.name.toLowerCase();
      if (!reqs.every((rw) => name.includes(rw))) return false;
      return name.includes(needle);
    })
    .slice(0, Math.max(0, limit));
}

/** Prefer first list on signature collision (typically saved presets over history). */
export function mergeFoodSuggestionsBySignature(
  preferred: ManualFoodPreset[],
  extra: ManualFoodPreset[],
  limit: number,
): ManualFoodPreset[] {
  const seen = new Set<string>();
  const out: ManualFoodPreset[] = [];
  for (const p of [...preferred, ...extra]) {
    const sig = presetSignature(p);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

async function migrateLocalIfNeeded(): Promise<void> {
  if (migratedLocal) return;
  migratedLocal = true;
  const local = readLocalRaw();
  if (local.length === 0) return;
  for (const p of local) {
    try {
      await saveManualPresetRemote({
        name: p.name,
        grams: p.grams,
        protein: p.protein,
        calories: p.calories,
      });
    } catch {
      /* keep going; leave local until a full successful pass */
    }
  }
  clearLocalStorage();
}

/** Load (and cache) presets from the backend; migrates legacy localStorage once. */
export async function ensureManualPresetsLoaded(): Promise<ManualFoodPreset[]> {
  if (cache !== null) return cache;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        await migrateLocalIfNeeded();
        const remote = await fetchManualPresets(MAX_PRESETS);
        cache = sortNewest(remote);
      } catch {
        cache = [];
      }
    })().finally(() => {
      hydratePromise = null;
    });
  }
  await hydratePromise;
  return cache ?? [];
}

export async function refreshManualPresetsCache(): Promise<ManualFoodPreset[]> {
  const remote = await fetchManualPresets(MAX_PRESETS);
  cache = sortNewest(remote);
  return cache;
}

/** Sync view of cache (may be empty before hydrate). Prefer ensureManualPresetsLoaded. */
export function listAllManualPresets(limit: number): ManualFoodPreset[] {
  return sortNewest(cache ?? []).slice(0, Math.max(0, limit));
}

export function matchManualPresets(q: string, limit: number, requiredWords: string[] = []): ManualFoodPreset[] {
  return matchManualPresetsFromList(cache ?? [], q, limit, requiredWords);
}

export type SavePresetResult =
  | { ok: true; updated: boolean; preset: ManualFoodPreset }
  | { ok: false; reason: 'invalid' | 'network' };

/**
 * Saves or updates a preset with the same macro signature on the server.
 */
export async function saveManualPreset(data: {
  name: string;
  grams: number;
  protein: number;
  calories: number;
}): Promise<SavePresetResult> {
  const name = data.name.trim();
  if (!name) return { ok: false, reason: 'invalid' };
  try {
    const saved = await saveManualPresetRemote({
      name,
      grams: data.grams,
      protein: data.protein,
      calories: data.calories,
    });
    await refreshManualPresetsCache();
    return { ok: true, updated: Boolean(saved.updated), preset: saved };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/** Removes a preset by id on the server. Returns whether an entry was removed. */
export async function deleteManualPreset(id: string): Promise<boolean> {
  try {
    const ok = await deleteManualPresetRemote(id);
    if (ok) {
      if (cache !== null) {
        cache = cache.filter((p) => p.id !== id);
      } else {
        await refreshManualPresetsCache();
      }
    }
    return ok;
  } catch {
    return false;
  }
}
