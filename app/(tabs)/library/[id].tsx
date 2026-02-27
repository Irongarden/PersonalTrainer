import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useTheme, Theme } from "@/hooks/useTheme";
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from "@/constants";
import { estimate1RM } from "@/utils/calculations";
import { format, parseISO } from "date-fns";

const EQUIPMENT_EMOJI: Record<string, string> = {
  barbell: "🏋️",
  dumbbell: "💪",
  cable: "🔗",
  machine: "⚙️",
  bodyweight: "🤸",
  ez_bar: "〰️",
  other: "🔩",
};

const MUSCLE_LABEL: Record<string, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  core: "Core",
  cardio: "Cardio",
  forearms: "Forearms",
  hip_flexors: "Hip Flexors",
};

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const colors = useTheme();
  const s = styles(colors);

  // ── Fetch exercise ──────────────────────────────────────────
  const { data: exercise, isLoading: loadingEx } = useQuery({
    queryKey: ["exercise", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ── Fetch set history for this exercise ────────────────────
  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ["exercise-history", id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_sets")
        .select(`
          id, weight_kg, reps, estimated_1rm, is_pr, completed_at,
          workout_exercises!inner(
            exercise_id,
            workouts!inner(
              started_at, name, user_id
            )
          )
        `)
        .eq("workout_exercises.exercise_id", id)
        .eq("workout_exercises.workouts.user_id", user?.id ?? "")
        .eq("is_completed", true)
        .order("completed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id && !!user,
  });

  // ── Derived stats ───────────────────────────────────────────
  const stats = useMemo(() => {
    if (!history || history.length === 0) return null;

    const allSets = history.filter((s: any) => s.reps > 0 && s.weight_kg > 0);
    if (allSets.length === 0) return null;

    const allE1RMs = allSets.map((s: any) =>
      s.estimated_1rm ?? estimate1RM(s.weight_kg, s.reps)
    );
    const bestE1RM = Math.max(...allE1RMs);
    const bestSet = allSets.find(
      (_: any, i: number) => allE1RMs[i] === bestE1RM
    );
    const maxWeight = Math.max(...allSets.map((s: any) => s.weight_kg));
    const totalSets = allSets.length;

    // Group by workout date for chart
    const byDate: Record<string, number> = {};
    allSets.forEach((s: any, i: number) => {
      const date =
        s.completed_at?.split("T")[0] ??
        (s.workout_exercises as any)?.workouts?.started_at?.split("T")[0] ??
        "";
      if (date && (byDate[date] === undefined || allE1RMs[i] > byDate[date])) {
        byDate[date] = allE1RMs[i];
      }
    });

    const chartData = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12); // last 12 sessions

    return { bestE1RM, bestSet, maxWeight, totalSets, chartData };
  }, [history]);

  if (loadingEx) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!exercise) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Exercise not found.</Text>
      </View>
    );
  }

  const chartMax =
    stats && stats.chartData.length > 0
      ? Math.max(...stats.chartData.map(([, v]) => v))
      : 1;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.emoji}>
          {EQUIPMENT_EMOJI[exercise.equipment] ?? "🔩"}
        </Text>
        <Text style={s.title}>{exercise.name}</Text>
        <Text style={s.subtitle}>
          {exercise.equipment} •{" "}
          {[...exercise.primary_muscles, ...exercise.secondary_muscles]
            .map((m: string) => MUSCLE_LABEL[m] ?? m)
            .join(", ")}
        </Text>
        {exercise.is_custom && (
          <View style={s.customBadge}>
            <Text style={s.customBadgeText}>Custom</Text>
          </View>
        )}
      </View>

      {/* Instructions */}
      {exercise.instructions ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>How to perform</Text>
          <Text style={s.instructions}>{exercise.instructions}</Text>
        </View>
      ) : null}

      {/* Stats */}
      {loadingHistory ? (
        <View style={s.card}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : stats ? (
        <>
          <View style={s.statsRow}>
            <StatBox
              label="Best e1RM"
              value={`${stats.bestE1RM.toFixed(1)} kg`}
              colors={colors}
            />
            <StatBox
              label="Max Weight"
              value={`${stats.maxWeight} kg`}
              colors={colors}
            />
            <StatBox
              label="Total Sets"
              value={String(stats.totalSets)}
              colors={colors}
            />
          </View>

          {/* Simple bar chart */}
          {stats.chartData.length > 1 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Estimated 1RM Progress</Text>
              <View style={s.chart}>
                {stats.chartData.map(([date, value]) => {
                  const pct = value / chartMax;
                  const barH = Math.max(4, pct * 120);
                  const isLast =
                    date === stats.chartData[stats.chartData.length - 1][0];
                  return (
                    <View key={date} style={s.barWrapper}>
                      <Text style={s.barValue}>{value.toFixed(0)}</Text>
                      <View
                        style={[
                          s.bar,
                          {
                            height: barH,
                            backgroundColor: isLast
                              ? colors.primary
                              : colors.primaryMuted,
                          },
                        ]}
                      />
                      <Text style={s.barDate}>
                        {format(parseISO(date), "d/M")}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Recent sets */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Recent Sets</Text>
            {(history ?? []).slice(0, 10).map((set: any) => (
              <View key={set.id} style={s.setRow}>
                <Text style={s.setDate}>
                  {set.completed_at
                    ? format(parseISO(set.completed_at), "dd MMM")
                    : "—"}
                </Text>
                <Text style={s.setInfo}>
                  {set.weight_kg} kg × {set.reps} reps
                </Text>
                <Text style={s.setE1RM}>
                  e1RM:{" "}
                  {(
                    set.estimated_1rm ?? estimate1RM(set.weight_kg, set.reps)
                  ).toFixed(1)}{" "}
                  kg
                </Text>
                {set.is_pr && <Text style={s.prBadge}>🏆 PR</Text>}
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={s.card}>
          <Text style={s.noDataText}>
            No history yet for this exercise.{"\n"}Log your first set!
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Sub-component ─────────────────────────────────────────────
function StatBox({
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
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        alignItems: "center",
        marginHorizontal: 4,
      }}
    >
      <Text
        style={{
          color: colors.primary,
          fontSize: FontSize.lg,
          fontWeight: FontWeight.bold,
        }}
      >
        {value}
      </Text>
      <Text
        style={{ color: colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = (colors: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: Spacing.md, paddingBottom: 40 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    errorText: { color: colors.textSecondary },
    header: { alignItems: "center", marginBottom: Spacing.lg },
    emoji: { fontSize: 48, marginBottom: Spacing.sm },
    title: {
      color: colors.text,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      textAlign: "center",
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: FontSize.sm,
      textAlign: "center",
      marginTop: Spacing.xs,
      textTransform: "capitalize",
    },
    customBadge: {
      backgroundColor: colors.primaryMuted,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 2,
      marginTop: Spacing.xs,
    },
    customBadgeText: { color: colors.primary, fontSize: FontSize.xs },
    card: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    cardTitle: {
      color: colors.text,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      marginBottom: Spacing.sm,
    },
    instructions: {
      color: colors.textSecondary,
      fontSize: FontSize.sm,
      lineHeight: 22,
    },
    statsRow: {
      flexDirection: "row",
      marginBottom: Spacing.md,
      marginHorizontal: -4,
    },
    // Chart
    chart: {
      flexDirection: "row",
      alignItems: "flex-end",
      height: 160,
      gap: 4,
      paddingTop: Spacing.lg,
    },
    barWrapper: { flex: 1, alignItems: "center" },
    barValue: {
      color: colors.textSecondary,
      fontSize: 8,
      marginBottom: 2,
    },
    bar: { width: "100%", borderRadius: 3 },
    barDate: { color: colors.textSecondary, fontSize: 8, marginTop: 4 },
    // Sets
    setRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 8,
    },
    setDate: { color: colors.textSecondary, fontSize: FontSize.xs, width: 52 },
    setInfo: { color: colors.text, fontSize: FontSize.sm, flex: 1 },
    setE1RM: { color: colors.textSecondary, fontSize: FontSize.xs },
    prBadge: { fontSize: FontSize.xs },
    noDataText: {
      color: colors.textSecondary,
      textAlign: "center",
      fontSize: FontSize.sm,
      lineHeight: 22,
    },
  });
