import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MOCK_INGREDIENTS } from './seed';
import { ShoppingListItem } from '../app/(tabs)/shop';

export type PantryItemState = 'in_stock' | 'low' | 'out' | 'need_checking';
export type PantryItemSource = 'added' | 'past_shop' | 'inferred' | 'skipped_meal';
export type TrackMode = 'state' | 'quantity';

export interface PantryItem {
  id: string; // Ingredient ID
  name: string;
  trackMode: TrackMode;
  state: PantryItemState;
  source: PantryItemSource;
  quantity?: number;
  unit?: string;
  confidence?: 'high' | 'medium' | 'low';
  lastUpdated: string;
}

const initialPantry: PantryItem[] = [
  { id: 'i8', name: 'Olive Oil', trackMode: 'state', state: 'in_stock', source: 'added', lastUpdated: '2 days ago' },
  { id: 'i9', name: 'Eggs', trackMode: 'quantity', quantity: 4, unit: 'items', state: 'low', source: 'past_shop', confidence: 'high', lastUpdated: '5 days ago' },
  { id: 'i14', name: 'Soy Sauce', trackMode: 'state', state: 'low', source: 'inferred', confidence: 'medium', lastUpdated: '1 week ago' },
  { id: 'i7', name: 'Basmati Rice', trackMode: 'state', state: 'in_stock', source: 'added', lastUpdated: '1 month ago' },
  { id: 'i6', name: 'Garlic', trackMode: 'quantity', quantity: 1, unit: 'clove', state: 'need_checking', source: 'past_shop', confidence: 'low', lastUpdated: '2 weeks ago' },
  { id: 'i13', name: 'Miso Paste', trackMode: 'state', state: 'need_checking', source: 'inferred', confidence: 'low', lastUpdated: '3 weeks ago' },
];

interface PantryContextType {
  pantryItems: PantryItem[];
  setPantryItems: React.Dispatch<React.SetStateAction<PantryItem[]>>;
  confirmShop: (purchasedItems: ShoppingListItem[]) => void;
  updateItemState: (id: string, newState: PantryItemState) => void;
  updateItemQuantity: (id: string, delta: number) => void;
  addManualItem: (name: string) => void;
  addSkippedIngredients: (ingredients: { ingredientId: string; amount: number; unit: string }[]) => void;
}

const PantryContext = createContext<PantryContextType | undefined>(undefined);

export function PantryProvider({ children }: { children: ReactNode }) {
  const [pantryItems, setPantryItems] = useState<PantryItem[]>(initialPantry);

  const updateItemState = (id: string, newState: PantryItemState) => {
    setPantryItems(prev => prev.map(item => item.id === id ? { ...item, state: newState, lastUpdated: 'Just now' } : item));
  };

  const updateItemQuantity = (id: string, delta: number) => {
    setPantryItems(prev => prev.map(item => {
      if (item.id === id && item.trackMode === 'quantity' && item.quantity !== undefined) {
        const newQ = Math.max(0, item.quantity + delta);
        const newState = newQ === 0 ? 'out' : item.state === 'out' ? 'in_stock' : item.state;
        return { ...item, quantity: newQ, state: newState, lastUpdated: 'Just now' };
      }
      return item;
    }));
  };

  const addManualItem = (name: string) => {
    const newItem: PantryItem = {
      id: `p_${Date.now()}`,
      name: name,
      trackMode: 'state',
      state: 'in_stock',
      source: 'added',
      lastUpdated: 'Just now'
    };
    setPantryItems(prev => [newItem, ...prev]);
  };

  const addSkippedIngredients = (ingredients: { ingredientId: string; amount: number; unit: string }[]) => {
    setPantryItems(prevPantry => {
      const nextPantry = [...prevPantry];
      
      ingredients.forEach(ing => {
        const ingredientDef = MOCK_INGREDIENTS.find(i => i.id === ing.ingredientId);
        if (!ingredientDef) return;

        const canonicalName = ingredientDef.name;
        
        // Check if item already exists
        const existingIndex = nextPantry.findIndex(p => p.id === ing.ingredientId || p.name.toLowerCase() === canonicalName.toLowerCase());

        if (existingIndex >= 0) {
          const existing = nextPantry[existingIndex];
          if (existing.trackMode === 'quantity') {
            const currentQ = existing.quantity || 0;
            existing.quantity = currentQ + ing.amount;
            existing.state = 'in_stock';
          } else {
            existing.state = 'in_stock';
          }
          existing.source = 'skipped_meal';
          existing.lastUpdated = 'Just now';
        } else {
          // Create new explicitly tracked item
          const newItem: PantryItem = {
            id: ing.ingredientId,
            name: canonicalName,
            trackMode: 'quantity',
            state: 'in_stock',
            source: 'skipped_meal',
            confidence: 'high',
            quantity: ing.amount,
            unit: ing.unit,
            lastUpdated: 'Just now'
          };
          nextPantry.unshift(newItem);
        }
      });
      
      return nextPantry;
    });
  };

  const confirmShop = (purchasedItems: ShoppingListItem[]) => {
    setPantryItems(prevPantry => {
      const nextPantry = [...prevPantry];

      purchasedItems.forEach(purchase => {
        const ingredientDef = MOCK_INGREDIENTS.find(i => i.id === purchase.id);
        if (!ingredientDef) return;

        // Ensure canonical naming (could use ingredientDef.name as strict canonical)
        const canonicalName = ingredientDef.name;

        // Determine track mode based on classification, not just unit
        // Usually, Pantry category or isStaple indicates state-based. Meat/Produce = quantity-based.
        const isStateBased = ingredientDef.isStaple || ingredientDef.category === 'Pantry';
        const trackMode: TrackMode = isStateBased ? 'state' : 'quantity';

        // Calculate actual usable quantity based on purchase size vs retail units
        // If purchase is 1 carton, and purchaseSize is 12, added usable units = 12.
        const purchaseMultiplier = ingredientDef.purchaseSize || 1;
        const usableQuantityAdded = purchase.amount * purchaseMultiplier;

        // Check if item already exists in pantry
        const existingIndex = nextPantry.findIndex(p => p.id === purchase.id || p.name.toLowerCase() === canonicalName.toLowerCase());

        if (existingIndex >= 0) {
          // Update existing
          const existing = nextPantry[existingIndex];
          
          if (existing.trackMode === 'quantity') {
            const currentQ = existing.quantity || 0;
            existing.quantity = currentQ + usableQuantityAdded;
            existing.state = 'in_stock';
          } else {
            existing.state = 'in_stock';
          }
          existing.source = 'past_shop';
          existing.confidence = 'high';
          existing.lastUpdated = 'Just now';

        } else {
          // Create new
          const newItem: PantryItem = {
            id: purchase.id,
            name: canonicalName,
            trackMode,
            state: 'in_stock',
            source: 'past_shop',
            confidence: 'high',
            lastUpdated: 'Just now'
          };

          if (trackMode === 'quantity') {
            newItem.quantity = usableQuantityAdded;
            newItem.unit = ingredientDef.defaultUnit;
          }

          nextPantry.unshift(newItem);
        }
      });

      return nextPantry;
    });
  };

  return (
    <PantryContext.Provider value={{ pantryItems, setPantryItems, confirmShop, updateItemState, updateItemQuantity, addManualItem, addSkippedIngredients }}>
      {children}
    </PantryContext.Provider>
  );
}

export function usePantry() {
  const context = useContext(PantryContext);
  if (context === undefined) {
    throw new Error('usePantry must be used within a PantryProvider');
  }
  return context;
}
