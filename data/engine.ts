import { MOCK_RECIPES, Recipe } from "./seed";
import { DailyMealPlan, MacroTarget, UserProfile } from "./schema";

/**
 * MOCK SUBTRACTION ENGINE
 * This is the MVP logic for generating a meal plan that fits a user's macro target.
 * In a real backend, this would use a graph DB and complex weighting.
 */
export function generateWeeklyPlan(user: UserProfile): DailyMealPlan[] {
  const weeklyPlan: DailyMealPlan[] = [];
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Filter recipes based on dietary preference (Mock simple filter)
  let availableRecipes = MOCK_RECIPES;
  if (user.dietaryPreference === "Vegetarian") {
    availableRecipes = availableRecipes.filter(r => r.tags.includes("Vegetarian"));
  }

  // Generate 7 days
  for (let i = 0; i < 7; i++) {
    // For MVP, we'll just randomly select to reach roughly the calorie goal.
    // In reality, this would be a knapsack algorithm.
    const breakfast = availableRecipes.find(r => r.tags.includes("Quick Breakfast")) || availableRecipes[0];
    const lunch = availableRecipes[Math.floor(Math.random() * availableRecipes.length)];
    const dinner = availableRecipes[Math.floor(Math.random() * availableRecipes.length)];

    weeklyPlan.push({
      date: days[i],
      breakfast: breakfast.id,
      lunch: lunch.id,
      dinner: dinner.id,
      snacks: []
    });
  }

  return weeklyPlan;
}

/**
 * Calculates the total macros for a given daily plan to display in the UI progress rings
 */
export function calculateDailyMacros(plan: DailyMealPlan, recipes: Recipe[]): MacroTarget {
  let total: MacroTarget = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  
  [plan.breakfast, plan.lunch, plan.dinner].forEach(recipeId => {
    if (!recipeId) return;
    const recipe = recipes.find(r => r.id === recipeId);
    if (recipe) {
      total.calories += recipe.macros.calories;
      total.protein += recipe.macros.protein;
      total.carbs += recipe.macros.carbs;
      total.fats += recipe.macros.fats;
    }
  });

  return total;
}
