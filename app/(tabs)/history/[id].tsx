import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Share,
} from "react-native";
import { alertDialog, confirmDialog } from "@/utils/alert";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useTheme, Theme } from "@/hooks/useTheme";
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from "@/constants";
import { formatDuration } from "@/utils/calculations";
import { format, parseISO } from "date-fns";

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const colors = useTheme();
  const s = styles(colors);
  const qc = useQueryClient();

  // ── Fetch workout ───────────────────────────────────────────
  const { data: workout, isLoading } = useQuery({
    queryKey: ["workout-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workouts")
        .select(`
          id, name, started_at, ended_at, duration_seconds,
          total_volume_kg, notes,
          workout_exercises (
            id, order_index, notes,
            exercises ( id, name, equipment ),
            workout_sets (
              id, set_number, weight_kg, reps, rpe, tag, is_completed, is_pr,
              estimated_1rm, completed_at
            )
          )
        `)
        .eq("id", id)
        .eq("user_id", user?.id ?? "")
        .single();
      if (error) throw error;

      // Sort exercises and sets
      if (data?.workout_exercises) {
        data.workout_exercises.sort(
          (a: any, b: any) => a.order_index - b.order_index
        );
        data.workout_exercises.forEach((ex: any) => {
          if (ex.workout_sets) {
            ex.workout_sets.sort((a: any, b: any) => a.set_number - b.set_number);
          }
        });
      }
      return data;
    },
    enabled: !!id && !!user,
  });

  // ── Delete workout ──────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("workouts")
        .delete()
        .eq("id", id)
        .eq("user_id", user?.id ?? "");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout-history"] });
      router.back();
    },
    onError: (e: any) => alertDialog("Error", e.message),
  });

  const handleDelete = () => {
    confirmDialog(
      "Delete Workout",
      "This will permanently delete this workout and all its sets. This cannot be undone.",
      () => deleteMutation.mutate(),
      { confirmText: "Delete", cancelText: "Cancel" }
    );
  };

  const handleShare = async () => {
    if (!workout) return;
    const lines = [
      `💪 ${workout.name}`,
      `📅 ${format(parseISO(workout.started_at), "EEEE, MMM d yyyy")}`,
      `⏱ ${formatDuration(workout.duration_seconds)}`,
      `📦 ${workout.total_volume_kg?.toLocaleString() ?? 0} kg total volume`,
      "",
      ...workout.workout_exercises.map((ex: any) => {
        const sets = ex.workout_sets
          .filter((s: any) => s.is_completed)
          .map((s: any) => `  ${s.set_number}. ${s.weight_kg}kg × ${s.reps}${s.is_pr ? " 🏆" : ""}`)
          .join("\n");
        return `${ex.exercises.name}\n${sets}`;
      }),
      "",
      "Logged with PersonalCoach 🏋️",
    ];
    await Share.share({ message: lines.join("\n") });
  };

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Workout not found.</Text>
      </View>
    );
  }

  const completedSets = workout.workout_exercises.flatMap((ex: any) =>
    ex.workout_sets.filter((s: any) => s.is_completed)
  );
  const prCount = completedSets.filter((s: any) => s.is_pr).length;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.headerCard}>
        <Text style={s.workoutName}>{workout.name}</Text>
        <Text style={s.workoutDate}>
          {format(parseISO(workout.started_at), "EEEE, MMMM d yyyy")}
        </Text>

        <View style={s.statsRow}>
          <StatPill
            label="Duration"
            value={formatDuration(workout.duration_seconds ?? 0)}
            colors={colors}
          />
          <StatPill
            label="Volume"
            value={`${(workout.total_volume_kg ?? 0).toLocaleString()} kg`}
            colors={colors}
          />
          <StatPill
            label="Sets"
            value={String(completedSets.length)}
            colors={colors}
          />
          {prCount > 0 && (
            <StatPill label="PRs" value={`${prCount} 🏆`} colors={colors} />
          )}
        </View>
      </View>

      {/* Exercises */}
      {workout.workout_exercises.map((ex: any) => {
        const doneSets = ex.workout_sets.filter((s: any) => s.is_completed);
        return (
          <View key={ex.id} style={s.exerciseCard}>
            <Text style={s.exerciseName}>{ex.exercises.name}</Text>
            {ex.notes ? (
              <Text style={s.exerciseNote}>{ex.notes}</Text>
            ) : null}

            {/* Set table */}
            <View style={s.setHeader}>
              <Text style={[s.setCol, s.setColSet]}>Set</Text>
              <Text style={[s.setCol, s.setColWeight]}>Weight</Text>
              <Text style={[s.setCol, s.setColReps]}>Reps</Text>
              <Text style={[s.setCol, s.setColE1RM]}>e1RM</Text>
              <Text style={[s.setCol, s.setColRpe]}>RPE</Text>
            </View>
            {doneSets.map((set: any) => (
              <View key={set.id} style={s.setRow}>
                <Text style={[s.setCol, s.setColSet, s.setNum]}>
                  {set.set_number}
                  {set.is_pr ? " 🏆" : ""}
                </Text>
                <Text style={[s.setCol, s.setColWeight, s.setText]}>
                  {set.weight_kg} kg
                </Text>
                <Text style={[s.setCol, s.setColReps, s.setText]}>
                  {set.reps}
                </Text>
                <Text style={[s.setCol, s.setColE1RM, s.setText]}>
                  {set.estimated_1rm
                    ? `${Number(set.estimated_1rm).toFixed(1)}`
                    : "—"}
                </Text>
                <Text style={[s.setCol, s.setColRpe, s.setText]}>
                  {set.rpe ? `${set.rpe}` : "—"}
                </Text>
              </View>
            ))}
          </View>
        );
      })}

      {/* Notes */}
      {workout.notes ? (
        <View style={s.notesCard}>
          <Text style={s.notesLabel}>Workout Notes</Text>
          <Text style={s.notesText}>{workout.notes}</Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={s.actions}>
        <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
          <Text style={s.shareBtnText}>📤 Share Workout</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
          <Text style={s.deleteBtnText}>🗑 Delete</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function StatPill({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: Theme;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surfaceElevated,
        borderRadius: BorderRadius.sm,
        paddingHorizontal: 12,
        paddingVertical: 6,
        alignItems: "center",
      }}
    >
      <Text
        style={{ color: colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.bold }}
      >
        {value}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: FontSize.xs }}>
        {label}
      </Text>
    </View>
  );
}

const styles = (colors: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: Spacing.md, paddingBottom: 60 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    errorText: { color: colors.textSecondary },
    headerCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    workoutName: {
      color: colors.text,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
    },
    workoutDate: {
      color: colors.textSecondary,
      fontSize: FontSize.sm,
      marginTop: 2,
      marginBottom: Spacing.md,
    },
    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    exerciseCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    exerciseName: {
      color: colors.text,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      marginBottom: 4,
    },
    exerciseNote: {
      color: colors.textSecondary,
      fontSize: FontSize.xs,
      marginBottom: Spacing.sm,
      fontStyle: "italic",
    },
    setHeader: {
      flexDirection: "row",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingBottom: 4,
      marginBottom: 4,
    },
    setRow: { flexDirection: "row", paddingVertical: 4 },
    setCol: { fontSize: FontSize.xs },
    setColSet: { width: 40 },
    setColWeight: { flex: 1 },
    setColReps: { width: 44 },
    setColE1RM: { width: 56 },
    setColRpe: { width: 36 },
    setNum: { color: colors.textSecondary },
    setText: { color: colors.text },
    notesCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    notesLabel: {
      color: colors.textSecondary,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    notesText: { color: colors.text, fontSize: FontSize.sm },
    actions: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    shareBtn: {
      flex: 1,
      backgroundColor: colors.surfaceElevated,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      alignItems: "center",
    },
    shareBtnText: { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    deleteBtn: {
      backgroundColor: colors.errorMuted,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      paddingHorizontal: Spacing.lg,
      alignItems: "center",
    },
    deleteBtnText: { color: colors.error, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  });
