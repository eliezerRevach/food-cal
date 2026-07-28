import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, TrendingUp, Calendar } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  getTodayDate,
  addCalendarDaysIso,
  formatIsoDateShort,
  getOfflineDayLog,
  getOfflineLogs,
  dateFromIsoMiddayUtc,
} from '../utils/foodData';
import { fetchEntryRollups, type RollupDay } from '../utils/api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type TimeRange = 'week' | 'month' | 'quarter' | 'max';

type ChartDay = {
  date: string;
  fullDate: string;
  calories: number;
  protein: number;
  meals: number;
};

const RANGE_DAYS: Record<Exclude<TimeRange, 'max'>, number> = {
  week: 7,
  month: 30,
  quarter: 90,
};

const MAX_ROLLUP_START = '1970-01-01';

function calendarDaysBetween(earlierIso: string, laterIso: string): number {
  const a = dateFromIsoMiddayUtc(earlierIso).getTime();
  const b = dateFromIsoMiddayUtc(laterIso).getTime();
  return Math.round((b - a) / 86_400_000);
}

function buildChartDay(date: string, rollup?: RollupDay): ChartDay {
  const off = getOfflineDayLog(date);
  return {
    date: formatIsoDateShort(date),
    fullDate: date,
    calories: Math.round((rollup?.total_calories ?? 0) + off.totalCalories),
    protein: Math.round((rollup?.total_protein_g ?? 0) + off.totalProtein),
    meals: (rollup?.meals ?? 0) + off.entries.length,
  };
}

function buildChartRows(
  start: string,
  end: string,
  byDate: Map<string, RollupDay>,
): ChartDay[] {
  const dayCount = calendarDaysBetween(start, end) + 1;
  const data: ChartDay[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const dateString = addCalendarDaysIso(end, -i);
    data.push(buildChartDay(dateString, byDate.get(dateString)));
  }
  return data;
}

function earliestLoggedDate(end: string, rollups: RollupDay[]): string {
  const candidates: string[] = rollups.map((r) => r.date);
  const offline = getOfflineLogs();
  for (const d of Object.keys(offline)) {
    if (d <= end) candidates.push(d);
  }
  if (candidates.length === 0) return end;
  return candidates.reduce((min, d) => (d < min ? d : min));
}

export default function Summary() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [chartData, setChartData] = useState<ChartDay[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const end = getTodayDate();
      const start =
        timeRange === 'max'
          ? MAX_ROLLUP_START
          : addCalendarDaysIso(end, -(RANGE_DAYS[timeRange] - 1));
      try {
        const { days: rollups } = await fetchEntryRollups(start, end);
        if (cancelled) return;
        const rangeStart =
          timeRange === 'max' ? earliestLoggedDate(end, rollups) : addCalendarDaysIso(end, -(RANGE_DAYS[timeRange] - 1));
        const byDate = new Map(rollups.map((d) => [d.date, d]));
        setChartData(buildChartRows(rangeStart, end, byDate));
        setLoadError(null);
      } catch (e) {
        if (!cancelled) {
          const rangeStart =
            timeRange === 'max'
              ? earliestLoggedDate(end, [])
              : addCalendarDaysIso(end, -(RANGE_DAYS[timeRange] - 1));
          setChartData(buildChartRows(rangeStart, end, new Map()));
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [timeRange]);

  const loggedDays = chartData.filter((d) => d.meals > 0);
  const totalDays = loggedDays.length;
  const avgCalories =
    totalDays > 0
      ? Math.round(loggedDays.reduce((sum, d) => sum + d.calories, 0) / totalDays)
      : 0;
  const avgProtein =
    totalDays > 0
      ? Math.round(loggedDays.reduce((sum, d) => sum + d.protein, 0) / totalDays)
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="size-5" />
          </Button>

          <div className="flex-1">
            <h1 className="text-2xl font-bold">Summary & Analytics</h1>
            <p className="text-sm text-muted-foreground">Track your progress over time</p>
          </div>
        </div>

        {loadError && (
          <p className="text-sm text-amber-700 mb-4 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
            Could not load summary from the server ({loadError}).
          </p>
        )}

        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)} className="mb-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4 bg-gray-200">
            <TabsTrigger
              value="week"
              className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=inactive]:text-gray-500 data-[state=inactive]:bg-transparent"
            >
              Last 7 Days
            </TabsTrigger>
            <TabsTrigger
              value="month"
              className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=inactive]:text-gray-500 data-[state=inactive]:bg-transparent"
            >
              Last 30 Days
            </TabsTrigger>
            <TabsTrigger
              value="quarter"
              className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=inactive]:text-gray-500 data-[state=inactive]:bg-transparent"
            >
              Last 90 Days
            </TabsTrigger>
            <TabsTrigger
              value="max"
              className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=inactive]:text-gray-500 data-[state=inactive]:bg-transparent"
            >
              Max
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-white/80 backdrop-blur">
            <CardHeader>
              <CardDescription>Days Logged</CardDescription>
              <CardTitle className="text-3xl text-green-600">{totalDays}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-white/80 backdrop-blur">
            <CardHeader>
              <CardDescription>Avg. Calories/Day</CardDescription>
              <CardTitle className="text-3xl text-orange-600">{avgCalories}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-white/80 backdrop-blur">
            <CardHeader>
              <CardDescription>Avg. Protein/Day</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{avgProtein}g</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="mb-6 bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5" />
              Daily Calories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="calories" fill="#ea580c" name="Calories" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="mb-6 bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5" />
              Daily Protein
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="protein" stroke="#2563eb" strokeWidth={2} name="Protein (g)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {chartData
                .filter((d) => d.meals > 0)
                .reverse()
                .slice(0, 7)
                .map((day) => (
                  <div
                    key={day.fullDate}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    onClick={() => navigate(`/day/${day.fullDate}`)}
                  >
                    <div>
                      <div className="font-medium">{day.date}</div>
                      <div className="text-sm text-muted-foreground">{day.meals} meals</div>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div className="text-orange-600 font-semibold">{day.calories} cal</div>
                      <div className="text-blue-600 font-semibold">{day.protein}g protein</div>
                    </div>
                  </div>
                ))}
              {chartData.filter((d) => d.meals > 0).length === 0 && !loadError && (
                <div className="text-center py-8 text-muted-foreground">
                  No activity recorded yet. Start logging your meals!
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
