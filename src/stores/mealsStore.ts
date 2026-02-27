import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { generateId, sumMacros } from '../utils/calculations';
import type { Meal, MealItem, MacroTotals } from '../types';

interface AIAnalysisResult {
  items: Omit<MealItem, 'id'>[];
  name?: string;
}

interface MealsState {
  meals: Meal[];
  selectedDate: string;
  isLoading: boolean;
  isAnalyzing: boolean;

  setSelectedDate: (date: string) => void;
  fetchMeals: (userId: string) => Promise<void>;
  addMeal: (meal: Omit<Meal, 'id' | 'totals'>) => Promise<void>;
  updateMeal: (mealId: string, updates: Partial<Meal>) => Promise<void>;
  deleteMeal: (mealId: string) => Promise<void>;
  analyzePhoto: (photoUri: string) => Promise<AIAnalysisResult>;
}

function computeTotals(items: MealItem[]): MacroTotals {
  return sumMacros(items);
}

export const useMealsStore = create<MealsState>((set, get) => ({
  meals: [],
  selectedDate: new Date().toISOString().split('T')[0],
  isLoading: false,
  isAnalyzing: false,

  setSelectedDate: (date) => {
    set({ selectedDate: date });
  },

  fetchMeals: async (userId) => {
    const date = get().selectedDate;
    set({ isLoading: true });
    try {
      // Filter by eaten_at date range — avoids depending on a separate 'date' column
      const { data, error } = await supabase
        .from('meals')
        .select(`*, meal_items(*)`)
        .eq('user_id', userId)
        .gte('eaten_at', `${date}T00:00:00`)
        .lte('eaten_at', `${date}T23:59:59`)
        .order('eaten_at', { ascending: true });

      if (error) throw error;

      const meals: Meal[] = (data ?? []).map((m: any) => {
        const items: MealItem[] = (m.meal_items ?? []).map((i: any) => ({
          id: i.id,
          meal_id: i.meal_id,
          name: i.name,
          grams: i.grams,
          kcal: i.kcal,
          protein_g: i.protein_g ?? 0,
          carbs_g: i.carbs_g ?? 0,
          fat_g: i.fat_g ?? 0,
          source: i.source ?? 'manual',
        }));
        return {
          id: m.id,
          user_id: m.user_id,
          name: m.name,
          meal_type: m.meal_type,
          eaten_at: m.eaten_at,
          date: m.date,
          photo_uri: m.photo_uri,
          is_ai_estimated: m.is_ai_estimated,
          items,
          totals: computeTotals(items),
        };
      });

      set({ meals });
    } catch {
      set({ meals: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  addMeal: async (mealData) => {
    const mealId = generateId();
    const rawItems = mealData.items ?? [];
    const mealItems: MealItem[] = rawItems.map((i: any) => ({
      ...i,
      id: i.id ?? generateId(),
      meal_id: mealId,
    }));

    const totals = computeTotals(mealItems);
    // Derive date from eaten_at if not explicitly provided
    const date = mealData.date ?? mealData.eaten_at?.split('T')[0] ?? get().selectedDate;

    const newMeal: Meal = {
      ...mealData,
      id: mealId,
      date,
      items: mealItems,
      totals,
    };

    // Optimistic update
    set(s => ({ meals: [...s.meals, newMeal] }));

    try {
      const { error: mealErr } = await supabase.from('meals').insert({
        id: mealId,
        user_id: mealData.user_id,
        name: mealData.name,
        meal_type: mealData.meal_type,
        eaten_at: mealData.eaten_at,
        photo_uri: mealData.photo_uri ?? null,
        is_ai_estimated: mealData.is_ai_estimated ?? false,
      });
      if (mealErr) throw mealErr;

      if (mealItems.length > 0) {
        await supabase.from('meal_items').insert(
          mealItems.map(i => ({
            id: i.id,
            meal_id: mealId,
            name: i.name,
            grams: i.grams,
            kcal: i.kcal,
            protein_g: i.protein_g,
            carbs_g: i.carbs_g,
            fat_g: i.fat_g,
          }))
        );
      }
    } catch {
      // Rollback on error
      set(s => ({ meals: s.meals.filter(m => m.id !== mealId) }));
      throw new Error('Failed to save meal');
    }
  },

  updateMeal: async (mealId, updates) => {
    set(s => ({
      meals: s.meals.map(m => m.id !== mealId ? m : { ...m, ...updates }),
    }));
    await supabase.from('meals').update(updates).eq('id', mealId);
  },

  deleteMeal: async (mealId) => {
    set(s => ({ meals: s.meals.filter(m => m.id !== mealId) }));
    await supabase.from('meals').delete().eq('id', mealId);
  },

  analyzePhoto: async (photoUri) => {
    set({ isAnalyzing: true });
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
      const endpoint = `${supabaseUrl}/functions/v1/meal-analysis`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
        },
        body: JSON.stringify({ photoUri }),
      });

      if (!response.ok) throw new Error('Analysis failed');

      const result = await response.json();
      return result as AIAnalysisResult;
    } finally {
      set({ isAnalyzing: false });
    }
  },
}));


function computeTotals(items: MealItem[]): MacroTotals {
  return sumMacros(items);
}

export const useMealsStore = create<MealsState>((set, get) => ({
  meals: [],
  isLoading: false,
  isAnalyzing: false,

  fetchMeals: async (userId, date) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('meals')
        .select(`*, meal_items(*)`)
        .eq('user_id', userId)
        .eq('date', date)
        .order('eaten_at', { ascending: true });

      if (error) throw error;

      const meals: Meal[] = (data ?? []).map((m: any) => {
        const items: MealItem[] = (m.meal_items ?? []).map((i: any) => ({
          id: i.id,
          meal_id: i.meal_id,
          name: i.name,
          grams: i.grams,
          kcal: i.kcal,
          protein_g: i.protein_g ?? 0,
          carbs_g: i.carbs_g ?? 0,
          fat_g: i.fat_g ?? 0,
        }));
        return {
          id: m.id,
          user_id: m.user_id,
          name: m.name,
          meal_type: m.meal_type,
          eaten_at: m.eaten_at,
          date: m.date,
          photo_uri: m.photo_uri,
          is_ai_estimated: m.is_ai_estimated,
          items,
          totals: computeTotals(items),
        };
      });

      set({ meals });
    } finally {
      set({ isLoading: false });
    }
  },

  addMeal: async ({ userId, items = [], ...mealData }) => {
    const mealId = generateId();
    const mealItems: MealItem[] = (items as MealItem[]).map(i => ({
      ...i,
      id: i.id ?? generateId(),
      meal_id: mealId,
    }));

    const totals = computeTotals(mealItems);

    const newMeal: Meal = {
      id: mealId,
      user_id: userId,
      ...mealData,
      items: mealItems,
      totals,
    };

    // Optimistic update
    set(s => ({ meals: [...s.meals, newMeal] }));

    try {
      const { error: mealErr } = await supabase.from('meals').insert({
        id: mealId,
        user_id: userId,
        name: mealData.name,
        meal_type: mealData.meal_type,
        eaten_at: mealData.eaten_at,
        date: mealData.date,
        photo_uri: mealData.photo_uri,
        is_ai_estimated: mealData.is_ai_estimated,
      });
      if (mealErr) throw mealErr;

      if (mealItems.length > 0) {
        await supabase.from('meal_items').insert(
          mealItems.map(i => ({
            id: i.id,
            meal_id: mealId,
            name: i.name,
            grams: i.grams,
            kcal: i.kcal,
            protein_g: i.protein_g,
            carbs_g: i.carbs_g,
            fat_g: i.fat_g,
          }))
        );
      }
    } catch {
      // Rollback on error
      set(s => ({ meals: s.meals.filter(m => m.id !== mealId) }));
      throw new Error('Failed to save meal');
    }
  },

  updateMeal: async (mealId, updates) => {
    set(s => ({
      meals: s.meals.map(m => m.id !== mealId ? m : { ...m, ...updates }),
    }));
    await supabase.from('meals').update(updates).eq('id', mealId);
  },

  deleteMeal: async (mealId) => {
    set(s => ({ meals: s.meals.filter(m => m.id !== mealId) }));
    await supabase.from('meals').delete().eq('id', mealId);
  },

  analyzePhoto: async (photoUri) => {
    set({ isAnalyzing: true });
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
      const endpoint = `${supabaseUrl}/functions/v1/meal-analysis`;

      // Convert URI to base64 for the API
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
        },
        body: JSON.stringify({ photoUri }),
      });

      if (!response.ok) throw new Error('Analysis failed');

      const result = await response.json();
      return result as AIAnalysisResult;
    } finally {
      set({ isAnalyzing: false });
    }
  },
}));
