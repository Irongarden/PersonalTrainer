import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { useTheme } from '../../../src/hooks/useTheme';
import { Card, LoadingSpinner, EmptyState } from '../../../src/components/ui';
import {
  FontSize, FontWeight, Spacing, BorderRadius,
} from '../../../src/constants';
import { relativeDate, formatDuration } from '../../../src/utils/calculations';
import type { WorkoutHistory } from '../../../src/types';

async function fetchHistory(userId: string): Promise<WorkoutHistory[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select(`
      id, name, started_at, finished_at, duration_seconds,
      total_volume_kg, template_id, notes,
      workout_exercises(count)
    `)
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []).map((w: any) => ({
    ...w,
    exercise_count: w.workout_exercises?.[0]?.count ?? 0,
    set_count: 0,
    is_synced: true,
  })) as WorkoutHistory[];
}

const HistoryCard: React.FC<{ workout: WorkoutHistory }> = ({ workout }) => {
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={() => router.push(`/(tabs)/history/${workout.id}` as any)}
      activeOpacity={0.8}
    >
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.workoutName, { color: theme.text }]}>{workout.name}</Text>
            <Text style={[styles.workoutDate, { color: theme.textSecondary }]}>
              {relativeDate(workout.started_at)}
            </Text>
          </View>
          <Text style={{ color: theme.textTertiary }}>›</Text>
        </View>

        <View style={styles.statsRow}>
          <StatChip icon="⏱" value={formatDuration(workout.duration_seconds ?? 0)} theme={theme} />
          <StatChip icon="🏋️" value={`${workout.exercise_count} exercises`} theme={theme} />
          {workout.total_volume_kg && (
            <StatChip icon="📊" value={`${Math.round(workout.total_volume_kg)} kg`} theme={theme} />
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const StatChip: React.FC<{ icon: string; value: string; theme: any }> = ({ icon, value, theme }) => (
  <View style={[styles.statChip, { backgroundColor: theme.surfaceHighlight }]}>
    <Text style={{ fontSize: 12 }}>{icon}</Text>
    <Text style={[styles.statValue, { color: theme.textSecondary }]}>{value}</Text>
  </View>
);

export default function HistoryScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();

  const { data: history = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['workout-history', user?.id],
    queryFn: () => fetchHistory(user!.id),
    enabled: !!user?.id,
  });

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: theme.text }]}>History</Text>
      </View>

      {/* Weekly summary */}
      <WeeklySummary workouts={history.slice(0, 30)} theme={theme} />

      <FlatList
        data={history}
        keyExtractor={w => w.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={() => (
          <EmptyState
            icon="📋"
            title="No workouts yet"
            description="Complete your first workout to see your history"
          />
        )}
        renderItem={({ item }) => <HistoryCard workout={item} />}
      />
    </SafeAreaView>
  );
}

function WeeklySummary({ workouts, theme }: { workouts: WorkoutHistory[]; theme: any }) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const thisWeek = workouts.filter(w => new Date(w.started_at) >= weekStart);
  const weekVolume = thisWeek.reduce((s, w) => s + (w.total_volume_kg ?? 0), 0);

  return (
    <View style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <SummaryItem label="This week" value={`${thisWeek.length} workouts`} theme={theme} />
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <SummaryItem label="Volume" value={`${Math.round(weekVolume / 1000)} t`} theme={theme} />
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <SummaryItem label="All time" value={`${workouts.length} sessions`} theme={theme} />
    </View>
  );
}

const SummaryItem: React.FC<{ label: string; value: string; theme: any }> = ({
  label, value, theme,
}) => (
  <View style={styles.summaryItem}>
    <Text style={[styles.summaryValue, { color: theme.text }]}>{value}</Text>
    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  heading: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold },
  list: { padding: Spacing.lg, gap: Spacing.md },
  card: { gap: Spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  workoutName: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  workoutDate: { fontSize: FontSize.sm, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statValue: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  summary: {
    flexDirection: 'row', marginHorizontal: Spacing.lg, marginBottom: Spacing.lg,
    padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1,
    justifyContent: 'space-around',
  },
  summaryItem: { alignItems: 'center', gap: 4 },
  summaryValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  summaryLabel: { fontSize: FontSize.xs },
  divider: { width: 1, height: '80%', alignSelf: 'center' },
});
