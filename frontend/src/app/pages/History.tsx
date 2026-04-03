import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Calendar, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  addCalendarDaysIso,
  dateFromIsoMiddayUtc,
  formatLocaleDateMedium,
  getOfflineLogs,
  getOfflineDayLog,
  getTodayDate,
} from '../utils/foodData';
import { fetchEntryRollups, type RollupDay } from '../utils/api';

const HISTORY_WINDOW_DAYS = 365;

type HistoryRow = {
  date: string;
  totalCalories: number;
  totalProtein: number;
  meals: number;
};

function calendarDaysBetweenEarlierAndLater(earlierIso: string, laterIso: string): number {
  const a = dateFromIsoMiddayUtc(earlierIso).getTime();
  const b = dateFromIsoMiddayUtc(laterIso).getTime();
  return Math.round((b - a) / 86_400_000);
}

function relativeDayBadge(iso: string): string {
  const today = getTodayDate();
  const daysAgo = calendarDaysBetweenEarlierAndLater(iso, today);
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo >= 2 && daysAgo < 7) return `${daysAgo} days ago`;
  return '';
}

function buildHistoryRows(
  rollups: RollupDay[],
  offlineByDate: ReturnType<typeof getOfflineLogs>,
  start: string,
  end: string,
): HistoryRow[] {
  const rollupMap = new Map(rollups.map((r) => [r.date, r]));
  const dateSet = new Set<string>();
  for (const r of rollups) {
    if (r.date >= start && r.date <= end) dateSet.add(r.date);
  }
  for (const d of Object.keys(offlineByDate)) {
    if (d >= start && d <= end) dateSet.add(d);
  }

  const rows: HistoryRow[] = [];
  for (const date of dateSet) {
    const r = rollupMap.get(date);
    const off = getOfflineDayLog(date);
    const totalCalories = Math.round((r?.total_calories ?? 0) + off.totalCalories);
    const totalProtein = Math.round((r?.total_protein_g ?? 0) + off.totalProtein);
    const meals = (r?.meals ?? 0) + off.entries.length;
    if (meals > 0) {
      rows.push({ date, totalCalories, totalProtein, meals });
    }
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return rows;
}

export default function History() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { start, end } = useMemo(() => {
    const e = getTodayDate();
    const s = addCalendarDaysIso(e, -(HISTORY_WINDOW_DAYS - 1));
    return { start: s, end: e };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const offlineByDate = getOfflineLogs();
      try {
        const { days: rollups } = await fetchEntryRollups(start, end);
        if (!cancelled) {
          setRows(buildHistoryRows(rollups, offlineByDate, start, end));
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(buildHistoryRows([], offlineByDate, start, end));
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [start, end]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="size-5" />
          </Button>

          <div className="flex-1">
            <h1 className="text-2xl font-bold">History</h1>
            <p className="text-sm text-muted-foreground">View all your logged days</p>
          </div>
        </div>

        {loadError && (
          <p className="text-sm text-amber-700 mb-4 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
            Could not load history from the server ({loadError}). Showing offline-only days if any.
          </p>
        )}

        <div className="space-y-3">
          {rows.length === 0 ? (
            <Card className="bg-white/60 backdrop-blur">
              <CardContent className="p-12 text-center">
                <Calendar className="size-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No days logged yet.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Start tracking your meals to see your history!
                </p>
              </CardContent>
            </Card>
          ) : (
            rows.map((log) => {
              const badge = relativeDayBadge(log.date);
              return (
                <Card
                  key={log.date}
                  className="bg-white/80 backdrop-blur cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5"
                  onClick={() => navigate(`/day/${log.date}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold">{formatLocaleDateMedium(log.date)}</h3>
                          {badge ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              {badge}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {log.meals} meal{log.meals !== 1 ? 's' : ''} logged
                        </p>

                        <div className="flex gap-6 mt-3">
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">Calories</span>
                            <span className="text-lg font-semibold text-orange-600">{log.totalCalories}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">Protein</span>
                            <span className="text-lg font-semibold text-blue-600">{log.totalProtein}g</span>
                          </div>
                        </div>
                      </div>

                      <ChevronRight className="size-5 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
