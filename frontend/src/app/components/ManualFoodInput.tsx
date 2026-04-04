import { useState, type KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export type ManualFoodFormData = {
  name: string;
  grams: number;
  protein: number;
  calories: number;
};

interface ManualFoodInputProps {
  onSubmit: (data: ManualFoodFormData) => void;
}

export function ManualFoodInput({ onSubmit }: ManualFoodInputProps) {
  const [formData, setFormData] = useState({
    name: '',
    grams: '',
    protein: '',
    calories: '',
  });

  const handleSubmit = () => {
    if (formData.name && formData.grams && formData.protein && formData.calories) {
      onSubmit({
        name: formData.name,
        grams: parseFloat(formData.grams),
        protein: parseFloat(formData.protein),
        calories: parseFloat(formData.calories),
      });
      setFormData({
        name: '',
        grams: '',
        protein: '',
        calories: '',
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const isValid = Boolean(
    formData.name && formData.grams && formData.protein && formData.calories,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="food-name" className="mb-1.5 block text-sm font-medium">
            Food Name
          </Label>
          <Input
            id="food-name"
            placeholder="e.g., Grilled Chicken Breast"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            onKeyDown={handleKeyDown}
            className="h-11"
          />
        </div>

        <div>
          <Label htmlFor="food-grams" className="mb-1.5 block text-sm font-medium">
            Weight (grams)
          </Label>
          <Input
            id="food-grams"
            type="number"
            placeholder="150"
            value={formData.grams}
            onChange={(e) => setFormData({ ...formData, grams: e.target.value })}
            onKeyDown={handleKeyDown}
            className="h-11"
            min={0}
            step={0.1}
          />
        </div>

        <div>
          <Label htmlFor="food-calories" className="mb-1.5 block text-sm font-medium">
            Calories (kcal)
          </Label>
          <Input
            id="food-calories"
            type="number"
            placeholder="165"
            value={formData.calories}
            onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
            onKeyDown={handleKeyDown}
            className="h-11"
            min={0}
            step={1}
          />
        </div>

        <div>
          <Label htmlFor="food-protein" className="mb-1.5 block text-sm font-medium">
            Protein (grams)
          </Label>
          <Input
            id="food-protein"
            type="number"
            placeholder="31"
            value={formData.protein}
            onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
            onKeyDown={handleKeyDown}
            className="h-11"
            min={0}
            step={0.1}
          />
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={!isValid} className="h-11 w-full" size="lg">
        <Plus className="mr-2 size-4" />
        Add Food Entry
      </Button>
    </div>
  );
}
