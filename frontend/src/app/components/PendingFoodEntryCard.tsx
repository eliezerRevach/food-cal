import { Loader2 } from 'lucide-react';
import { Card } from './ui/card';
import { APP_TIME_ZONE } from '../utils/foodData';

const PREVIEW_MAX = 80;

export interface PendingFoodEntryCardProps {
  mode: 'chat' | 'manual';
  preview?: string;
}

export function PendingFoodEntryCard({ mode, preview }: PendingFoodEntryCardProps) {
  const status = mode === 'chat' ? 'Analyzing meal…' : 'Saving entry…';
  const time = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  });
  const line =
    preview && preview.length > PREVIEW_MAX ? `${preview.slice(0, PREVIEW_MAX)}…` : preview;

  return (
    <Card className="p-4 border-dashed border-2 border-muted-foreground/25 bg-muted/30">
      <div className="flex items-start gap-3">
        <div className="mt-1 p-2 bg-green-100 rounded-lg" aria-hidden>
          <Loader2 className="size-5 text-green-700 animate-spin" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-muted-foreground">{status}</h3>
          <p className="text-sm text-muted-foreground">{time}</p>
          {line ? (
            <p className="text-sm mt-1 truncate text-foreground/80" title={preview}>
              {line}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-4 mt-2">
            {(['Calories', 'Protein', 'Grams'] as const).map((label) => (
              <div key={label} className="flex flex-col min-w-[4.5rem]">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span
                  className="mt-1 h-5 rounded bg-muted-foreground/15 animate-pulse"
                  aria-hidden
                />
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 w-9 h-9" aria-hidden />
      </div>
    </Card>
  );
}
