import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Vibration, Platform, AppState,
} from 'react-native';
import { alertDialog, confirmDialog } from '../../src/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useWorkoutStore } from '../../src/stores/workoutStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useTheme } from '../../src/hooks/useTheme';
import {
  Button, Card, Badge, PRBadge, EmptyState,
} from '../../src/components/ui';
import {
  FontSize, FontWeight, Spacing, BorderRadius, TOUCH_TARGET,
} from '../../src/constants';
import {
  formatDuration, formatRestTimer, estimate1RM, generateId,
} from '../../src/utils/calculations';
import type { WorkoutExercise, WorkoutSet, SetTag } from '../../src/types';

// ── Rest Timer Component ──────────────────────

const RestTimer: React.FC<{
  remaining: number;
  total: number;
  onSkip: () => void;
  onAdd30: () => void;
}> = ({ remaining, total, onSkip, onAdd30 }) => {
  const theme = useTheme();
  const progress = total > 0 ? remaining / total : 0;

  return (
    <View style={[styles.restTimer, { backgroundColor: theme.restTimer + '22', borderColor: theme.restTimer }]}>
      <Text style={[styles.restTimerText, { color: theme.restTimer }]}>
        Rest · {formatRestTimer(remaining)}
      </Text>
      <View style={[styles.restTimerBar, { backgroundColor: theme.surfaceHighlight }]}>
        <View style={[
          styles.restTimerFill,
          { backgroundColor: theme.restTimer, width: `${progress * 100}%` },
        ]} />
      </View>
      <View style={styles.restTimerActions}>
        <TouchableOpacity onPress={onAdd30} style={[styles.restBtn, { borderColor: theme.restTimer }]}>
          <Text style={[styles.restBtnText, { color: theme.restTimer }]}>+30s</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip} style={[styles.restBtn, { borderColor: theme.restTimer }]}>
          <Text style={[styles.restBtnText, { color: theme.restTimer }]}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Set Row Component ─────────────────────────

interface SetRowProps {
  set: WorkoutSet;
  index: number;
  previous?: { reps?: number; weight?: number };
  onComplete: () => void;
  onUpdate: (updates: Partial<WorkoutSet>) => void;
  onDelete: () => void;
  isPR?: boolean;
}

const SetRow: React.FC<SetRowProps> = ({
  set, index, previous, onComplete, onUpdate, onDelete, isPR,
}) => {
  const theme = useTheme();
  const isCompleted = set.status === 'completed';

  const tagColors: Record<SetTag, string> = {
    warmup: theme.warmup,
    working: theme.primary,
    failure: theme.failure,
    drop: theme.drop,
    normal: theme.textTertiary,
  };

  return (
    <View style={[
      styles.setRow,
      { backgroundColor: isCompleted ? theme.setCompleted + '18' : 'transparent' },
    ]}>
      {/* Set number / tag */}
      <TouchableOpacity
        style={[styles.setIndex, { borderColor: tagColors[set.tag] }]}
        onLongPress={() => {
          // TODO: tag picker sheet
        }}
      >
        <Text style={[styles.setIndexText, { color: tagColors[set.tag] }]}>
          {set.tag === 'warmup' ? 'W' : set.tag === 'failure' ? 'F' : set.tag === 'drop' ? 'D' : `${index + 1}`}
        </Text>
      </TouchableOpacity>

      {/* Previous performance */}
      <Text style={[styles.setPrevious, { color: theme.textTertiary }]} numberOfLines={1}>
        {previous
          ? `${previous.weight ?? '–'} × ${previous.reps ?? '–'}`
          : '—'}
      </Text>

      {/* Weight input */}
      <View style={[styles.setInput, { borderColor: isCompleted ? theme.setCompleted : theme.border }]}>
        <TextInput
          style={[styles.setInputText, { color: theme.text }]}
          value={set.actual_weight != null ? String(set.actual_weight) : ''}
          onChangeText={v => onUpdate({ actual_weight: v ? parseFloat(v) : undefined })}
          keyboardType="decimal-pad"
          placeholder="kg"
          placeholderTextColor={theme.textTertiary}
          editable={!isCompleted}
          selectTextOnFocus
        />
      </View>

      <Text style={[styles.setSeparator, { color: theme.textTertiary }]}>×</Text>

      {/* Reps input */}
      <View style={[styles.setInput, { borderColor: isCompleted ? theme.setCompleted : theme.border }]}>
        <TextInput
          style={[styles.setInputText, { color: theme.text }]}
          value={set.actual_reps != null ? String(set.actual_reps) : ''}
          onChangeText={v => onUpdate({ actual_reps: v ? parseInt(v, 10) : undefined })}
          keyboardType="number-pad"
          placeholder="reps"
          placeholderTextColor={theme.textTertiary}
          editable={!isCompleted}
          selectTextOnFocus
        />
      </View>

      {/* PR indicator */}
      {isPR && <Text style={{ fontSize: 16 }}>🏆</Text>}

      {/* Complete / delete */}
      <TouchableOpacity
        onPress={isCompleted ? undefined : onComplete}
        onLongPress={onDelete}
        style={[
          styles.setCheck,
          {
            backgroundColor: isCompleted ? theme.setCompleted : 'transparent',
            borderColor: isCompleted ? theme.setCompleted : theme.border,
          },
        ]}
        activeOpacity={0.7}
      >
        {isCompleted && <Text style={styles.setCheckMark}>✓</Text>}
      </TouchableOpacity>
    </View>
  );
};

// ── Exercise Card ─────────────────────────────

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  defaultRestSeconds: number;
  onCompleteSet: (setId: string) => void;
  onUpdateSet: (setId: string, updates: Partial<WorkoutSet>) => void;
  onDeleteSet: (setId: string) => void;
  onAddSet: () => void;
  onUpdateNotes: (notes: string) => void;
  onRemove: () => void;
  onStartRest: (seconds: number) => void;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise, defaultRestSeconds,
  onCompleteSet, onUpdateSet, onDeleteSet, onAddSet,
  onUpdateNotes, onRemove, onStartRest,
}) => {
  const theme = useTheme();
  const [showNotes, setShowNotes] = useState(!!exercise.notes);
  const completedCount = exercise.sets.filter(s => s.status === 'completed').length;

  return (
    <Card style={styles.exerciseCard}>
      {/* Exercise header */}
      <View style={styles.exHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.exName, { color: theme.text }]}>
            {exercise.exercise?.name ?? 'Exercise'}
          </Text>
          <Text style={[styles.exMeta, { color: theme.textSecondary }]}>
            {exercise.exercise?.primary_muscles?.join(', ') ?? ''}
          </Text>
        </View>
        <View style={styles.exHeaderRight}>
          <Text style={[styles.exProgress, { color: theme.primary }]}>
            {completedCount}/{exercise.sets.length}
          </Text>
          <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
            <Text style={{ color: theme.textTertiary }}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Previous header */}
      <View style={styles.setHeader}>
        <Text style={[styles.setHeaderLabel, { color: theme.textTertiary, flex: 0, width: 32 }]}>SET</Text>
        <Text style={[styles.setHeaderLabel, { color: theme.textTertiary, flex: 1 }]}>PREV</Text>
        <Text style={[styles.setHeaderLabel, { color: theme.textTertiary, width: 64 }]}>KG</Text>
        <Text style={[styles.setHeaderLabel, { color: theme.textTertiary, width: 8 }]}></Text>
        <Text style={[styles.setHeaderLabel, { color: theme.textTertiary, width: 56 }]}>REPS</Text>
        <Text style={[styles.setHeaderLabel, { color: theme.textTertiary, width: 44 }]}></Text>
      </View>

      {/* Sets */}
      {exercise.sets.map((set, idx) => {
        const prevSet = exercise.previous?.sets?.[idx];
        const current1rm = set.actual_weight && set.actual_reps
          ? estimate1RM(set.actual_weight, set.actual_reps) : 0;
        const prev1rm = prevSet?.weight && prevSet?.reps
          ? estimate1RM(prevSet.weight, prevSet.reps) : 0;
        const isPR = current1rm > 0 && current1rm > prev1rm;

        return (
          <SetRow
            key={set.id}
            set={set}
            index={idx}
            previous={prevSet}
            isPR={isPR && set.status === 'completed'}
            onComplete={() => {
              onCompleteSet(set.id);
              // Auto-start rest timer
              const restSeconds = set.actual_weight
                ? defaultRestSeconds
                : 60;
              onStartRest(restSeconds);
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            }}
            onUpdate={(updates) => onUpdateSet(set.id, updates)}
            onDelete={() => {
              onDeleteSet(set.id);
            }}
          />
        );
      })}

      {/* Add set */}
      <TouchableOpacity
        onPress={onAddSet}
        style={[styles.addSetBtn, { borderColor: theme.border }]}
      >
        <Text style={[styles.addSetText, { color: theme.primary }]}>+ Add Set</Text>
      </TouchableOpacity>

      {/* Notes */}
      <TouchableOpacity onPress={() => setShowNotes(!showNotes)} style={styles.notesToggle}>
        <Text style={[styles.notesToggleText, { color: theme.textSecondary }]}>
          {showNotes ? '▲ Hide notes' : '▼ Add notes'}
        </Text>
      </TouchableOpacity>

      {showNotes && (
        <TextInput
          style={[styles.notesInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
          value={exercise.notes ?? ''}
          onChangeText={onUpdateNotes}
          placeholder="Notes for this exercise..."
          placeholderTextColor={theme.textTertiary}
          multiline
        />
      )}
    </Card>
  );
};

// ── Main Workout Session Screen ───────────────

export default function WorkoutSessionScreen() {
  const theme = useTheme();
  const { profile } = useAuthStore();
  const {
    activeSession, elapsedSeconds,
    restTimer,
    completeSet, updateSet, removeSet, addSet,
    updateExerciseNotes, removeExercise,
    startRestTimer, stopRestTimer, tickTimer, tickElapsed,
    finishWorkout, discardWorkout,
    isFinishing,
  } = useWorkoutStore();

  // Timers
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    elapsedRef.current = setInterval(() => tickElapsed(), 1000);
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, []);

  useEffect(() => {
    if (restTimer.isRunning) {
      restRef.current = setInterval(() => tickTimer(), 1000);
    } else {
      if (restRef.current) clearInterval(restRef.current);
      // Rest finished notification
      if (!restTimer.isRunning && restTimer.remaining === 0 && restTimer.total > 0) {
        Vibration.vibrate(500);
      }
    }
    return () => { if (restRef.current) clearInterval(restRef.current); };
  }, [restTimer.isRunning]);

  const handleFinish = async () => {
    const totalCompleted = activeSession?.exercises.reduce((sum, ex) =>
      sum + ex.sets.filter(s => s.status === 'completed').length, 0) ?? 0;

    if (totalCompleted === 0) {
      confirmDialog(
        'No sets completed',
        "You haven't completed any sets. Discard workout?",
        () => { discardWorkout(); router.back(); },
        { confirmText: 'Discard', cancelText: 'Cancel', destructive: true }
      );
      return;
    }

    confirmDialog(
      'Finish Workout',
      `Complete this workout? ${totalCompleted} sets done.`,
      async () => {
        try {
          await finishWorkout();
          router.back();
        } catch {
          alertDialog('Error', 'Failed to save workout. Please try again.');
        }
      },
      { confirmText: 'Finish 🏁', cancelText: 'Cancel' }
    );
  };

  const handleDiscard = () => {
    confirmDialog(
      'Discard Workout',
      'All progress will be lost.',
      () => { discardWorkout(); router.back(); },
      { confirmText: 'Discard', cancelText: 'Cancel', destructive: true }
    );
  };

  if (!activeSession) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <EmptyState
          icon="😕"
          title="No active workout"
          action={<Button title="Go Back" onPress={() => router.back()} />}
        />
      </SafeAreaView>
    );
  }

  const defaultRest = profile?.default_rest_seconds ?? 90;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.sessionHeader, { borderBottomColor: theme.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sessionName, { color: theme.text }]} numberOfLines={1}>
            {activeSession.name}
          </Text>
          <Text style={[styles.sessionDuration, { color: theme.primary }]}>
            ⏱ {formatDuration(elapsedSeconds)}
          </Text>
        </View>
        <View style={styles.sessionHeaderActions}>
          <Button
            title="Finish"
            size="sm"
            onPress={handleFinish}
            loading={isFinishing}
          />
          <TouchableOpacity onPress={handleDiscard} style={styles.discardBtn}>
            <Text style={{ color: theme.error, fontWeight: FontWeight.medium }}>Discard</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rest timer */}
      {restTimer.isRunning && (
        <RestTimer
          remaining={restTimer.remaining}
          total={restTimer.total}
          onSkip={stopRestTimer}
          onAdd30={() => startRestTimer(restTimer.remaining + 30)}
        />
      )}

      {/* Exercise list */}
      <ScrollView
        contentContainerStyle={styles.exerciseList}
        keyboardShouldPersistTaps="handled"
      >
        {activeSession.exercises.length === 0 ? (
          <EmptyState
            icon="➕"
            title="No exercises"
            description="Add exercises from the library to start logging"
          />
        ) : (
          activeSession.exercises.map(ex => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              defaultRestSeconds={defaultRest}
              onCompleteSet={(setId) => completeSet(ex.id, setId)}
              onUpdateSet={(setId, updates) => updateSet(ex.id, setId, updates)}
              onDeleteSet={(setId) => removeSet(ex.id, setId)}
              onAddSet={() => addSet(ex.id)}
              onUpdateNotes={(notes) => updateExerciseNotes(ex.id, notes)}
              onRemove={() => {
                confirmDialog(
                  'Remove exercise?',
                  ex.exercise?.name ?? '',
                  () => removeExercise(ex.id),
                  { confirmText: 'Remove', destructive: true }
                );
              }}
              onStartRest={(seconds) => startRestTimer(seconds, ex.id)}
            />
          ))
        )}

        {/* Bottom padding for scrolling past keyboard */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Volume summary bar */}
      <View style={[styles.volumeBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <VolumeChip
          label="Volume"
          value={`${Math.round(
            activeSession.exercises.reduce((sum, ex) =>
              sum + ex.sets.filter(s => s.status === 'completed')
                .reduce((s2, set) => s2 + (set.actual_weight ?? 0) * (set.actual_reps ?? 0), 0),
              0)
          )} kg`}
          theme={theme}
        />
        <VolumeChip
          label="Sets"
          value={String(activeSession.exercises.reduce((sum, ex) =>
            sum + ex.sets.filter(s => s.status === 'completed').length, 0))}
          theme={theme}
        />
        <VolumeChip
          label="PRs"
          value={String(activeSession.pr_events?.length ?? 0)}
          theme={theme}
          highlight
        />
      </View>
    </SafeAreaView>
  );
}

const VolumeChip: React.FC<{
  label: string; value: string; theme: any; highlight?: boolean;
}> = ({ label, value, theme, highlight }) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={{ color: highlight ? theme.pr : theme.text, fontWeight: FontWeight.bold, fontSize: FontSize.lg }}>
      {value}
    </Text>
    <Text style={{ color: theme.textTertiary, fontSize: FontSize.xs }}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  sessionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, gap: Spacing.sm,
  },
  sessionName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  sessionDuration: { fontSize: FontSize.sm, marginTop: 2 },
  sessionHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  discardBtn: { padding: Spacing.sm },
  restTimer: {
    margin: Spacing.lg, padding: Spacing.md,
    borderRadius: BorderRadius.md, borderWidth: 1,
    gap: Spacing.sm,
  },
  restTimerText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  restTimerBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  restTimerFill: { height: '100%', borderRadius: 3 },
  restTimerActions: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.md },
  restBtn: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md, borderWidth: 1,
  },
  restBtnText: { fontWeight: FontWeight.semibold },
  exerciseList: { padding: Spacing.lg, gap: Spacing.lg },
  exerciseCard: { gap: Spacing.sm },
  exHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm },
  exName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  exMeta: { fontSize: FontSize.sm, marginTop: 2 },
  exHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  exProgress: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  removeBtn: { padding: Spacing.sm },
  setHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: Spacing.xs, gap: 4,
  },
  setHeaderLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.medium,
    letterSpacing: 0.8, textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.xs, gap: 4,
    borderRadius: BorderRadius.sm, paddingHorizontal: 2,
  },
  setIndex: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  setIndexText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  setPrevious: { flex: 1, fontSize: FontSize.sm, textAlign: 'center' },
  setInput: {
    width: 60, height: 36,
    borderWidth: 1, borderRadius: BorderRadius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  setInputText: {
    fontSize: FontSize.md, fontWeight: FontWeight.medium,
    textAlign: 'center', width: '100%', paddingHorizontal: 4,
  },
  setSeparator: { fontSize: FontSize.md, width: 10, textAlign: 'center' },
  setCheck: {
    width: 36, height: 36, borderRadius: BorderRadius.sm,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  setCheckMark: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.md },
  addSetBtn: {
    padding: Spacing.sm, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', marginTop: Spacing.sm,
  },
  addSetText: { fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  notesToggle: { paddingVertical: Spacing.xs },
  notesToggleText: { fontSize: FontSize.sm },
  notesInput: {
    borderWidth: 1, borderRadius: BorderRadius.sm,
    padding: Spacing.sm, fontSize: FontSize.sm, minHeight: 60,
  },
  volumeBar: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: Spacing.md, borderTopWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
});
