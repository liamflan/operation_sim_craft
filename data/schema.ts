export type MacroTarget = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type Ingredient = {
  id: string;
  name: string;
  category: "Meat & Fish" | "Fresh Produce" | "Dairy & Eggs" | "Pantry" | "Bakery" | "Frozen";
  defaultUnit: "g" | "ml" | "item" | "tbsp" | "tsp" | "clove" | "slice";
  isStaple?: boolean; // If true, only add to list if stock < usage
  isPantryTracked?: boolean; // If true, the user wants to see stock levels
  purchaseSize?: number; // The retail size (e.g., 1 bottle, 500ml)
  purchaseUnit?: string; // The retail unit (e.g., "loaf", "bottle", "bulb")
};

export type RecipeIngredient = {
  ingredientId: string;
  amount: number;
  unit: string;
};

export type Recipe = {
  id: string;
  title: string;
  imageUrl: string;
  prepTimeMinutes: number;
  macros: MacroTarget;
  tags: string[];
  ingredients: RecipeIngredient[];
  /** Which meal slots this recipe is appropriate for */
  suitableFor: ('breakfast' | 'lunch' | 'dinner')[];
  /** Rough retail cost estimate in GBP */
  estimatedCostGBP: number;
};

export type UserProfile = {
  id: string;
  name: string;
  targetMacros: MacroTarget;
  budgetWeekly: number;
  dietaryPreference: "Omnivore" | "Pescatarian" | "Vegetarian" | "Vegan";
  allergies: string[];
  pantry?: Record<string, number>; // Maps ingredient ID to current amount in stock
};

export type DailyMealPlan = {
  date: string; // ISO format
  breakfast?: string; // Recipe ID
  lunch?: string; // Recipe ID
  dinner?: string; // Recipe ID
  snacks?: string[]; // Recipe IDs
};
