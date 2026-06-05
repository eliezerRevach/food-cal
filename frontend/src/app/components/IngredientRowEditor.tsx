import { useState, useRef, useEffect, useMemo, type FocusEvent } from 'react';
import { ChevronDown, Link2, MessageSquare, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { cn } from './ui/utils';
import { fetchFoodSuggestions, parseIngredient } from '../utils/api';
import { getPresetSuggestionMode, replaceActiveToken } from '../utils/foodNameQuery';
import {
  deleteManualPreset,
  listAllManualPresets,
  matchManualPresets,
  MAX_PRESETS,
  type ManualFoodPreset,
} from '../utils/manualPresets';
import {
  evaluateManualNumber,
  expandGramsStarPrefix,
  parseSubmittableNumber,
  scaleLinkedMacros,
} from '../utils/manualNumericInput';

export type IngredientRowState = {
  id: string;
  label: string;
  grams: string;
  calories: string;
  protein: string;
};

export function emptyIngredientRow(): IngredientRowState {
  return {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    label: '',
    grams: '',
    calories: '',
    protein: '',
  };
}

export function rowToIngredient(row: IngredientRowState): {
  label: string;
  grams: number;
  calories: number;
  protein: number;
} | null {
  const label = row.label.trim();
  const grams = parseSubmittableNumber(row.grams);
  const calories = parseSubmittableNumber(row.calories);
  const protein = parseSubmittableNumber(row.protein);
  if (!label || grams === null || grams <= 0 || calories === null || protein === null) {
    return null;
  }
  if (calories < 0 || protein < 0) return null;
  return { label, grams, calories, protein };
}

function rowHasValidNumbers(row: IngredientRowState): boolean {
  if (!row.label.trim() || !row.grams || !row.protein || !row.calories) return false;
  return (
    parseSubmittableNumber(row.grams) !== null &&
    parseSubmittableNumber(row.protein) !== null &&
    parseSubmittableNumber(row.calories) !== null
  );
}

type SuggestionRow =
  | { type: 'preset'; preset: ManualFoodPreset }
  | { type: 'usda'; name: string };

interface IngredientRowEditorProps {
  index: number;
  row: IngredientRowState;
  onChange: (row: IngredientRowState) => void;
  onRemove?: () => void;
  canRemove: boolean;
  llmFallback: boolean;
}

export function IngredientRowEditor({
  index,
  row,
  onChange,
  onRemove,
  canRemove,
  llmFallback,
}: IngredientRowEditorProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [presetSuggestions, setPresetSuggestions] = useState<ManualFoodPreset[]>([]);
  const [usdaSuggestions, setUsdaSuggestions] = useState<string[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [portionLinkEnabled, setPortionLinkEnabled] = useState(false);
  const linkedAnchorGramsRef = useRef<number | null>(null);
  const linkedBaselineCaloriesRef = useRef<number | null>(null);
  const linkedBaselineProteinRef = useRef<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isValid = rowHasValidNumbers(row);

  const clearLinkedPortionRefs = () => {
    linkedAnchorGramsRef.current = null;
    linkedBaselineCaloriesRef.current = null;
    linkedBaselineProteinRef.current = null;
  };

  const setLinkedRefsFromRow = (r: IngredientRowState) => {
    const g = parseSubmittableNumber(r.grams);
    const c = parseSubmittableNumber(r.calories);
    const p = parseSubmittableNumber(r.protein);
    if (g !== null && g > 0 && c !== null && p !== null) {
      linkedAnchorGramsRef.current = g;
      linkedBaselineCaloriesRef.current = c;
      linkedBaselineProteinRef.current = p;
    }
  };

  const suggestionRows = useMemo((): SuggestionRow[] => {
    const presetRows: SuggestionRow[] = presetSuggestions.map((p) => ({ type: 'preset', preset: p }));
    const usdaRows: SuggestionRow[] = usdaSuggestions.map((name) => ({ type: 'usda', name }));
    return [...presetRows, ...usdaRows];
  }, [presetSuggestions, usdaSuggestions]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!suggestionsOpen) {
      setPresetSuggestions([]);
      setUsdaSuggestions([]);
      setSelectedIndex(-1);
      return;
    }
    const mode = getPresetSuggestionMode(row.label);
    if (mode.kind === 'browse') {
      setPresetSuggestions(listAllManualPresets(MAX_PRESETS));
      setUsdaSuggestions([]);
      setSelectedIndex(-1);
      return;
    }
    const q = mode.q;
    setPresetSuggestions(matchManualPresets(q, 6, mode.requiredWords));
    setSelectedIndex(-1);
    if (q.length < 2) {
      setUsdaSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void fetchFoodSuggestions(q, 8).then(({ suggestions }) => {
        setUsdaSuggestions(suggestions);
      });
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [row.label, suggestionsOpen]);

  const applySuggestionRow = (srow: SuggestionRow) => {
    if (srow.type === 'preset') {
      const p = srow.preset;
      linkedAnchorGramsRef.current = p.grams;
      linkedBaselineCaloriesRef.current = p.calories;
      linkedBaselineProteinRef.current = p.protein;
      onChange({
        ...row,
        label: p.name,
        grams: String(p.grams),
        calories: String(p.calories),
        protein: String(p.protein),
      });
    } else {
      onChange({ ...row, label: replaceActiveToken(row.label, srow.name) });
    }
    setSuggestionsOpen(false);
  };

  const handleGramsChange = (nextGrams: string) => {
    const expandedGrams = expandGramsStarPrefix(nextGrams, row.grams);
    if (!portionLinkEnabled) {
      onChange({ ...row, grams: expandedGrams });
      return;
    }
    if (expandedGrams.trim() === '') {
      onChange({ ...row, grams: expandedGrams });
      return;
    }
    const nextEval = evaluateManualNumber(expandedGrams);
    if (nextEval.kind !== 'ok' || nextEval.value <= 0) {
      onChange({ ...row, grams: expandedGrams });
      return;
    }
    const anchor = linkedAnchorGramsRef.current;
    const baseC = linkedBaselineCaloriesRef.current;
    const baseP = linkedBaselineProteinRef.current;
    if (
      anchor !== null &&
      anchor > 0 &&
      Number.isFinite(anchor) &&
      baseC !== null &&
      baseP !== null &&
      Number.isFinite(baseC) &&
      Number.isFinite(baseP)
    ) {
      const scaled = scaleLinkedMacros(anchor, baseC, baseP, nextEval.value);
      onChange({
        ...row,
        grams: expandedGrams,
        calories: String(scaled.calories),
        protein: String(scaled.protein),
      });
      return;
    }
    const prevC = evaluateManualNumber(row.calories);
    const prevP = evaluateManualNumber(row.protein);
    if (prevC.kind !== 'ok' || prevP.kind !== 'ok') {
      onChange({ ...row, grams: expandedGrams });
      return;
    }
    let denom: number | null =
      anchor !== null && anchor > 0 && Number.isFinite(anchor) ? anchor : null;
    if (denom === null) {
      const prevG = evaluateManualNumber(row.grams);
      if (prevG.kind !== 'ok' || prevG.value <= 0) {
        onChange({ ...row, grams: expandedGrams });
        return;
      }
      denom = prevG.value;
    }
    const ratio = nextEval.value / denom;
    onChange({
      ...row,
      grams: expandedGrams,
      calories: String(Math.round(prevC.value * ratio)),
      protein: String(Math.round(prevP.value * ratio * 10) / 10),
    });
  };

  const handleGramsBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (!portionLinkEnabled) return;
    const g = parseSubmittableNumber(e.currentTarget.value);
    const c = parseSubmittableNumber(row.calories);
    const p = parseSubmittableNumber(row.protein);
    if (g !== null && g > 0 && c !== null && p !== null) {
      linkedAnchorGramsRef.current = g;
      linkedBaselineCaloriesRef.current = c;
      linkedBaselineProteinRef.current = p;
    }
  };

  const handleParseChat = async () => {
    const t = chatText.trim();
    if (!t || chatSending) return;
    setChatSending(true);
    try {
      const parsed = await parseIngredient(t, llmFallback);
      linkedAnchorGramsRef.current = parsed.grams;
      linkedBaselineCaloriesRef.current = parsed.calories;
      linkedBaselineProteinRef.current = parsed.protein;
      onChange({
        ...row,
        label: parsed.name,
        grams: String(parsed.grams),
        calories: String(parsed.calories),
        protein: String(parsed.protein),
      });
      setChatText('');
      setChatOpen(false);
      toast.success('Ingredient filled from parse.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not parse ingredient');
    } finally {
      setChatSending(false);
    }
  };

  const showDropdown = suggestionsOpen && suggestionRows.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">Ingredient {index + 1}</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => setChatOpen((o) => !o)}
          >
            <MessageSquare className="size-3.5" />
            {chatOpen ? 'Hide chat' : 'Parse with chat'}
          </Button>
          {canRemove && onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              aria-label="Remove ingredient"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {chatOpen && (
        <div className="flex gap-2 rounded-md border border-purple-200 bg-purple-50/50 p-2 dark:border-purple-900/50 dark:bg-purple-950/30">
          <Input
            placeholder="e.g. 200g chicken breast"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleParseChat();
            }}
            className="h-9 flex-1"
            disabled={chatSending}
          />
          <Button
            type="button"
            size="icon"
            className="size-9 shrink-0"
            disabled={chatSending || !chatText.trim()}
            onClick={() => void handleParseChat()}
          >
            <Send className="size-4" />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="mb-1 block text-xs">Name</Label>
          <div className="relative flex gap-1">
            {showDropdown && (
              <ul
                className="absolute z-50 bottom-full left-0 right-0 mb-1 max-h-48 overflow-auto rounded-md border border-border bg-popover shadow-md"
                role="listbox"
              >
                {suggestionRows.map((srow, idx) =>
                  srow.type === 'preset' ? (
                    <li key={`p-${srow.preset.id}`} className="flex">
                      <button
                        type="button"
                        className={cn(
                          'min-w-0 flex-1 px-2 py-1.5 text-left text-sm hover:bg-accent',
                          selectedIndex === idx && 'bg-accent',
                        )}
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => applySuggestionRow(srow)}
                      >
                        <div className="font-medium">{srow.preset.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {srow.preset.calories} kcal · {srow.preset.grams}g
                        </div>
                      </button>
                      <button
                        type="button"
                        className="px-2 text-muted-foreground hover:text-destructive"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => deleteManualPreset(srow.preset.id)}
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ) : (
                    <li key={`u-${srow.name}`}>
                      <button
                        type="button"
                        className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent"
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => applySuggestionRow(srow)}
                      >
                        {srow.name}
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
            <Input
              value={row.label}
              onChange={(e) => onChange({ ...row, label: e.target.value })}
              placeholder="pasta"
              className="h-9"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
              onClick={() => setSuggestionsOpen((o) => !o)}
              aria-label="Suggestions"
            >
              <ChevronDown className="size-4" />
            </Button>
          </div>
        </div>
        <div>
          <Label className="mb-1 block text-xs">Grams</Label>
          <Input
            value={row.grams}
            onChange={(e) => handleGramsChange(e.target.value)}
            onBlur={handleGramsBlur}
            inputMode="decimal"
            placeholder="300"
            className="h-9"
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Calories (kcal)</Label>
          <Input
            value={row.calories}
            onChange={(e) => onChange({ ...row, calories: e.target.value })}
            inputMode="decimal"
            placeholder="393"
            className="h-9"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="mb-1 block text-xs">Protein (g)</Label>
          <Input
            value={row.protein}
            onChange={(e) => onChange({ ...row, protein: e.target.value })}
            inputMode="decimal"
            placeholder="15"
            className="h-9"
          />
        </div>
      </div>

      <div
        className={cn(
          'rounded-lg border border-teal-200/70 bg-background/85 px-2.5 py-2 dark:border-teal-800/50',
          portionLinkEnabled &&
            'border-amber-200/80 bg-gradient-to-br from-teal-500/[0.07] via-background/90 to-amber-500/[0.09] dark:border-amber-900/40',
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-lg border',
                portionLinkEnabled
                  ? 'border-teal-400/60 bg-teal-500/15 text-teal-700 dark:text-teal-300'
                  : 'border-border bg-muted/50 text-muted-foreground',
              )}
              aria-hidden
            >
              <Link2 className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium leading-tight">Portion link</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {portionLinkEnabled
                  ? 'Grams rescales kcal and protein.'
                  : 'Fill fields, then link to scale from weight.'}
              </p>
            </div>
          </div>
          <div
            className="flex shrink-0 rounded-full border border-border/80 bg-muted/30 p-0.5"
            role="group"
            aria-label="Portion scaling mode"
          >
            <button
              type="button"
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-all',
                !portionLinkEnabled
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={!portionLinkEnabled}
              onClick={() => {
                setPortionLinkEnabled(false);
                clearLinkedPortionRefs();
              }}
            >
              Independent
            </button>
            <button
              type="button"
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-all',
                portionLinkEnabled
                  ? 'bg-gradient-to-r from-teal-600 to-amber-600 text-white shadow-sm dark:from-teal-500 dark:to-amber-600'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={portionLinkEnabled}
              disabled={!isValid && !portionLinkEnabled}
              onClick={() => {
                if (!isValid) return;
                setLinkedRefsFromRow(row);
                setPortionLinkEnabled(true);
              }}
            >
              Linked
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
