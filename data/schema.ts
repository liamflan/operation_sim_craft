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
  isStaple?: boolean;
  purchaseSize?: number; // e.g., 500 (ml) or 1 (bottle)
  purchaseUnit?: string; // e.g., "ml" or "bottle"
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
  tags: string[]; // e.g., ["High Protein", "Low Carb", "Vegan"]
  ingredients: RecipeIngredient[];
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
