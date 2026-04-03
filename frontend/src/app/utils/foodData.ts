export interface FoodEntry {
  id: string;
  date: string; // YYYY-MM-DD format
  name: string;
  calories: number;
  protein: number;
  timestamp: number;
}

export interface DayLog {
  date: string;
  entries: FoodEntry[];
  totalCalories: number;
  totalProtein: number;
}

// Parse natural language food input (simplified version)
export function parseFoodInput(input: string): Partial<FoodEntry> | null {
  const lowerInput = input.toLowerCase();
  
  // Common foods database (simplified)
  const foodDatabase: Record<string, { calories: number; protein: number }> = {
    'apple': { calories: 95, protein: 0.5 },
    'banana': { calories: 105, protein: 1.3 },
    'chicken breast': { calories: 165, protein: 31 },
    'salmon': { calories: 206, protein: 22 },
    'rice': { calories: 206, protein: 4.3 },
    'pasta': { calories: 220, protein: 8 },
    'egg': { calories: 72, protein: 6 },
    'eggs': { calories: 144, protein: 12 },
    'oatmeal': { calories: 150, protein: 5 },
    'yogurt': { calories: 100, protein: 10 },
    'bread': { calories: 80, protein: 4 },
    'avocado': { calories: 240, protein: 3 },
    'broccoli': { calories: 55, protein: 4 },
    'steak': { calories: 271, protein: 26 },
    'milk': { calories: 149, protein: 8 },
    'cheese': { calories: 113, protein: 7 },
    'pizza': { calories: 285, protein: 12 },
    'burger': { calories: 354, protein: 20 },
    'salad': { calories: 150, protein: 3 },
  };

  // Try to find a match in the database
  for (const [food, nutrition] of Object.entries(foodDatabase)) {
    if (lowerInput.includes(food)) {
      return {
        name: food.charAt(0).toUpperCase() + food.slice(1),
        calories: nutrition.calories,
        protein: nutrition.protein,
      };
    }
  }

  // Try to extract numbers if mentioned
  const calorieMatch = lowerInput.match(/(\d+)\s*(cal|kcal|calories?)/);
  const proteinMatch = lowerInput.match(/(\d+)\s*(g|grams?)?\s*protein/);
  
  if (calorieMatch || proteinMatch) {
    return {
      name: input,
      calories: calorieMatch ? parseInt(calorieMatch[1]) : 0,
      protein: proteinMatch ? parseInt(proteinMatch[1]) : 0,
    };
  }

  return null;
}

// LocalStorage helpers
const STORAGE_KEY = 'food_tracker_data';

export function getAllLogs(): Record<string, DayLog> {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : {};
}

export function getDayLog(date: string): DayLog {
  const logs = getAllLogs();
  return logs[date] || {
    date,
    entries: [],
    totalCalories: 0,
    totalProtein: 0,
  };
}

export function saveDayLog(dayLog: DayLog): void {
  const logs = getAllLogs();
  logs[dayLog.date] = dayLog;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

export function addFoodEntry(date: string, entry: Omit<FoodEntry, 'id' | 'date' | 'timestamp'>): void {
  const dayLog = getDayLog(date);
  const newEntry: FoodEntry = {
    ...entry,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    date,
    timestamp: Date.now(),
  };
  
  dayLog.entries.push(newEntry);
  dayLog.totalCalories = dayLog.entries.reduce((sum, e) => sum + e.calories, 0);
  dayLog.totalProtein = dayLog.entries.reduce((sum, e) => sum + e.protein, 0);
  
  saveDayLog(dayLog);
}

export function deleteFoodEntry(date: string, entryId: string): void {
  const dayLog = getDayLog(date);
  dayLog.entries = dayLog.entries.filter(e => e.id !== entryId);
  dayLog.totalCalories = dayLog.entries.reduce((sum, e) => sum + e.calories, 0);
  dayLog.totalProtein = dayLog.entries.reduce((sum, e) => sum + e.protein, 0);
  
  saveDayLog(dayLog);
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getTodayDate(): string {
  return formatDate(new Date());
}
