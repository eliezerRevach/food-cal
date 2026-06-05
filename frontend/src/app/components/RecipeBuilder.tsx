import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { createRecipe, type RecipeDetail } from '../utils/api';
import {
  emptyIngredientRow,
  IngredientRowEditor,
  rowToIngredient,
  type IngredientRowState,
} from './IngredientRowEditor';

interface RecipeBuilderProps {
  llmFallback: boolean;
  onSaved: (recipe: RecipeDetail) => void;
}

export function RecipeBuilder({ llmFallback, onSaved }: RecipeBuilderProps) {
  const [recipeName, setRecipeName] = useState('');
  const [rows, setRows] = useState<IngredientRowState[]>([emptyIngredientRow(), emptyIngredientRow()]);
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => {
    let batchGrams = 0;
    let totalCal = 0;
    let totalProt = 0;
    for (const r of rows) {
      const ing = rowToIngredient(r);
      if (!ing) continue;
      batchGrams += ing.grams;
      totalCal += ing.calories;
      totalProt += ing.protein;
    }
    return { batchGrams, totalCal, totalProt };
  }, [rows]);

  const canSave =
    recipeName.trim().length > 0 &&
    rows.every((r) => rowToIngredient(r) !== null) &&
    totals.batchGrams > 0;

  const updateRow = (id: string, next: IngredientRowState) => {
    setRows((prev) => prev.map((r) => (r.id === id ? next : r)));
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    const ingredients = rows.map((r) => rowToIngredient(r)!);
    setSaving(true);
    try {
      const recipe = await createRecipe(recipeName.trim(), ingredients);
      toast.success(`Recipe "${recipe.name}" saved.`);
      onSaved(recipe);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save recipe');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="recipe-name" className="mb-1.5 block text-sm font-medium">
          Recipe name
        </Label>
        <Input
          id="recipe-name"
          value={recipeName}
          onChange={(e) => setRecipeName(e.target.value)}
          placeholder="Pasta with tomato sauce"
          className="h-11"
        />
      </div>

      <div className="space-y-3">
        {rows.map((row, idx) => (
          <IngredientRowEditor
            key={row.id}
            index={idx}
            row={row}
            onChange={(next) => updateRow(row.id, next)}
            canRemove={rows.length > 1}
            onRemove={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
            llmFallback={llmFallback}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={() => setRows((prev) => [...prev, emptyIngredientRow()])}
      >
        <Plus className="size-4" />
        Add ingredient
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Batch: {Math.round(totals.batchGrams * 10) / 10}g ·{' '}
        {Math.round(totals.totalCal * 10) / 10} kcal · P {Math.round(totals.totalProt * 10) / 10}g
      </p>

      <Button type="button" className="w-full h-11" disabled={!canSave || saving} onClick={() => void handleSave()}>
        {saving ? 'Saving…' : 'Save recipe'}
      </Button>
    </div>
  );
}
