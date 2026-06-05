import { useState } from 'react';
import { Button } from './ui/button';
import { RecipeBuilder } from './RecipeBuilder';
import { RecipePortionLog } from './RecipePortionLog';
import type { RecipeDetail } from '../utils/api';
import { cn } from './ui/utils';

type RecipeMode = 'build' | 'log';

interface RecipeTabProps {
  dateStr: string;
  llmFallback: boolean;
  onLogSuccess: () => void | Promise<void>;
}

export function RecipeTab({ dateStr, llmFallback, onLogSuccess }: RecipeTabProps) {
  const [mode, setMode] = useState<RecipeMode>('build');
  const [lastSavedId, setLastSavedId] = useState<number | null>(null);

  const handleSaved = (recipe: RecipeDetail) => {
    setLastSavedId(recipe.id);
    setMode('log');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <Button
          type="button"
          variant="ghost"
          className={cn('h-9', mode === 'build' && 'bg-background shadow-sm')}
          onClick={() => setMode('build')}
        >
          Build
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={cn('h-9', mode === 'log' && 'bg-background shadow-sm')}
          onClick={() => setMode('log')}
        >
          Log portion
        </Button>
      </div>

      {mode === 'build' ? (
        <RecipeBuilder llmFallback={llmFallback} onSaved={handleSaved} />
      ) : (
        <RecipePortionLog
          dateStr={dateStr}
          onLogged={onLogSuccess}
          preferredRecipeId={lastSavedId}
        />
      )}
    </div>
  );
}
