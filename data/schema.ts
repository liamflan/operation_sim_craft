import { RecipeArchetype } from './plannerSchema';

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

export type MethodStep = {
  step: number;
  text: string;
  timeCue?: string; // e.g. "3 min", "until golden"
};

export type Substitution = {
  original: string;
  swap: string;
  reason: string; // e.g. "cheaper", "faster", "milder", "higher protein"
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
  /** Planner-facing role, determining how often it can repeat and when it's used */
  archetype?: RecipeArchetype;

  // ─── Rich detail fields (optional, populated for full recipe detail page) ───
  description?: string;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  servings?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  method?: MethodStep[];
  substitutions?: Substitution[];
  notes?: string;
  relatedRecipeIds?: string[];
  costPerServingGBP?: number;
  reheatsWell?: boolean;
  freezerFriendly?: boolean;
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
