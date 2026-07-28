/** Call FastAPI backend (hybrid DB + LLM). */

const LLM_FALLBACK_STORAGE_KEY = 'foodcal-llm-fallback';
const HISTORY_AUTOCORRECT_STORAGE_KEY = 'foodcal-history-autocorrect';

export function readLlmFallbackPreference(): boolean {
  try {
    const v = localStorage.getItem(LLM_FALLBACK_STORAGE_KEY);
    if (v === null) return true;
    return v === '1' || v === 'true';
  } catch {
    return true;
  }
}

export function writeLlmFallbackPreference(enabled: boolean): void {
  try {
    localStorage.setItem(LLM_FALLBACK_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Default off — matches prior autocomplete (saved presets only, no history meals). */
export function readHistoryAutocorrectPreference(): boolean {
  try {
    const v = localStorage.getItem(HISTORY_AUTOCORRECT_STORAGE_KEY);
    if (v === null) return false;
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

export function writeHistoryAutocorrectPreference(enabled: boolean): void {
  try {
    localStorage.setItem(HISTORY_AUTOCORRECT_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type LogMealItem = {
  label: string;
  grams?: number;
  calories?: number;
};

export type LogMealResponse = {
  total_calories: number;
  total_protein_g?: number;
  items: LogMealItem[];
  estimate_type?: string;
  calories_likely?: number;
  calories_low?: number;
  calories_high?: number;
};

export function getApiBaseUrl(): string {
  const v = import.meta.env.VITE_API_BASE_URL;
  if (typeof v === 'string' && v.length > 0) {
    return v.replace(/\/$/, '');
  }
  // Relative URLs: Vite dev proxies to FastAPI (vite.config.ts). On static hosts without
  // VITE_API_BASE_URL, calls fail gracefully and the UI falls back to offline data.
  return '';
}

function formatApiError(status: number, body: string): string {
  try {
    const j = JSON.parse(body) as { detail?: string | Array<{ msg?: string }> };
    if (typeof j.detail === 'string') return j.detail;
    if (Array.isArray(j.detail) && j.detail[0]?.msg) return String(j.detail[0].msg);
  } catch {
    /* not JSON */
  }
  if (body.length > 0 && body.length < 400) return body;
  return `${status} ${status === 503 ? 'Service unavailable' : 'Request failed'}`;
}

export async function logMealToBackend(
  text: string,
  date: string,
  llmFallback = true,
): Promise<LogMealResponse> {
  const base = getApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/log-meal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), date, llm_fallback: llmFallback }),
    });
  } catch (e) {
    const msg =
      e instanceof TypeError
        ? `Cannot reach API at ${base}. Start from the project folder: python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8002`
        : String(e);
    throw new Error(msg);
  }
  if (!res.ok) {
    const errText = await res.text();
    // #region agent log
    fetch('http://127.0.0.1:7473/ingest/4471e92a-deb6-43c4-9671-85467c465a8c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fcca48'},body:JSON.stringify({sessionId:'fcca48',location:'api.ts:logMealToBackend',message:'log-meal non-OK',data:{status:res.status,bodyPreview:errText.slice(0,400)},timestamp:Date.now(),hypothesisId:'H3',runId:'pre'})}).catch(()=>{});
    // #endregion
    throw new ApiError(formatApiError(res.status, errText), res.status);
  }
  return res.json() as Promise<LogMealResponse>;
}

// ---------------------------------------------------------------------------
// Async meal log jobs
// ---------------------------------------------------------------------------

export type MealJobStatus = 'queued' | 'processing' | 'done' | 'failed';

export type MealJob = {
  job_id: number;
  status: MealJobStatus;
  date_iso: string;
  raw_text: string;
  entry_id: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export async function enqueueLogMealJob(
  text: string,
  date: string,
  llmFallback = true,
): Promise<MealJob> {
  const base = getApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/log-meal/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), date, llm_fallback: llmFallback }),
    });
  } catch (e) {
    const msg =
      e instanceof TypeError
        ? `Cannot reach API at ${base}. Start from the project folder: python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8002`
        : String(e);
    throw new Error(msg);
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new ApiError(formatApiError(res.status, errText), res.status);
  }
  return res.json() as Promise<MealJob>;
}

export async function getMealJobStatus(jobId: number): Promise<MealJob> {
  const base = getApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/log-meal/jobs/${jobId}`);
  } catch (e) {
    const msg =
      e instanceof TypeError ? `Cannot reach API at ${base}.` : String(e);
    throw new Error(msg);
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(formatApiError(res.status, errText));
  }
  return res.json() as Promise<MealJob>;
}

export async function listActiveMealJobs(date: string): Promise<MealJob[]> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/log-meal/jobs?date=${encodeURIComponent(date)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { jobs: MealJob[] };
    return Array.isArray(data.jobs) ? data.jobs : [];
  } catch {
    return [];
  }
}

export type ManualMealPayload = {
  name: string;
  grams: number;
  calories: number;
  protein: number;
};

export async function logManualMealToBackend(
  date: string,
  payload: ManualMealPayload,
): Promise<LogMealResponse> {
  const base = getApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/log-meal-manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        name: payload.name.trim(),
        grams: payload.grams,
        calories: payload.calories,
        protein: payload.protein,
      }),
    });
  } catch (e) {
    const msg =
      e instanceof TypeError
        ? `Cannot reach API at ${base}. Start from the project folder: python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8002`
        : String(e);
    throw new Error(msg);
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new ApiError(formatApiError(res.status, errText), res.status);
  }
  return res.json() as Promise<LogMealResponse>;
}

export type ApiEntryRow = {
  id: number;
  name: string;
  calories: number;
  protein: number;
  timestamp: number;
  /** Sum of non-null line-item grams; omitted or null if every item has no grams. */
  grams_total?: number | null;
  /** True when some items have grams and some do not (total is incomplete). */
  grams_partial?: boolean;
};

export type EntriesResponse = {
  entries: ApiEntryRow[];
};

export async function fetchEntriesForDate(date: string): Promise<EntriesResponse> {
  const base = getApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/entries?date=${encodeURIComponent(date)}`);
  } catch (e) {
    const msg =
      e instanceof TypeError
        ? `Cannot reach API at ${base}. Start the backend (e.g. uvicorn app.main:app).`
        : String(e);
    throw new Error(msg);
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(formatApiError(res.status, errText));
  }
  return res.json() as Promise<EntriesResponse>;
}

export async function deleteEntryRemote(entryId: number): Promise<void> {
  const base = getApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/entries/${entryId}`, { method: 'DELETE' });
  } catch (e) {
    const msg =
      e instanceof TypeError
        ? `Cannot reach API at ${base}.`
        : String(e);
    throw new Error(msg);
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(formatApiError(res.status, errText));
  }
}

export type RollupDay = {
  date: string;
  total_calories: number;
  meals: number;
  total_protein_g?: number;
};

export type EntryRollupsResponse = {
  days: RollupDay[];
};

export async function fetchEntryRollups(start: string, end: string): Promise<EntryRollupsResponse> {
  const base = getApiBaseUrl();
  const q = `start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  let res: Response;
  try {
    res = await fetch(`${base}/entries-rollups?${q}`);
  } catch (e) {
    const msg =
      e instanceof TypeError
        ? `Cannot reach API at ${base}.`
        : String(e);
    throw new Error(msg);
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(formatApiError(res.status, errText));
  }
  return res.json() as Promise<EntryRollupsResponse>;
}

export type FoodSuggestResponse = {
  suggestions: string[];
  usda_enabled: boolean;
};

export type FoodSuggestResult = {
  suggestions: string[];
  usdaEnabled: boolean;
};

/** USDA FDC search suggestions for meal input; returns [] on error (no throw). */
export async function fetchFoodSuggestions(q: string, limit = 12): Promise<FoodSuggestResult> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams({ q, limit: String(limit) });
  try {
    const res = await fetch(`${base}/food-suggest?${params}`);
    if (!res.ok) {
      return { suggestions: [], usdaEnabled: true };
    }
    const data = (await res.json()) as FoodSuggestResponse;
    return {
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
      usdaEnabled: Boolean(data.usda_enabled),
    };
  } catch {
    return { suggestions: [], usdaEnabled: true };
  }
}

export type ManualPresetApiRow = {
  id: string;
  name: string;
  grams: number;
  protein: number;
  calories: number;
  savedAt: number;
  updated?: boolean;
};

function normalizePresetRow(raw: unknown): ManualPresetApiRow | null {
  if (raw === null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.id !== 'string' ||
    typeof o.name !== 'string' ||
    typeof o.grams !== 'number' ||
    typeof o.protein !== 'number' ||
    typeof o.calories !== 'number'
  ) {
    return null;
  }
  const savedAt = typeof o.savedAt === 'number' ? o.savedAt : 0;
  return {
    id: o.id,
    name: o.name,
    grams: o.grams,
    protein: o.protein,
    calories: o.calories,
    savedAt,
    ...(typeof o.updated === 'boolean' ? { updated: o.updated } : {}),
  };
}

export async function fetchManualPresets(limit = 100, q = ''): Promise<ManualPresetApiRow[]> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams({ limit: String(limit) });
  if (q.trim()) params.set('q', q.trim());
  const res = await fetch(`${base}/manual-presets?${params}`);
  if (!res.ok) {
    throw new Error(formatApiError(res.status, await res.text()));
  }
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new Error('manual-presets returned non-JSON (is the API proxy running?)');
  }
  const data = (await res.json()) as { presets?: unknown };
  if (!Array.isArray(data.presets)) return [];
  return data.presets.map(normalizePresetRow).filter((p): p is ManualPresetApiRow => p !== null);
}

export async function saveManualPresetRemote(data: {
  name: string;
  grams: number;
  protein: number;
  calories: number;
}): Promise<ManualPresetApiRow> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/manual-presets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(formatApiError(res.status, await res.text()));
  }
  const row = normalizePresetRow(await res.json());
  if (!row) throw new Error('Invalid preset response');
  return row;
}

export async function deleteManualPresetRemote(id: string): Promise<boolean> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/manual-presets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (res.status === 404) return false;
  if (!res.ok) {
    throw new Error(formatApiError(res.status, await res.text()));
  }
  return true;
}

/** History meal suggestions (View History data); returns [] on error (no throw). */
export async function fetchHistoryFoodSuggestions(
  q = '',
  limit = 25,
): Promise<ManualPresetApiRow[]> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams({ limit: String(limit) });
  if (q.trim()) params.set('q', q.trim());
  try {
    const res = await fetch(`${base}/history-food-suggest?${params}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { suggestions?: unknown };
    if (!Array.isArray(data.suggestions)) return [];
    return data.suggestions
      .map(normalizePresetRow)
      .filter((p): p is ManualPresetApiRow => p !== null);
  } catch {
    return [];
  }
}

export type BackupServerPayload = {
  format: 'foodcal-backup';
  version: 1;
  exported_at: string;
  entries: unknown[];
};

export type BackupImportMode = 'append' | 'replace';

export type BackupImportResult = {
  status: string;
  mode: string;
  inserted_entries: number;
  inserted_items: number;
  inserted_recipes?: number;
  inserted_manual_presets?: number;
};

export async function fetchBackupExport(): Promise<BackupServerPayload> {
  const base = getApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/backup/export`);
  } catch (e) {
    const msg =
      e instanceof TypeError
        ? `Cannot reach API at ${base}. Start the backend (e.g. uvicorn app.main:app).`
        : String(e);
    throw new Error(msg);
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(formatApiError(res.status, errText));
  }
  return res.json() as Promise<BackupServerPayload>;
}

export async function postBackupImport(
  payload: {
    format: 'foodcal-backup';
    version: 1;
    entries: unknown[];
    mode: BackupImportMode;
    exported_at?: string | null;
  },
): Promise<BackupImportResult> {
  const base = getApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/backup/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const msg =
      e instanceof TypeError
        ? `Cannot reach API at ${base}.`
        : String(e);
    throw new Error(msg);
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(formatApiError(res.status, errText));
  }
  return res.json() as Promise<BackupImportResult>;
}

export type RecipeIngredient = {
  label: string;
  grams: number;
  calories: number;
  protein: number;
};

export type RecipeSummary = {
  id: number;
  name: string;
  batch_grams: number;
  total_calories: number;
  total_protein_g: number;
  ingredient_count: number;
  created_at: string;
  updated_at: string;
};

export type RecipeDetail = RecipeSummary & {
  ingredients: RecipeIngredient[];
};

export type ParsedIngredient = {
  name: string;
  grams: number;
  calories: number;
  protein: number;
};

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  try {
    return await fetch(`${base}${path}`, init);
  } catch (e) {
    const msg =
      e instanceof TypeError
        ? `Cannot reach API at ${base}. Start from the project folder: python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8002`
        : String(e);
    throw new Error(msg);
  }
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const errText = await res.text();
    throw new ApiError(formatApiError(res.status, errText), res.status);
  }
  return res.json() as Promise<T>;
}

export async function fetchRecipes(): Promise<RecipeSummary[]> {
  const data = await apiJson<{ recipes: RecipeSummary[] }>('/recipes');
  return data.recipes ?? [];
}

export async function fetchRecipe(id: number): Promise<RecipeDetail> {
  return apiJson<RecipeDetail>(`/recipes/${id}`);
}

export async function createRecipe(
  name: string,
  ingredients: RecipeIngredient[],
): Promise<RecipeDetail> {
  return apiJson<RecipeDetail>('/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ingredients }),
  });
}

export async function updateRecipe(
  id: number,
  name: string,
  ingredients: RecipeIngredient[],
): Promise<RecipeDetail> {
  return apiJson<RecipeDetail>(`/recipes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ingredients }),
  });
}

export async function deleteRecipe(id: number): Promise<void> {
  await apiJson<{ status: string }>(`/recipes/${id}`, { method: 'DELETE' });
}

export async function parseIngredient(
  text: string,
  llmFallback = true,
): Promise<ParsedIngredient> {
  return apiJson<ParsedIngredient>('/parse-ingredient', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.trim(), llm_fallback: llmFallback }),
  });
}

export async function logRecipePortion(
  date: string,
  recipeId: number,
  gramsEaten: number,
): Promise<LogMealResponse> {
  return apiJson<LogMealResponse>('/log-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, recipe_id: recipeId, grams_eaten: gramsEaten }),
  });
}
