import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Calendar as CalendarIcon, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { ChatInput } from '../components/ChatInput';
import { FoodEntry } from '../components/FoodEntry';
import { 
  getDayLog, 
  addFoodEntry, 
  deleteFoodEntry, 
  parseFoodInput,
  formatDate,
  getTodayDate,
} from '../utils/foodData';
import { logMealToBackend } from '../utils/api';
import { toast } from 'sonner';

export default function DailyLog() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(date ? new Date(date) : new Date());
  const [dayLog, setDayLog] = useState(getDayLog(date || getTodayDate()));
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    const dateString = formatDate(selectedDate);
    navigate(`/day/${dateString}`, { replace: true });
    setDayLog(getDayLog(dateString));
  }, [selectedDate, navigate]);

  const handleChatSubmit = async (text: string) => {
    const dateStr = dayLog.date;

    let apiMessage: string | null = null;
    try {
      const res = await logMealToBackend(text, dateStr);
      const nameFromItems = res.items
        ?.map((i) => i.label)
        .filter(Boolean)
        .join(', ');
      const name =
        (nameFromItems && nameFromItems.length > 0 ? nameFromItems : text).slice(0, 120);
      const protein = res.total_protein_g != null ? Math.round(res.total_protein_g) : 0;

      addFoodEntry(dateStr, {
        name,
        calories: Math.round(Number(res.total_calories)),
        protein,
      });

      setDayLog(getDayLog(dateStr));
      toast.success(`Added ${name.slice(0, 40)}${name.length > 40 ? '…' : ''}!`);
      setShowChat(false);
      return;
    } catch (e) {
      apiMessage = e instanceof Error ? e.message : String(e);
    }

    const parsed = parseFoodInput(text);

    if (parsed && parsed.name) {
      addFoodEntry(dateStr, {
        name: parsed.name,
        calories: parsed.calories || 0,
        protein: parsed.protein || 0,
      });

      setDayLog(getDayLog(dateStr));
      toast.success(`Added ${parsed.name}! (offline fallback)`);
      if (apiMessage) toast.info(`API unavailable: ${apiMessage}`);
      setShowChat(false);
    } else {
      toast.error(
        apiMessage ||
          "Couldn't log that meal. Start the API and ensure .env in the project root has OPENROUTER_API_KEY for vague foods. Try e.g. 200g chicken breast.",
      );
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    deleteFoodEntry(dayLog.date, entryId);
    setDayLog(getDayLog(dayLog.date));
    toast.success('Entry deleted');
  };

  const isToday = dayLog.date === getTodayDate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="size-5" />
          </Button>
          
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {isToday ? "Today's Log" : "Daily Log"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon">
                <CalendarIcon className="size-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Daily Summary */}
        <Card className="mb-6 bg-white/80 backdrop-blur">
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">{dayLog.totalCalories}</div>
                <div className="text-sm text-muted-foreground">Total Calories</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{dayLog.totalProtein}g</div>
                <div className="text-sm text-muted-foreground">Total Protein</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{dayLog.entries.length}</div>
                <div className="text-sm text-muted-foreground">Meals Logged</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chat Interface */}
        {showChat ? (
          <Card className="mb-6 bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-5" />
                Add Food
              </CardTitle>
              <CardDescription>
                Type or speak what you ate (e.g., "chicken breast", "banana", "oatmeal")
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChatInput onSubmit={handleChatSubmit} />
              <Button 
                variant="ghost" 
                className="w-full mt-2" 
                onClick={() => setShowChat(false)}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Button 
            className="w-full mb-6 h-14 text-lg" 
            onClick={() => setShowChat(true)}
          >
            <MessageSquare className="size-5 mr-2" />
            Add Food via Chat
          </Button>
        )}

        {/* Food Entries */}
        <div className="space-y-3">
          {dayLog.entries.length === 0 ? (
            <Card className="bg-white/60 backdrop-blur">
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No meals logged for this day yet.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Click "Add Food via Chat" to get started!
                </p>
              </CardContent>
            </Card>
          ) : (
            dayLog.entries
              .sort((a, b) => b.timestamp - a.timestamp)
              .map(entry => (
                <FoodEntry
                  key={entry.id}
                  entry={entry}
                  onDelete={handleDeleteEntry}
                />
              ))
          )}
        </div>
      </div>
    </div>
  );
}
