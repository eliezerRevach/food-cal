import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, TrendingUp, Calendar, Flame, Dumbbell, CalendarDays } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { getTodayDate, addCalendarDaysIso, formatIsoDateShort } from '../utils/foodData';
import { fetchEntryRollups } from '../utils/api';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

type ChartDay = { date: string; fullDate: string; calories: number; protein: number; meals: number };

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring' as const, stiffness: 300, damping: 28, delay },
});

export default function Summary() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');
  const [chartData, setChartData] = useState<ChartDay[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const days = timeRange === 'week' ? 7 : 30;
      const end = getTodayDate();
      const start = addCalendarDaysIso(end, -(days - 1));
      try {
        const { days: rollups } = await fetchEntryRollups(start, end);
        const byDate = new Map(rollups.map((d) => [d.date, d]));
        const data: ChartDay[] = [];
        for (let i = days - 1; i >= 0; i--) {
          const dateString = addCalendarDaysIso(end, -i);
          const r = byDate.get(dateString);
          data.push({ date: formatIsoDateShort(dateString), fullDate: dateString, calories: r?.total_calories ?? 0, protein: r?.total_protein_g ?? 0, meals: r?.meals ?? 0 });
        }
        if (!cancelled) { setChartData(data); setLoadError(null); }
      } catch (e) {
        if (!cancelled) { setChartData([]); setLoadError(e instanceof Error ? e.message : String(e)); }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [timeRange]);

  const totalDays = chartData.filter((d) => d.meals > 0).length;
  const avgCalories = totalDays > 0 ? Math.round(chartData.reduce((s, d) => s + d.calories, 0) / totalDays) : 0;
  const avgProtein = totalDays > 0 ? Math.round(chartData.reduce((s, d) => s + d.protein, 0) / totalDays) : 0;

  const tooltipStyle = {
    backgroundColor: '#1e1b2e',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    fontSize: 12,
    color: '#e2e8f0',
  };

  return (
    <div className="min-h-screen bg-[#0d0d14] p-4 md:p-8">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/3 w-96 h-96 rounded-full bg-violet-600/8 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-orange-600/8 blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto">

        {/* Header */}
        <motion.div {...fadeUp(0)} className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="rounded-xl shrink-0 text-slate-400 hover:text-white hover:bg-white/10" onClick={() => navigate('/')}>
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">Analytics</h1>
            <p className="text-sm text-slate-500">Track your progress over time</p>
          </div>
        </motion.div>

        {loadError && (
          <p className="text-sm text-amber-400 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            Could not load summary ({loadError}).
          </p>
        )}

        {/* Time Range */}
        <motion.div {...fadeUp(0.05)} className="mb-5">
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as 'week' | 'month')}>
            <TabsList className="rounded-xl bg-white/5 border border-white/10">
              <TabsTrigger value="week" className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-500">Last 7 Days</TabsTrigger>
              <TabsTrigger value="month" className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-500">Last 30 Days</TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Stat Cards */}
        <motion.div {...fadeUp(0.1)} className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Days Logged', value: String(totalDays), suffix: '', gradient: 'from-violet-600 to-purple-400', icon: CalendarDays },
            { label: 'Avg Cal/Day', value: String(avgCalories), suffix: '', gradient: 'from-orange-500 to-amber-400', icon: Flame },
            { label: 'Avg Protein', value: String(avgProtein), suffix: 'g', gradient: 'from-blue-600 to-cyan-400', icon: Dumbbell },
          ].map(({ label, value, suffix, gradient, icon: Icon }, i) => (
            <motion.div key={label}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 350, damping: 26, delay: 0.12 + i * 0.07 }}
              className={`bg-gradient-to-br ${gradient} rounded-2xl p-4 shadow-lg`}>
              <Icon className="size-4 text-white/70 mb-2" />
              <div className="text-2xl font-black text-white leading-none">
                {value}<span className="text-sm font-semibold opacity-75">{suffix}</span>
              </div>
              <div className="text-xs text-white/60 mt-1 font-medium">{label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Calories Chart */}
        <motion.div {...fadeUp(0.22)} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <TrendingUp className="size-4 text-orange-400" />
            </div>
            <span className="font-bold text-white text-sm">Daily Calories</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={timeRange === 'month' ? 6 : 18}>
              <defs>
                <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="calories" fill="url(#calGrad)" radius={[6, 6, 0, 0]} name="Calories" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Protein Chart */}
        <motion.div {...fadeUp(0.30)} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <TrendingUp className="size-4 text-blue-400" />
            </div>
            <span className="font-bold text-white text-sm">Daily Protein</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <defs>
                <linearGradient id="protGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(255,255,255,0.05)' }} />
              <Line type="monotone" dataKey="protein" stroke="url(#protGrad)" strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#22d3ee', strokeWidth: 0 }}
                name="Protein (g)" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Recent Activity */}
        <motion.div {...fadeUp(0.38)} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
              <Calendar className="size-4 text-slate-500" />
            </div>
            <span className="font-bold text-white text-sm">Recent Activity</span>
          </div>
          <div className="space-y-1.5">
            {chartData.filter((d) => d.meals > 0).reverse().slice(0, 7).map((day, i) => (
              <motion.button
                key={day.fullDate}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.4 + i * 0.05 }}
                whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/8 rounded-xl transition-colors text-left"
                onClick={() => navigate(`/day/${day.fullDate}`)}
              >
                <div>
                  <div className="font-semibold text-white text-sm">{day.date}</div>
                  <div className="text-xs text-slate-600">{day.meals} meal{day.meals !== 1 ? 's' : ''}</div>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-orange-500/15 text-orange-400 font-bold border border-orange-500/20">{day.calories} cal</span>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 font-bold border border-blue-500/20">{day.protein}g</span>
                </div>
              </motion.button>
            ))}
            {chartData.filter((d) => d.meals > 0).length === 0 && !loadError && (
              <div className="text-center py-8 text-slate-600 text-sm">
                No activity recorded yet. Start logging your meals!
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
