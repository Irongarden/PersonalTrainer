import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { useWorkoutStore } from '../../../src/stores/workoutStore';
import { confirmDialog, promptDialog, alertDialog } from '../../../src/utils/alert';
import { useTheme } from '../../../src/hooks/useTheme';
import { Button, Card, EmptyState, LoadingSpinner } from '../../../src/components/ui';
import {
  FontSize, FontWeight, Spacing, BorderRadius,
} from '../../../src/constants';
import type { Template } from '../../../src/types';
import { relativeDate, formatDuration } from '../../../src/utils/calculations';

// ── Data fetching ─────────────────────────────

async function fetchTemplates(userId: string): Promise<Template[]> {
  const { data, error } = await supabase
    .from('templates')
    .select(`
      *,
      template_exercises(
        *,
        exercises(*),
        template_sets(*)
      )
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((t: any) => ({
    ...t,
    exercises: (t.template_exercises ?? [])
      .sort((a: any, b: any) => (a.order_index ?? a.order ?? 0) - (b.order_index ?? b.order ?? 0))
      .map((te: any) => ({
        ...te,
        exercise: Array.isArray(te.exercises) ? te.exercises[0] : te.exercises,
        sets: (te.template_sets ?? []).sort((a: any, b: any) =>
          (a.set_number ?? a.order ?? 0) - (b.set_number ?? b.order ?? 0)
        ),
      }))
      .filter((te: any) => te.exercise != null),
  })) as Template[];
}

// ── Template Card ─────────────────────────────

interface TemplateCardProps {
  template: Template;
  onStart: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template, onStart, onEdit, onDuplicate, onDelete,
}) => {
  const theme = useTheme();
  const exerciseNames = template.exercises
    .slice(0, 3)
    .map(e => e.exercise?.name ?? '?')
    .join(' · ');
  const more = template.exercises.length > 3
    ? ` +${template.exercises.length - 3} more` : '';

  return (
    <Card style={styles.card}>
      <TouchableOpacity onPress={onEdit} activeOpacity={0.8}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.templateName, { color: theme.text }]}>{template.name}</Text>
            <Text style={[styles.exerciseList, { color: theme.textSecondary }]} numberOfLines={1}>
              {exerciseNames}{more}
            </Text>
          </View>
          {template.last_used_at && (
            <Text style={[styles.lastUsed, { color: theme.textTertiary }]}>
              {relativeDate(template.last_used_at)}
            </Text>
          )}
        </View>

        <View style={styles.metaRow}>
          <MetaChip icon="🏋️" label={`${template.exercises.length} exercises`} theme={theme} />
          {template.estimated_duration_minutes && (
            <MetaChip icon="⏱" label={`~${template.estimated_duration_minutes}m`} theme={theme} />
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.cardActions}>
        <Button
          title="Start"
          onPress={onStart}
          size="sm"
          style={{ flex: 1 }}
        />
        <ActionBtn icon="✏️" onPress={onEdit} theme={theme} />
        <ActionBtn icon="📋" onPress={onDuplicate} theme={theme} />
        <ActionBtn icon="🗑️" onPress={onDelete} theme={theme} />
      </View>
    </Card>
  );
};

const MetaChip: React.FC<{ icon: string; label: string; theme: any }> = ({ icon, label, theme }) => (
  <View style={[styles.metaChip, { backgroundColor: theme.surfaceHighlight }]}>
    <Text style={styles.metaIcon}>{icon}</Text>
    <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>{label}</Text>
  </View>
);

const ActionBtn: React.FC<{ icon: string; onPress: () => void; theme: any }> = ({
  icon, onPress, theme,
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.actionBtn, { backgroundColor: theme.surfaceHighlight }]}
    activeOpacity={0.7}
  >
    <Text style={{ fontSize: FontSize.md }}>{icon}</Text>
  </TouchableOpacity>
);

// ── Main Screen ───────────────────────────────

export default function WorkoutsScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const { activeSession, startFromTemplate, startEmpty } = useWorkoutStore();
  const qc = useQueryClient();

  const { data: templates = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['templates', user?.id],
    queryFn: () => fetchTemplates(user!.id),
    enabled: !!user?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('templates').delete().eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (template: Template) => {
      const newId = Math.random().toString(36).slice(2);
      await supabase.from('templates').insert({
        id: newId,
        user_id: template.user_id,
        name: `${template.name} (copy)`,
        description: template.description,
        estimated_duration_minutes: template.estimated_duration_minutes,
      });

      for (const ex of template.exercises) {
        const exId = Math.random().toString(36).slice(2);
        await supabase.from('template_exercises').insert({
          id: exId,
          template_id: newId,
          exercise_id: ex.exercise_id,
          order: ex.order,
          superset_group: ex.superset_group,
          notes: ex.notes,
        });

        for (const s of ex.sets) {
          await supabase.from('template_sets').insert({
            id: Math.random().toString(36).slice(2),
            template_exercise_id: exId,
            order: s.order,
            target_reps: s.target_reps,
            target_reps_max: s.target_reps_max,
            target_weight: s.target_weight,
            rest_seconds: s.rest_seconds,
            tag: s.tag,
          });
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });

  const handleStart = async (template: Template) => {
    if (activeSession) {
      alertDialog('Workout in progress', 'You have an active workout. Finish it first or discard it.');
      return;
    }
    if (!user) return;
    await startFromTemplate(template, user.id);
    router.push('/workout/session');
  };

  const handleDelete = (template: Template) => {
    confirmDialog(
      'Delete Template',
      `Delete "${template.name}"? This cannot be undone.`,
      () => deleteMutation.mutate(template.id),
      { confirmText: 'Delete', destructive: true }
    );
  };

  const handleStartEmpty = () => {
    if (activeSession) {
      router.push('/workout/session');
      return;
    }
    if (!user) return;
    promptDialog(
      'Workout Name',
      'Name your workout',
      (name) => {
        startEmpty(name, user.id);
        router.push('/workout/session');
      },
      'My Workout'
    );
  };

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.heading, { color: theme.text }]}>Workouts</Text>
        <View style={styles.headerActions}>
          <Button
            title="+ New"
            variant="secondary"
            size="sm"
            onPress={() => router.push('/(tabs)/workouts/new')}
          />
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/settings')}
            style={{ paddingHorizontal: 8, paddingVertical: 6 }}
          >
            <Text style={{ fontSize: 20 }}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Active session banner */}
      {activeSession && (
        <TouchableOpacity
          style={[styles.activeBanner, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/workout/session')}
        >
          <Text style={styles.bannerText}>🏋️ Workout in progress — tap to continue</Text>
        </TouchableOpacity>
      )}

      {/* Templates list */}
      <FlatList
        data={templates}
        keyExtractor={t => t.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={() => (
          <TouchableOpacity
            style={[styles.emptyWorkoutBtn, { borderColor: theme.border, borderStyle: 'dashed' }]}
            onPress={handleStartEmpty}
          >
            <Text style={{ fontSize: 24 }}>⚡</Text>
            <Text style={[styles.emptyWorkoutText, { color: theme.text }]}>
              Start Empty Workout
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <EmptyState
            icon="📋"
            title="No templates yet"
            description="Create a template to quickly start your workouts"
            action={
              <Button
                title="Create Template"
                onPress={() => router.push('/(tabs)/workouts/new')}
              />
            }
          />
        )}
        renderItem={({ item }) => (
          <TemplateCard
            template={item}
            onStart={() => handleStart(item)}
            onEdit={() => router.push(`/(tabs)/workouts/${item.id}`)}
            onDuplicate={() => duplicateMutation.mutate(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  heading: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  list: { padding: Spacing.lg, gap: Spacing.md },
  card: { gap: Spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  templateName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: 2 },
  exerciseList: { fontSize: FontSize.sm, lineHeight: 18 },
  lastUsed: { fontSize: FontSize.xs, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  metaIcon: { fontSize: 12 },
  metaLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  cardActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  actionBtn: {
    width: 36, height: 36, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  activeBanner: {
    margin: Spacing.lg, padding: Spacing.md,
    borderRadius: BorderRadius.md, alignItems: 'center',
  },
  bannerText: { color: '#fff', fontWeight: FontWeight.semibold },
  emptyWorkoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, padding: Spacing.lg,
    borderRadius: BorderRadius.lg, borderWidth: 1.5,
    marginBottom: Spacing.md,
  },
  emptyWorkoutText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
});
