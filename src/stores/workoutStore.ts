import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { generateId } from '../utils/calculations';
import type {
  ActiveWorkoutSession, WorkoutExercise, WorkoutSet,
  Template, SetTag, PREvent,
} from '../types';

interface RestTimer {
  isRunning: boolean;
  remaining: number;
  total: number;
  exerciseId?: string;
}

interface WorkoutState {
  activeSession: ActiveWorkoutSession | null;
  elapsedSeconds: number;
  restTimer: RestTimer;
  isFinishing: boolean;

  // Session lifecycle
  startFromTemplate: (template: Template, userId: string) => Promise<void>;
  startEmpty: (name: string, userId: string) => void;
  finishWorkout: () => Promise<void>;
  discardWorkout: () => void;

  // Set actions
  completeSet: (exerciseId: string, setId: string) => void;
  updateSet: (exerciseId: string, setId: string, updates: Partial<WorkoutSet>) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  addSet: (exerciseId: string) => void;

  // Exercise actions
  updateExerciseNotes: (exerciseId: string, notes: string) => void;
  removeExercise: (exerciseId: string) => void;

  // Timers
  tickElapsed: () => void;
  startRestTimer: (seconds: number, exerciseId?: string) => void;
  stopRestTimer: () => void;
  tickTimer: () => void;
}

function buildSessionFromTemplate(
  template: Template,
  userId: string
): ActiveWorkoutSession {
  const exercises: WorkoutExercise[] = template.exercises.map(te => ({
    id: generateId(),
    exercise_id: te.exercise_id,
    exercise: te.exercise ?? undefined,
    notes: te.notes ?? undefined,
    order: te.order ?? te.order_index ?? 0,
    sets: te.sets.map((ts, idx) => ({
      id: generateId(),
      exercise_id: te.exercise_id,
      set_number: idx + 1,
      tag: (ts.tag as SetTag) ?? 'normal',
      target_weight: ts.target_weight ?? null,
      target_reps: ts.target_reps ?? null,
      actual_weight: ts.target_weight ?? null,
      actual_reps: ts.target_reps ?? null,
      status: 'pending' as const,
    })),
    previous: null,
  }));

  return {
    id: generateId(),
    user_id: userId,
    name: template.name,
    template_id: template.id,
    started_at: new Date().toISOString(),
    exercises,
    pr_events: [],
  };
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  activeSession: null,
  elapsedSeconds: 0,
  restTimer: { isRunning: false, remaining: 0, total: 0 },
  isFinishing: false,

  startFromTemplate: async (template, userId) => {
    // Fetch previous performance for context
    const session = buildSessionFromTemplate(template, userId);
    set({ activeSession: session, elapsedSeconds: 0 });
  },

  startEmpty: (name, userId) => {
    const session: ActiveWorkoutSession = {
      id: generateId(),
      user_id: userId,
      name,
      template_id: null,
      started_at: new Date().toISOString(),
      exercises: [],
      pr_events: [],
    };
    set({ activeSession: session, elapsedSeconds: 0 });
  },

  finishWorkout: async () => {
    const { activeSession, elapsedSeconds } = get();
    if (!activeSession) return;
    set({ isFinishing: true });

    try {
      const finishedAt = new Date().toISOString();
      const completedExercises = activeSession.exercises.filter(
        ex => ex.sets.some(s => s.status === 'completed')
      );

      const totalVolumeKg = completedExercises.reduce((sum, ex) =>
        sum + ex.sets
          .filter(s => s.status === 'completed')
          .reduce((s2, set) =>
            s2 + (set.actual_weight ?? 0) * (set.actual_reps ?? 0), 0),
        0
      );

      // Insert workout record
      const { data: workout, error: wErr } = await supabase
        .from('workouts')
        .insert({
          id: activeSession.id,
          user_id: activeSession.user_id,
          name: activeSession.name,
          template_id: activeSession.template_id,
          started_at: activeSession.started_at,
          finished_at: finishedAt,
          duration_seconds: elapsedSeconds,
          total_volume_kg: totalVolumeKg,
        })
        .select()
        .single();

      if (wErr) throw wErr;

      // Insert exercises and sets
      for (const ex of completedExercises) {
        const { data: wEx, error: exErr } = await supabase
          .from('workout_exercises')
          .insert({
            id: ex.id,
            workout_id: workout.id,
            exercise_id: ex.exercise_id,
            notes: ex.notes,
            order: ex.order ?? 0,
          })
          .select()
          .single();

        if (exErr) continue;

        const completedSets = ex.sets.filter(s => s.status === 'completed');
        if (completedSets.length > 0) {
          await supabase.from('workout_sets').insert(
            completedSets.map((s, idx) => ({
              id: s.id,
              workout_exercise_id: wEx.id,
              set_number: s.set_number ?? idx + 1,
              tag: s.tag,
              actual_weight: s.actual_weight,
              actual_reps: s.actual_reps,
              rpe: s.rpe,
            }))
          );
        }
      }

      // Update template last_used_at
      if (activeSession.template_id) {
        await supabase
          .from('templates')
          .update({ last_used_at: finishedAt })
          .eq('id', activeSession.template_id);
      }

      set({ activeSession: null, elapsedSeconds: 0, isFinishing: false });
    } catch (err) {
      set({ isFinishing: false });
      throw err;
    }
  },

  discardWorkout: () => {
    set({
      activeSession: null,
      elapsedSeconds: 0,
      restTimer: { isRunning: false, remaining: 0, total: 0 },
    });
  },

  completeSet: (exerciseId, setId) => {
    set(s => {
      if (!s.activeSession) return s;
      return {
        activeSession: {
          ...s.activeSession,
          exercises: s.activeSession.exercises.map(ex =>
            ex.id !== exerciseId ? ex : {
              ...ex,
              sets: ex.sets.map(set =>
                set.id !== setId ? set : { ...set, status: 'completed' as const }
              ),
            }
          ),
        },
      };
    });
  },

  updateSet: (exerciseId, setId, updates) => {
    set(s => {
      if (!s.activeSession) return s;
      return {
        activeSession: {
          ...s.activeSession,
          exercises: s.activeSession.exercises.map(ex =>
            ex.id !== exerciseId ? ex : {
              ...ex,
              sets: ex.sets.map(ws =>
                ws.id !== setId ? ws : { ...ws, ...updates }
              ),
            }
          ),
        },
      };
    });
  },

  removeSet: (exerciseId, setId) => {
    set(s => {
      if (!s.activeSession) return s;
      return {
        activeSession: {
          ...s.activeSession,
          exercises: s.activeSession.exercises.map(ex =>
            ex.id !== exerciseId ? ex : {
              ...ex,
              sets: ex.sets.filter(ws => ws.id !== setId),
            }
          ),
        },
      };
    });
  },

  addSet: (exerciseId) => {
    set(s => {
      if (!s.activeSession) return s;
      return {
        activeSession: {
          ...s.activeSession,
          exercises: s.activeSession.exercises.map(ex => {
            if (ex.id !== exerciseId) return ex;
            const lastSet = ex.sets[ex.sets.length - 1];
            const newSet: WorkoutSet = {
              id: generateId(),
              exercise_id: ex.exercise_id,
              set_number: ex.sets.length + 1,
              tag: 'normal',
              target_weight: lastSet?.target_weight ?? null,
              target_reps: lastSet?.target_reps ?? null,
              actual_weight: lastSet?.actual_weight ?? null,
              actual_reps: lastSet?.actual_reps ?? null,
              status: 'pending',
            };
            return { ...ex, sets: [...ex.sets, newSet] };
          }),
        },
      };
    });
  },

  updateExerciseNotes: (exerciseId, notes) => {
    set(s => {
      if (!s.activeSession) return s;
      return {
        activeSession: {
          ...s.activeSession,
          exercises: s.activeSession.exercises.map(ex =>
            ex.id !== exerciseId ? ex : { ...ex, notes }
          ),
        },
      };
    });
  },

  removeExercise: (exerciseId) => {
    set(s => {
      if (!s.activeSession) return s;
      return {
        activeSession: {
          ...s.activeSession,
          exercises: s.activeSession.exercises.filter(ex => ex.id !== exerciseId),
        },
      };
    });
  },

  tickElapsed: () => set(s => ({ elapsedSeconds: s.elapsedSeconds + 1 })),

  startRestTimer: (seconds, exerciseId) => {
    set({ restTimer: { isRunning: true, remaining: seconds, total: seconds, exerciseId } });
  },

  stopRestTimer: () => {
    set({ restTimer: { isRunning: false, remaining: 0, total: 0 } });
  },

  tickTimer: () => {
    set(s => {
      const remaining = s.restTimer.remaining - 1;
      if (remaining <= 0) {
        return { restTimer: { ...s.restTimer, isRunning: false, remaining: 0 } };
      }
      return { restTimer: { ...s.restTimer, remaining } };
    });
  },
}));
