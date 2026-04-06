import { useState, useEffect, useMemo, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Calendar, ChevronRight, Flame, Dumbbell, Download, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import {
  addCalendarDaysIso, dateFromIsoMiddayUtc, formatLocaleDateMedium,
  getOfflineLogs, getOfflineDayLog, getTodayDate,
  replaceOfflineLogs, type DayLog,
} from '../utils/foodData';
import {
  fetchBackupExport, fetchEntryRollups, postBackupImport,
  type BackupImportMode, type RollupDay,
} from '../utils/api';

const HISTORY_WINDOW_DAYS = 365;
type HistoryRow = { date: string; totalCalories: number; totalProtein: number; meals: number };

function calendarDaysBetween(earlierIso: string, laterIso: string): number {
  return Math.round((dateFromIsoMiddayUtc(laterIso).getTime() - dateFromIsoMiddayUtc(earlierIso).getTime()) / 86_400_000);
}

function relativeBadge(iso: string): { label: string; cls: string } | null {
  const daysAgo = calendarDaysBetween(iso, getTodayDate());
  if (daysAgo === 0) return { label: 'Today', cls: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' };
  if (daysAgo === 1) return { label: 'Yesterday', cls: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' };
  if (daysAgo < 7) return { label: `${daysAgo}d ago`, cls: 'bg-white/5 text-slate-500 border border-white/10' };
  return null;
}

function buildHistoryRows(
  rollups: RollupDay[], offlineByDate: ReturnType<typeof getOfflineLogs>,
  start: string, end: string,
): HistoryRow[] {
  const rollupMap = new Map(rollups.map((r) => [r.date, r]));
  const dateSet = new Set<string>();
  for (const r of rollups) { if (r.date >= start && r.date <= end) dateSet.add(r.date); }
  for (const d of Object.keys(offlineByDate)) { if (d >= start && d <= end) dateSet.add(d); }
  const rows: HistoryRow[] = [];
  for (const date of dateSet) {
    const r = rollupMap.get(date);
    const off = getOfflineDayLog(date);
    const meals = (r?.meals ?? 0) + off.entries.length;
    if (meals > 0) rows.push({
      date,
      totalCalories: Math.round((r?.total_calories ?? 0) + off.totalCalories),
      totalProtein: Math.round((r?.total_protein_g ?? 0) + off.totalProtein),
      meals,
    });
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

function isBackupShape(x: unknown): x is { format: string; version: number; entries: unknown[] } {
  if (x === null || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.format === 'foodcal-backup' && o.version === 1 && Array.isArray(o.entries);
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function History() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const importModeRef = useRef<BackupImportMode>('append');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { start, end } = useMemo(() => {
    const e = getTodayDate();
    return { start: addCalendarDaysIso(e, -(HISTORY_WINDOW_DAYS - 1)), end: e };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const offlineByDate = getOfflineLogs();
      try {
        const { days: rollups } = await fetchEntryRollups(start, end);
        if (!cancelled) { setRows(buildHistoryRows(rollups, offlineByDate, start, end)); setLoadError(null); }
      } catch (e) {
        if (!cancelled) { setRows(buildHistoryRows([], offlineByDate, start, end)); setLoadError(e instanceof Error ? e.message : String(e)); }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [start, end, refreshTick]);

  function openImportPicker(mode: BackupImportMode) {
    importModeRef.current = mode;
    fileInputRef.current?.click();
  }

  async function handleExportBackup() {
    try {
      const server = await fetchBackupExport();
      downloadJson(`foodcal-backup-${getTodayDate()}.json`, {
        ...server, offline: getOfflineLogs(), client_merged_at: new Date().toISOString(),
      });
      toast.success('Backup downloaded.');
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  async function onBackupFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const mode = importModeRef.current;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isBackupShape(parsed)) {
        toast.error('Not a valid foodcal backup (expected format foodcal-backup, version 1).');
        return;
      }
      const record = parsed as Record<string, unknown>;
      if (mode === 'replace') {
        if (!window.confirm('Replace mode deletes every meal stored on the server, then imports this file. This cannot be undone. Continue?')) return;
      }
      let applyOffline = false;
      if (record.offline !== undefined && record.offline !== null) {
        applyOffline = window.confirm('This file includes offline-only meals from another session or browser. Replace the offline-only data stored in this browser?');
      }
      await postBackupImport({
        format: 'foodcal-backup', version: 1,
        entries: record.entries as unknown[], mode,
        exported_at: typeof record.exported_at === 'string' ? record.exported_at : null,
      });
      if (applyOffline && record.offline !== null && typeof record.offline === 'object') {
        replaceOfflineLogs(record.offline as Record<string, DayLog>);
      }
      toast.success(mode === 'append' ? 'Import complete.' : 'Import complete. Server history was replaced.');
      setRefreshTick((n) => n + 1);
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)); }
  }

  return (
    <div className="min-h-screen bg-[#0d0d14] p-4 md:p-8">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-0 w-80 h-80 rounded-full bg-violet-600/8 blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-64 h-64 rounded-full bg-blue-600/8 blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="rounded-xl shrink-0 text-slate-400 hover:text-white hover:bg-white/10" onClick={() => navigate('/')}>
                <ArrowLeft className="size-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-white">History</h1>
                <p className="text-sm text-slate-500">All your logged days</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center sm:justify-end pl-12 sm:pl-0">
              <Button variant="ghost" size="sm"
                className="gap-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl border border-white/10"
                onClick={() => void handleExportBackup()}>
                <Download className="size-3.5" /> Export
              </Button>
              <Button variant="ghost" size="sm"
                className="gap-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl border border-white/10"
                onClick={() => openImportPicker('append')}>
                <Upload className="size-3.5" /> Import
              </Button>
              <Button variant="ghost" size="sm"
                className="gap-1.5 text-red-500/70 hover:text-red-400 hover:bg-red-500/10 rounded-xl border border-red-500/20"
                onClick={() => openImportPicker('replace')}>
                <Upload className="size-3.5" /> Replace
              </Button>
              <input ref={fileInputRef} type="file" accept="application/json,.json" className="sr-only" aria-hidden onChange={onBackupFileSelected} />
            </div>
          </div>
        </motion.div>

        {loadError && (
          <p className="text-sm text-amber-400 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            Could not load history ({loadError}). Showing offline-only days.
          </p>
        )}

        <div className="space-y-2.5">
          {rows.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.1 }}
              className="bg-white/5 rounded-2xl border border-white/8 p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Calendar className="size-6 text-slate-600" />
              </div>
              <p className="font-semibold text-slate-500">No days logged yet</p>
              <p className="text-sm text-slate-600 mt-1">Start tracking to see your history</p>
            </motion.div>
          ) : (
            rows.map((log, i) => {
              const badge = relativeBadge(log.date);
              return (
                <motion.button
                  key={log.date}
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28, delay: i * 0.04 }}
                  whileHover={{ scale: 1.015, y: -2 }} whileTap={{ scale: 0.98 }}
                  className="w-full bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden text-left hover:bg-white/8 transition-colors"
                  onClick={() => navigate(`/day/${log.date}`)}
                >
                  <div className="h-0.5 w-full bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500" />
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-white text-sm">{formatLocaleDateMedium(log.date)}</span>
                        {badge && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mb-3">{log.meals} meal{log.meals !== 1 ? 's' : ''}</p>
                      <div className="flex gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/15 text-orange-400 text-xs font-bold border border-orange-500/20">
                          <Flame className="size-3" /> {log.totalCalories} kcal
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-bold border border-blue-500/20">
                          <Dumbbell className="size-3" /> {log.totalProtein}g
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-slate-600 shrink-0 mt-1" />
                  </div>
                </motion.button>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
