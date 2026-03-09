import { Recipe, Ingredient } from "./schema";

export const MOCK_INGREDIENTS: Ingredient[] = [
  { id: "i1", name: "Lean Beef Mince", category: "Meat & Fish", defaultUnit: "g" },
  { id: "i2", name: "Chicken Breast", category: "Meat & Fish", defaultUnit: "g" },
  { id: "i3", name: "Salmon Fillet", category: "Meat & Fish", defaultUnit: "g" },
  { id: "i4", name: "White Onion", category: "Fresh Produce", defaultUnit: "item" },
  { id: "i5", name: "Spinach", category: "Fresh Produce", defaultUnit: "g" },
  { id: "i6", name: "Garlic", category: "Fresh Produce", defaultUnit: "clove" },
  { id: "i7", name: "Basmati Rice", category: "Pantry", defaultUnit: "g", isStaple: true, purchaseSize: 1000, purchaseUnit: "g" },
  { id: "i8", name: "Olive Oil", category: "Pantry", defaultUnit: "tbsp", isStaple: true, purchaseSize: 1, purchaseUnit: "bottle" },
  { id: "i9", name: "Eggs", category: "Dairy & Eggs", defaultUnit: "item" },
  { id: "i10", name: "Sweet Potato", category: "Fresh Produce", defaultUnit: "g" },
  { id: "i11", name: "Avocado", category: "Fresh Produce", defaultUnit: "item" },
  { id: "i12", name: "Cherry Tomatoes", category: "Fresh Produce", defaultUnit: "g" },
  { id: "i13", name: "Miso Paste", category: "Pantry", defaultUnit: "tbsp", isStaple: true, purchaseSize: 1, purchaseUnit: "jar" },
  { id: "i14", name: "Soy Sauce", category: "Pantry", defaultUnit: "tbsp", isStaple: true, purchaseSize: 1, purchaseUnit: "bottle" },
  { id: "i15", name: "Sourdough Bread", category: "Bakery", defaultUnit: "slice" },
];

export const MOCK_RECIPES: Recipe[] = [
  {
    id: "r1",
    title: "Miso Glazed Salmon Bowl",
    imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=800&auto=format&fit=crop",
    prepTimeMinutes: 15,
    macros: { calories: 520, protein: 45, carbs: 35, fats: 22 },
    tags: ["High Protein", "Omega-3", "Quick"],
    ingredients: [
      { ingredientId: "i3", amount: 150, unit: "g" },
      { ingredientId: "i7", amount: 75, unit: "g" },
      { ingredientId: "i13", amount: 1, unit: "tbsp" },
      { ingredientId: "i14", amount: 1, unit: "tbsp" },
    ],
  },
  {
    id: "r2",
    title: "Steak & Sweet Potato Mash",
    imageUrl: "https://images.unsplash.com/photo-1628198642732-eafbe99eb0a2?q=80&w=800&auto=format&fit=crop",
    prepTimeMinutes: 25,
    macros: { calories: 650, protein: 55, carbs: 45, fats: 25 },
    tags: ["High Protein", "Post-Workout"],
    ingredients: [
      { ingredientId: "i1", amount: 200, unit: "g" }, // Using mince for mock
      { ingredientId: "i10", amount: 250, unit: "g" },
      { ingredientId: "i6", amount: 2, unit: "clove" },
      { ingredientId: "i8", amount: 1, unit: "tbsp" },
    ],
  },
  {
    id: "r3",
    title: "Avocado & Egg Sourdough Toast",
    imageUrl: "https://images.unsplash.com/photo-1525351484163-7529414344d8?q=80&w=800&auto=format&fit=crop",
    prepTimeMinutes: 5,
    macros: { calories: 350, protein: 20, carbs: 30, fats: 18 },
    tags: ["Vegetarian", "Quick Breakfast"],
    ingredients: [
      { ingredientId: "i15", amount: 2, unit: "slice" },
      { ingredientId: "i11", amount: 1, unit: "item" },
      { ingredientId: "i9", amount: 2, unit: "item" },
    ],
  },
  {
    id: "r4",
    title: "Garlic Butter Chicken & Spinach",
    imageUrl: "https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?q=80&w=800&auto=format&fit=crop", // Replaced potentially broken link
    prepTimeMinutes: 20,
    macros: { calories: 480, protein: 50, carbs: 10, fats: 26 },
    tags: ["Low Carb", "High Protein", "Keto"],
    ingredients: [
      { ingredientId: "i2", amount: 200, unit: "g" },
      { ingredientId: "i5", amount: 100, unit: "g" },
      { ingredientId: "i6", amount: 3, unit: "clove" },
      { ingredientId: "i8", amount: 2, unit: "tbsp" },
    ],
  }
];
