import { Trash2, Apple, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { FoodEntry as FoodEntryType, APP_TIME_ZONE } from '../utils/foodData';
import { saveManualPreset } from '../utils/manualPresets';

interface FoodEntryProps {
  entry: FoodEntryType;
  onDelete: (id: string) => void;
}

export function FoodEntry({ entry, onDelete }: FoodEntryProps) {
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: APP_TIME_ZONE,
  });

  const gramsKnown = entry.gramsTotal != null;
  const gramsTitle = !gramsKnown
    ? 'No gram amounts stored for this meal'
    : entry.gramsPartial ? 'Some items have no gram amount; total is incomplete' : undefined;

  const savePresetDisabledTitle = 'Weight (grams) is required to save this meal as a reusable preset';

  const handleSavePreset = () => {
    if (!gramsKnown || entry.gramsTotal == null) {
      toast.error('Weight (grams) is required to save a preset.');
      return;
    }
    const result = saveManualPreset({
      name: entry.name,
      grams: entry.gramsTotal,
      protein: entry.protein,
      calories: entry.calories,
    });
    if (!result.ok) {
      toast.error('Could not save preset.');
      return;
    }
    toast.success(result.updated ? 'Saved preset updated.' : 'Saved for reuse in this browser.');
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden hover:bg-white/8 transition-colors"
    >
      <div className="h-0.5 w-full bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500" />

      <div className="p-4 flex items-start gap-3">
        <div className="mt-0.5 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-900/30">
          <Apple className="size-4 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <h3 className="font-bold text-white leading-tight">{entry.name}</h3>
            <span className="text-xs text-slate-600 shrink-0 mt-0.5 tabular-nums">{time}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500/15 text-orange-400 text-xs font-bold border border-orange-500/20">
              🔥 {entry.calories} kcal
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-bold border border-blue-500/20">
              💪 {entry.protein}g protein
            </span>
            {gramsKnown && (
              <span title={gramsTitle}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-slate-400 text-xs font-semibold border border-white/10">
                ⚖️ {entry.gramsTotal}g
                {entry.gramsPartial && <span className="text-slate-600 font-normal" aria-hidden> *</span>}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1 -mt-0.5 -mr-1">
          <Button
            variant="ghost" size="icon"
            onClick={() => onDelete(entry.id)}
            aria-label="Delete entry"
            className="text-slate-700 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
          >
            <Trash2 className="size-4" />
          </Button>
          <Button
            type="button" variant="ghost" size="icon"
            onClick={handleSavePreset}
            disabled={!gramsKnown}
            title={!gramsKnown ? savePresetDisabledTitle : 'Save as preset'}
            aria-label={gramsKnown ? 'Save as preset' : savePresetDisabledTitle}
            className="text-slate-700 hover:text-teal-400 hover:bg-teal-500/10 rounded-xl transition-colors disabled:opacity-30"
          >
            <Save className="size-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
