import { useState, useEffect } from 'react';
import { PlusCircle, BarChart3, History, Flame, Dumbbell, Utensils, ChevronRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { getTodayDate, getOfflineDayLog, formatLocaleDateMedium } from '../utils/foodData';
import { fetchEntriesForDate } from '../utils/api';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring' as const, stiffness: 320, damping: 28, delay },
});

export default function Dashboard() {
  const navigate = useNavigate();
  const today = getTodayDate();
  const [todayLog, setTodayLog] = useState({ totalCalories: 0, totalProtein: 0, mealCount: 0 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const offline = getOfflineDayLog(today);
      try {
        const { entries } = await fetchEntriesForDate(today);
        const apiCal = entries.reduce((s, e) => s + e.calories, 0);
        const apiProt = entries.reduce((s, e) => s + e.protein, 0);
        if (!cancelled)
          setTodayLog({ totalCalories: apiCal + offline.totalCalories, totalProtein: apiProt + offline.totalProtein, mealCount: entries.length + offline.entries.length });
      } catch {
        if (!cancelled)
          setTodayLog({ totalCalories: offline.totalCalories, totalProtein: offline.totalProtein, mealCount: offline.entries.length });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [today]);

  const quickActions = [
    { title: 'Log Food Today', description: 'Add what you ate today', icon: PlusCircle, gradient: 'from-emerald-500 to-teal-400', action: () => navigate(`/day/${today}`) },
    { title: 'View History', description: 'Browse past days', icon: History, gradient: 'from-blue-600 to-indigo-400', action: () => navigate('/history') },
    { title: 'View Summary', description: 'Check your stats', icon: BarChart3, gradient: 'from-violet-600 to-purple-400', action: () => navigate('/summary') },
  ];

  return (
    <div className="min-h-screen bg-[#0d0d14] p-4 md:p-8">
      {/* Ambient glow blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-orange-600/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute top-1/2 left-0 w-64 h-64 rounded-full bg-rose-600/8 blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto">

        {/* Hero banner */}
        <motion.div {...fadeUp(0)} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-400 p-6 mb-5 shadow-2xl shadow-orange-900/40">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-black/10 blur-2xl pointer-events-none" />

          <div className="relative">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Utensils className="size-4 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-none">Food Tracker</h1>
                <p className="text-xs text-white/60 mt-0.5">{formatLocaleDateMedium(new Date())}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Calories', value: todayLog.totalCalories, suffix: '', icon: Flame },
                { label: 'Protein', value: todayLog.totalProtein, suffix: 'g', icon: Dumbbell },
                { label: 'Meals', value: todayLog.mealCount, suffix: '', icon: Utensils },
              ].map(({ label, value, suffix, icon: Icon }, i) => (
                <motion.div key={label} {...fadeUp(0.08 + i * 0.07)}
                  className="bg-black/20 backdrop-blur-sm rounded-2xl p-3.5">
                  <Icon className="size-4 text-white/60 mb-2" />
                  <div className="text-2xl font-black text-white leading-none">
                    {value}<span className="text-sm font-semibold opacity-70">{suffix}</span>
                  </div>
                  <div className="text-xs text-white/50 mt-1 font-medium">{label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.p {...fadeUp(0.28)} className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2.5 px-1">
          Quick Actions
        </motion.p>
        <div className="space-y-2.5 mb-5">
          {quickActions.map((a, i) => (
            <motion.button
              key={i}
              {...fadeUp(0.32 + i * 0.06)}
              whileHover={{ scale: 1.015, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={a.action}
              className="w-full bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 flex items-center gap-4 text-left hover:bg-white/8 transition-colors"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${a.gradient} flex items-center justify-center shadow-lg shrink-0`}>
                <a.icon className="size-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-sm">{a.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{a.description}</div>
              </div>
              <ChevronRight className="size-4 text-slate-600 shrink-0" />
            </motion.button>
          ))}
        </div>

        {/* Tip */}
        <motion.div {...fadeUp(0.55)}
          className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <Zap className="size-4 text-amber-400" />
            </div>
            <div>
              <div className="font-bold text-white text-sm mb-1">Pro Tip</div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Type or speak what you ate — "chicken breast and rice" — and we'll track the calories and protein automatically.
              </p>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
