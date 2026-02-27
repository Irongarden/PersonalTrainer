// ── Enums / Union types ─────────────────────────────────────────────────────

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders'
  | 'biceps' | 'triceps' | 'forearms' | 'core'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves'
  | 'full_body' | 'cardio';

export type Equipment =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable'
  | 'bodyweight' | 'resistance_band' | 'kettlebell'
  | 'ez_bar' | 'other';

export type SetTag = 'warmup' | 'working' | 'failure' | 'drop' | 'normal';

export type UnitSystem = 'metric' | 'imperial';

export type ThemePreference = 'dark' | 'light' | 'system';

export type MealType =
  | 'breakfast' | 'lunch' | 'dinner'
  | 'snack' | 'pre_workout' | 'post_workout';

// ── Exercise ────────────────────────────────────────────────────────────────

export interface Exercise {
  id: string;
  name: string;
  description?: string | null;
  primary_muscles?: MuscleGroup[] | null;
  secondary_muscles?: MuscleGroup[] | null;
  equipment: Equipment;
  is_custom: boolean;
  user_id?: string | null;
  instructions?: string | null;
  video_url?: string | null;
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ── Template (workout plan) ─────────────────────────────────────────────────

export interface TemplateSet {
  id: string;
  template_exercise_id: string;
  set_number?: number;
  order?: number;
  target_reps?: number | null;
  target_reps_max?: number | null;
  target_weight?: number | null;
  rest_seconds?: number | null;
  tag?: SetTag | null;
}

export interface TemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  order?: number;
  order_index?: number;
  superset_group?: string | null;
  notes?: string | null;
  exercise?: Exercise | null;
  sets: TemplateSet[];
}

export interface Template {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  estimated_duration_minutes?: number | null;
  last_used_at?: string | null;
  created_at?: string;
  updated_at?: string;
  exercises: TemplateExercise[];
}

// ── Active Workout Session ──────────────────────────────────────────────────

export interface WorkoutSet {
  id: string;
  exercise_id?: string;
  set_number?: number;
  tag: SetTag;
  target_weight?: number | null;
  target_reps?: number | null;
  actual_weight?: number | null;
  actual_reps?: number | null;
  rpe?: number | null;
  status: 'pending' | 'completed' | 'skipped';
}

export interface WorkoutExercise {
  id: string;
  exercise_id: string;
  exercise?: Exercise | null;
  notes?: string | null;
  order?: number;
  sets: WorkoutSet[];
  previous?: {
    sets?: Array<{ weight?: number; reps?: number }>;
  } | null;
}

export interface PREvent {
  exercise_id: string;
  set_id: string;
  estimated_1rm: number;
}

export interface ActiveWorkoutSession {
  id: string;
  user_id: string;
  name: string;
  template_id?: string | null;
  started_at: string;
  exercises: WorkoutExercise[];
  pr_events?: PREvent[];
}

// ── Workout History ─────────────────────────────────────────────────────────

export interface WorkoutHistory {
  id: string;
  user_id?: string;
  name: string;
  started_at: string;
  finished_at?: string | null;
  duration_seconds?: number | null;
  total_volume_kg?: number | null;
  template_id?: string | null;
  notes?: string | null;
  exercise_count: number;
  set_count: number;
  is_synced: boolean;
}

export interface WorkoutDetail extends WorkoutHistory {
  exercises: Array<{
    id: string;
    exercise?: Exercise | null;
    sets: WorkoutSet[];
    notes?: string | null;
  }>;
}

// ── Meals ───────────────────────────────────────────────────────────────────

export interface MealItem {
  id: string;
  meal_id?: string;
  name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source?: 'manual' | 'estimated';
}

export interface MacroTotals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface Meal {
  id: string;
  user_id?: string;
  name: string;
  meal_type?: MealType | null;
  eaten_at: string;
  date?: string;
  photo_uri?: string | null;
  is_ai_estimated?: boolean;
  items: MealItem[];
  totals: MacroTotals;
}

export interface DailyMacros {
  date: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meals: Meal[];
}

// ── Coach ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  user_id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

export interface CoachGoals {
  primary_goal?: string;
  experience_level?: string;
  training_frequency_per_week?: string;
  injuries?: string;
}

// ── Profile ─────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  display_name?: string | null;
  unit_system: UnitSystem;
  theme: ThemePreference;
  default_rest_seconds: number;
  plate_bar_weight_kg?: number;
  coach_goals?: CoachGoals | null;
  created_at?: string;
  updated_at?: string;
}
