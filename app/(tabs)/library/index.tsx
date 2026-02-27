import React, { useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { useTheme } from '../../../src/hooks/useTheme';
import { Card, LoadingSpinner, Badge, Button, EmptyState } from '../../../src/components/ui';
import { FontSize, FontWeight, Spacing, BorderRadius } from '../../../src/constants';
import type { Exercise, MuscleGroup, Equipment } from '../../../src/types';

const MUSCLE_FILTERS: Array<{ key: MuscleGroup | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'chest', label: 'Chest' },
  { key: 'back', label: 'Back' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'triceps', label: 'Triceps' },
  { key: 'core', label: 'Core' },
  { key: 'quads', label: 'Quads' },
  { key: 'hamstrings', label: 'Hamstrings' },
  { key: 'glutes', label: 'Glutes' },
  { key: 'calves', label: 'Calves' },
];

async function fetchExercises(userId: string): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .or(`is_custom.eq.false,user_id.eq.${userId}`)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Exercise[];
}

const ExerciseRow: React.FC<{ exercise: Exercise }> = ({ exercise }) => {
  const theme = useTheme();
  const equipmentEmoji: Record<string, string> = {
    barbell: '🏋️', dumbbell: '🪀', machine: '⚙️',
    cable: '🔗', bodyweight: '🤸', resistance_band: '〰️',
    kettlebell: '⚫', ez_bar: '📊', other: '🔧',
  };

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(tabs)/library/${exercise.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={[styles.row, { borderBottomColor: theme.border }]}>
        <View style={[styles.exerciseIcon, { backgroundColor: theme.surfaceHighlight }]}>
          <Text style={{ fontSize: 20 }}>
            {equipmentEmoji[exercise.equipment] ?? '🔧'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.exerciseName, { color: theme.text }]}>{exercise.name}</Text>
          <Text style={[styles.exerciseMeta, { color: theme.textSecondary }]}>
            {exercise.primary_muscles.slice(0, 2).map(m =>
              m.charAt(0).toUpperCase() + m.slice(1)
            ).join(' · ')}
          </Text>
        </View>
        {exercise.is_custom && (
          <View style={[styles.customBadge, { backgroundColor: theme.primary + '22' }]}>
            <Text style={[styles.customBadgeText, { color: theme.primary }]}>Custom</Text>
          </View>
        )}
        <Text style={{ color: theme.textTertiary }}>›</Text>
      </View>
    </TouchableOpacity>
  );
};

export default function LibraryScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | 'all'>('all');

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ['exercises', user?.id],
    queryFn: () => fetchExercises(user!.id),
    enabled: !!user?.id,
  });

  const filtered = exercises.filter(ex => {
    const matchesSearch = !search ||
      ex.name.toLowerCase().includes(search.toLowerCase());
    const matchesMuscle = muscleFilter === 'all' ||
      ex.primary_muscles.includes(muscleFilter) ||
      ex.secondary_muscles.includes(muscleFilter);
    return matchesSearch && matchesMuscle;
  });

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.heading, { color: theme.text }]}>Exercise Library</Text>
        <Button
          title="+ Custom"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/(tabs)/library/new' as any)}
        />
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        <Text style={{ fontSize: 16 }}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises..."
          placeholderTextColor={theme.textTertiary}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: theme.textSecondary }}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Muscle filter chips */}
      <FlatList
        horizontal
        data={MUSCLE_FILTERS}
        keyExtractor={f => f.key}
        contentContainerStyle={styles.filterList}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setMuscleFilter(item.key)}
            style={[
              styles.filterChip,
              {
                backgroundColor: muscleFilter === item.key ? theme.primary : theme.surfaceHighlight,
                borderColor: muscleFilter === item.key ? theme.primary : theme.border,
              },
            ]}
          >
            <Text style={[
              styles.filterChipText,
              { color: muscleFilter === item.key ? '#fff' : theme.textSecondary },
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Count */}
      <Text style={[styles.countText, { color: theme.textTertiary }]}>
        {filtered.length} exercises
      </Text>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={ex => ex.id}
        renderItem={({ item }) => <ExerciseRow exercise={item} />}
        style={{ flex: 1 }}
        ListEmptyComponent={() => (
          <EmptyState
            icon="🔍"
            title="No exercises found"
            description={search ? `No results for "${search}"` : 'Try a different filter'}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  heading: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: FontSize.md },
  filterList: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  filterChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  countText: { paddingHorizontal: Spacing.lg, fontSize: FontSize.sm, marginBottom: Spacing.xs },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    gap: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseIcon: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  exerciseName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  exerciseMeta: { fontSize: FontSize.sm, marginTop: 2 },
  customBadge: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  customBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
});
