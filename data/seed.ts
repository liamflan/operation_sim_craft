import { Recipe, Ingredient } from "./schema";

export const MOCK_INGREDIENTS: Ingredient[] = [
  { id: "i1", name: "Lean Beef Mince", category: "Meat & Fish", defaultUnit: "g" },
  { id: "i2", name: "Chicken Breast", category: "Meat & Fish", defaultUnit: "g" },
  { id: "i3", name: "Salmon Fillet", category: "Meat & Fish", defaultUnit: "g" },
  { id: "i4", name: "White Onion", category: "Fresh Produce", defaultUnit: "item", purchaseSize: 1, purchaseUnit: "item" },
  { id: "i5", name: "Spinach", category: "Fresh Produce", defaultUnit: "g", purchaseSize: 200, purchaseUnit: "bag" },
  { id: "i6", name: "Garlic", category: "Fresh Produce", defaultUnit: "clove", purchaseSize: 1, purchaseUnit: "bulb" },
  { id: "i7", name: "Basmati Rice", category: "Pantry", defaultUnit: "g", isStaple: true, isPantryTracked: true, purchaseSize: 1000, purchaseUnit: "bag" },
  { id: "i8", name: "Olive Oil", category: "Pantry", defaultUnit: "tbsp", isStaple: true, isPantryTracked: true, purchaseSize: 1, purchaseUnit: "bottle" },
  { id: "i9", name: "Eggs", category: "Dairy & Eggs", defaultUnit: "item", purchaseSize: 12, purchaseUnit: "carton" },
  { id: "i10", name: "Sweet Potato", category: "Fresh Produce", defaultUnit: "g" },
  { id: "i11", name: "Avocado", category: "Fresh Produce", defaultUnit: "item", purchaseSize: 1, purchaseUnit: "item" },
  { id: "i12", name: "Cherry Tomatoes", category: "Fresh Produce", defaultUnit: "g", purchaseSize: 250, purchaseUnit: "pack" },
  { id: "i13", name: "Miso Paste", category: "Pantry", defaultUnit: "tbsp", isStaple: true, isPantryTracked: true, purchaseSize: 1, purchaseUnit: "jar" },
  { id: "i14", name: "Soy Sauce", category: "Pantry", defaultUnit: "tbsp", isStaple: true, isPantryTracked: true, purchaseSize: 1, purchaseUnit: "bottle" },
  { id: "i15", name: "Sourdough Bread", category: "Bakery", defaultUnit: "slice", purchaseSize: 16, purchaseUnit: "loaf" },
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
    imageUrl: "https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?q=80&w=800&auto=format&fit=crop",
    prepTimeMinutes: 20,
    macros: { calories: 480, protein: 50, carbs: 10, fats: 26 },
    tags: ["Low Carb", "High Protein", "Keto"],
    ingredients: [
      { ingredientId: "i2", amount: 200, unit: "g" },
      { ingredientId: "i5", amount: 100, unit: "g" },
      { ingredientId: "i6", amount: 3, unit: "clove" },
      { ingredientId: "i8", amount: 2, unit: "tbsp" },
    ],
  },
  {
    id: "r5",
    title: "Mediterranean Quinoa Salad",
    imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop",
    prepTimeMinutes: 10,
    macros: { calories: 420, protein: 12, carbs: 58, fats: 18 },
    tags: ["Vegan", "Healthy", "Quick"],
    ingredients: [
      { ingredientId: "i7", amount: 100, unit: "g" }, // Quinoa mock
      { ingredientId: "i12", amount: 100, unit: "g" },
      { ingredientId: "i11", amount: 0.5, unit: "item" },
      { ingredientId: "i8", amount: 1, unit: "tbsp" },
    ],
  },
  {
    id: "r6",
    title: "Beef & Broccoli Stir-Fry",
    imageUrl: "https://images.unsplash.com/photo-1512058560566-42724afbc2db?q=80&w=800&auto=format&fit=crop",
    prepTimeMinutes: 15,
    macros: { calories: 450, protein: 38, carbs: 15, fats: 28 },
    tags: ["High Protein", "Low Carb", "Quick"],
    ingredients: [
      { ingredientId: "i1", amount: 150, unit: "g" },
      { ingredientId: "i4", amount: 1, unit: "item" },
      { ingredientId: "i14", amount: 2, unit: "tbsp" },
    ],
  },
  {
    id: "r7",
    title: "Blueberry Protein Pancakes",
    imageUrl: "https://images.unsplash.com/photo-1506084868730-342b1f894493?q=80&w=800&auto=format&fit=crop",
    prepTimeMinutes: 10,
    macros: { calories: 380, protein: 30, carbs: 45, fats: 8 },
    tags: ["Vegetarian", "High Protein", "Breakfast"],
    ingredients: [
      { ingredientId: "i9", amount: 2, unit: "item" },
      { ingredientId: "i15", amount: 1, unit: "slice" }, // Mock pancake ingredients
    ],
  },
  {
    id: "r8",
    title: "Sweet Potato & Black Bean Bowl",
    imageUrl: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?q=80&w=800&auto=format&fit=crop",
    prepTimeMinutes: 20,
    macros: { calories: 490, protein: 15, carbs: 75, fats: 14 },
    tags: ["Vegan", "High Fiber", "Healthy"],
    ingredients: [
      { ingredientId: "i10", amount: 200, unit: "g" },
      { ingredientId: "i5", amount: 50, unit: "g" },
      { ingredientId: "i12", amount: 50, unit: "g" },
    ],
  }
];
