import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { fetchRecipes, logRecipePortion, type RecipeSummary } from '../utils/api';
import { parseSubmittableNumber } from '../utils/manualNumericInput';

interface RecipePortionLogProps {
  dateStr: string;
  onLogged: () => void | Promise<void>;
  /** After saving a recipe, select it in the log picker */
  preferredRecipeId?: number | null;
}

export function RecipePortionLog({ dateStr, onLogged, preferredRecipeId }: RecipePortionLogProps) {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(preferredRecipeId ?? null);
  const [gramsEaten, setGramsEaten] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quickLoggingId, setQuickLoggingId] = useState<number | null>(null);

  const loadRecipes = async () => {
    setLoading(true);
    try {
      const list = await fetchRecipes();
      setRecipes(list);
      if (preferredRecipeId && list.some((r) => r.id === preferredRecipeId)) {
        setSelectedId(preferredRecipeId);
      } else if (selectedId === null && list.length > 0) {
        setSelectedId(list[0]!.id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load recipes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecipes();
  }, []);

  useEffect(() => {
    if (preferredRecipeId != null) {
      setSelectedId(preferredRecipeId);
    }
  }, [preferredRecipeId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.name.toLowerCase().includes(q));
  }, [recipes, search]);

  const selected = recipes.find((r) => r.id === selectedId) ?? null;
  const gramsNum = parseSubmittableNumber(gramsEaten);
  const canSubmit =
    selected !== null &&
    gramsNum !== null &&
    gramsNum > 0 &&
    !submitting &&
    quickLoggingId === null;

  const logPortion = async (
    recipe: RecipeSummary,
    grams: number,
    successMessage: string,
    clearGrams: boolean,
  ) => {
    await logRecipePortion(dateStr, recipe.id, grams);
    toast.success(successMessage);
    if (clearGrams) {
      setGramsEaten('');
    }
    await onLogged();
  };

  const handleSubmit = async () => {
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    try {
      await logPortion(
        selected,
        gramsNum!,
        `Logged ${gramsNum}g of ${selected.name}`,
        true,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not log portion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogFullBatch = async (recipe: RecipeSummary) => {
    if (recipe.batch_grams <= 0 || quickLoggingId !== null) return;
    setQuickLoggingId(recipe.id);
    try {
      await logPortion(
        recipe,
        recipe.batch_grams,
        `Logged full batch of ${recipe.name} (${recipe.batch_grams}g)`,
        false,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not log portion');
    } finally {
      setQuickLoggingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-4">Loading recipes…</p>;
  }

  if (recipes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No saved recipes yet. Switch to Build and save a recipe first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="recipe-search" className="mb-1.5 block text-sm font-medium">
          Find recipe
        </Label>
        <Input
          id="recipe-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          className="h-10"
        />
      </div>

      <div className="max-h-40 overflow-auto rounded-md border border-border">
        {filtered.map((r) => (
          <div
            key={r.id}
            className={`flex items-stretch border-b border-border last:border-b-0 ${
              selectedId === r.id ? 'bg-accent' : ''
            }`}
          >
            <button
              type="button"
              className="min-w-0 flex-1 px-3 py-2.5 text-left text-sm hover:bg-accent/50"
              onClick={() => setSelectedId(r.id)}
            >
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-muted-foreground">
                Batch {r.batch_grams}g · {r.total_calories} kcal · P {r.total_protein_g}g ·{' '}
                {r.ingredient_count} ingredients
              </div>
            </button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="my-1.5 mr-1.5 h-9 w-9 shrink-0"
              disabled={r.batch_grams <= 0 || quickLoggingId !== null}
              aria-label={`Log full batch of ${r.name} (${r.batch_grams}g)`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                void handleLogFullBatch(r);
              }}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-sm text-muted-foreground text-center">No matches</p>
        )}
      </div>

      {selected && (
        <p className="text-xs text-muted-foreground text-center">
          Full batch: {selected.batch_grams}g ({selected.total_calories} kcal) — tap + on a recipe
          to log the whole batch
        </p>
      )}

      <div>
        <Label htmlFor="grams-eaten" className="mb-1.5 block text-sm font-medium">
          Grams eaten
        </Label>
        <Input
          id="grams-eaten"
          value={gramsEaten}
          onChange={(e) => setGramsEaten(e.target.value)}
          inputMode="decimal"
          placeholder={selected ? `e.g. ${Math.round(selected.batch_grams / 2)}` : '400'}
          className="h-11"
        />
      </div>

      <Button
        type="button"
        className="w-full h-11"
        disabled={!canSubmit}
        onClick={() => void handleSubmit()}
      >
        {submitting ? 'Adding…' : "Add to today's log"}
      </Button>
    </div>
  );
}
