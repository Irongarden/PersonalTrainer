import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { alertDialog } from "@/utils/alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useTheme, Theme } from "@/hooks/useTheme";
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from "@/constants";
import { Button } from "@/components/ui";
import { generateId } from "@/utils/calculations";
import type { Exercise, MuscleGroup } from "@/types";

// ── Types ──────────────────────────────────────────────────────
interface TemplateSetDraft {
  id: string;
  set_number: number;
  target_reps: number;
  target_weight_kg: number | null;
  rest_seconds: number;
  rpe_target: number | null;
}

interface TemplateExerciseDraft {
  id: string;
  order_index: number;
  exercise: Exercise;
  notes: string;
  sets: TemplateSetDraft[];
}

const MUSCLE_FILTERS: { value: MuscleGroup | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "biceps", label: "Biceps" },
  { value: "triceps", label: "Triceps" },
  { value: "quads", label: "Quads" },
  { value: "hamstrings", label: "Hamstrings" },
  { value: "glutes", label: "Glutes" },
  { value: "calves", label: "Calves" },
  { value: "core", label: "Core" },
];

function makeDefaultSet(setNumber: number): TemplateSetDraft {
  return {
    id: generateId(),
    set_number: setNumber,
    target_reps: 8,
    target_weight_kg: null,
    rest_seconds: 90,
    rpe_target: null,
  };
}

function makeExerciseDraft(exercise: Exercise, orderIndex: number): TemplateExerciseDraft {
  return {
    id: generateId(),
    order_index: orderIndex,
    exercise,
    notes: "",
    sets: [makeDefaultSet(1), makeDefaultSet(2), makeDefaultSet(3)],
  };
}

// ── Main Screen ───────────────────────────────────────────────
export default function TemplateEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id && id !== "new";
  const user = useAuthStore((s) => s.user);
  const colors = useTheme();
  const s = styles(colors);
  const qc = useQueryClient();

  const [templateName, setTemplateName] = useState("");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<TemplateExerciseDraft[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | "all">("all");

  // ── Load existing template if editing ──────────────────────
  const { isLoading: loadingTemplate } = useQuery({
    queryKey: ["template-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select(`
          id, name, description,
          template_exercises (
            *,
            exercises ( * ),
            template_sets ( * )
          )
        `)
        .eq("id", id)
        .eq("user_id", user?.id ?? "")
        .single();
      if (error) throw error;

      setTemplateName(data.name);
      setNotes(data.description ?? "");
      const exDrafts: TemplateExerciseDraft[] = (data.template_exercises ?? [])
        .sort((a: any, b: any) => (a.order_index ?? a.order ?? 0) - (b.order_index ?? b.order ?? 0))
        .map((te: any) => ({
          id: te.id,
          order_index: te.order_index ?? te.order ?? 0,
          exercise: te.exercises as Exercise,
          notes: te.notes ?? "",
          sets: (te.template_sets ?? [])
            .sort((a: any, b: any) => (a.set_number ?? a.order ?? 0) - (b.set_number ?? b.order ?? 0))
            .map((ts: any) => ({
              id: ts.id,
              set_number: ts.set_number ?? ts.order ?? 1,
              target_reps: ts.target_reps ?? 8,
              target_weight_kg: ts.target_weight_kg ?? ts.target_weight ?? null,
              rest_seconds: ts.rest_seconds ?? 90,
              rpe_target: ts.rpe_target ?? null,
            })),
        }));
      setExercises(exDrafts);
      return data;
    },
    enabled: isEditing && !!user,
  });

  // ── Exercise library query ─────────────────────────────────
  const { data: allExercises = [] } = useQuery<Exercise[]>({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .or(`is_custom.eq.false,user_id.eq.${user?.id}`)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const filteredExercises = allExercises.filter((ex) => {
    const matchSearch = ex.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchMuscle =
      muscleFilter === "all" || ex.primary_muscles.includes(muscleFilter);
    return matchSearch && matchMuscle;
  });

  // ── Save mutation ──────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!templateName.trim()) throw new Error("Template name required");

      let templateId: string;

      if (isEditing) {
        templateId = id!;
        const { error: upErr } = await supabase
          .from("templates")
          .update({
            name: templateName.trim(),
            description: notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", templateId)
          .eq("user_id", user.id);
        if (upErr) throw upErr;

        // Delete old exercises (cascade deletes sets)
        const { error: delErr } = await supabase
          .from("template_exercises")
          .delete()
          .eq("template_id", templateId);
        if (delErr) throw delErr;
      } else {
        // Let Postgres generate UUID
        const { data: tmpl, error: insErr } = await supabase
          .from("templates")
          .insert({
            user_id: user.id,
            name: templateName.trim(),
            description: notes.trim() || null,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        templateId = tmpl.id;
      }

      // Insert exercises + sets (no hardcoded IDs)
      for (const ex of exercises) {
        const { data: te, error: teErr } = await supabase
          .from("template_exercises")
          .insert({
            template_id: templateId,
            exercise_id: ex.exercise.id,
            order_index: ex.order_index,
            notes: ex.notes || null,
          })
          .select("id")
          .single();
        if (teErr) throw teErr;

        const setsToInsert = ex.sets.map((set) => ({
          template_exercise_id: te.id,
          set_number: set.set_number,
          target_reps: set.target_reps,
          target_weight_kg: set.target_weight_kg,
          rpe_target: set.rpe_target,
          rest_seconds: set.rest_seconds,
        }));
        if (setsToInsert.length > 0) {
          const { error: setsErr } = await supabase
            .from("template_sets")
            .insert(setsToInsert);
          if (setsErr) throw setsErr;
        }
      }

      return templateId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      router.back();
    },
    onError: (e: any) => alertDialog("Save failed", e.message),
  });

  const handleSave = () => {
    if (!templateName.trim()) {
      alertDialog("Name required", "Give your template a name.");
      return;
    }
    if (exercises.length === 0) {
      alertDialog("No exercises", "Add at least one exercise.");
      return;
    }
    saveMutation.mutate();
  };

  // ── Exercise helpers ───────────────────────────────────────
  const addExercise = (exercise: Exercise) => {
    setExercises((prev) => [
      ...prev,
      makeExerciseDraft(exercise, prev.length),
    ]);
    setShowExercisePicker(false);
  };

  const removeExercise = (draftId: string) => {
    setExercises((prev) =>
      prev
        .filter((e) => e.id !== draftId)
        .map((e, i) => ({ ...e, order_index: i }))
    );
  };

  const addSet = (draftId: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === draftId
          ? { ...ex, sets: [...ex.sets, makeDefaultSet(ex.sets.length + 1)] }
          : ex
      )
    );
  };

  const removeSet = (draftId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== draftId) return ex;
        const newSets = ex.sets
          .filter((s) => s.id !== setId)
          .map((s, i) => ({ ...s, set_number: i + 1 }));
        return { ...ex, sets: newSets };
      })
    );
  };

  const updateSet = (
    draftId: string,
    setId: string,
    field: keyof TemplateSetDraft,
    value: string
  ) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== draftId) return ex;
        const parsed = parseFloat(value);
        const updatedSets = ex.sets.map((s) =>
          s.id === setId ? { ...s, [field]: isNaN(parsed) ? null : parsed } : s
        );
        // Auto-fill: spread weight to all other null-weight sets in this exercise
        if (field === "target_weight_kg" && !isNaN(parsed) && parsed > 0) {
          return {
            ...ex,
            sets: updatedSets.map((s) =>
              s.target_weight_kg === null ? { ...s, target_weight_kg: parsed } : s
            ),
          };
        }
        return { ...ex, sets: updatedSets };
      })
    );
  };

  const updateExerciseNote = (draftId: string, note: string) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === draftId ? { ...ex, notes: note } : ex))
    );
  };

  if (isEditing && loadingTemplate) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {isEditing ? "Edit Template" : "New Template"}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Template name */}
        <TextInput
          style={s.templateNameInput}
          value={templateName}
          onChangeText={setTemplateName}
          placeholder="Template name…"
          placeholderTextColor={colors.textTertiary}
          autoFocus={!isEditing}
        />

        <TextInput
          style={s.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes (optional)…"
          placeholderTextColor={colors.textTertiary}
          multiline
        />

        {/* Exercise list */}
        {exercises.map((ex) => (
          <ExerciseBlock
            key={ex.id}
            draft={ex}
            colors={colors}
            s={s}
            onAddSet={() => addSet(ex.id)}
            onRemoveSet={(setId) => removeSet(ex.id, setId)}
            onUpdateSet={(setId, field, val) =>
              updateSet(ex.id, setId, field, val)
            }
            onRemoveExercise={() => removeExercise(ex.id)}
            onUpdateNote={(note) => updateExerciseNote(ex.id, note)}
          />
        ))}

        {/* Add exercise button */}
        <TouchableOpacity
          style={s.addExerciseBtn}
          onPress={() => setShowExercisePicker(true)}
        >
          <Text style={s.addExerciseBtnText}>+ Add Exercise</Text>
        </TouchableOpacity>

        <Button
          title={
            saveMutation.isPending
              ? "Saving…"
              : isEditing
              ? "Save Changes"
              : "Create Template"
          }
          onPress={handleSave}
          disabled={saveMutation.isPending}
          style={{ marginTop: Spacing.lg }}
        />
      </ScrollView>

      {/* Exercise picker modal */}
      <Modal
        visible={showExercisePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExercisePicker(false)}
      >
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Choose Exercise</Text>
            <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search exercises…"
            placeholderTextColor={colors.textTertiary}
            autoFocus
          />

          {/* Muscle filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.muscleFilters}
          >
            {MUSCLE_FILTERS.map((mf) => (
              <TouchableOpacity
                key={mf.value}
                style={[
                  s.muscleChip,
                  muscleFilter === mf.value && s.muscleChipActive,
                ]}
                onPress={() => setMuscleFilter(mf.value as any)}
              >
                <Text
                  style={[
                    s.muscleChipText,
                    muscleFilter === mf.value && s.muscleChipTextActive,
                  ]}
                >
                  {mf.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={filteredExercises}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.exerciseRow}
                onPress={() => addExercise(item)}
              >
                <Text style={s.exerciseRowName}>{item.name}</Text>
                <Text style={s.exerciseRowMeta}>
                  {item.equipment} •{" "}
                  {item.primary_muscles
                    .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
                    .join(", ")}
                </Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: colors.border,
                  marginLeft: Spacing.md,
                }}
              />
            )}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Exercise block ─────────────────────────────────────────────
function ExerciseBlock({
  draft,
  colors,
  s,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
  onRemoveExercise,
  onUpdateNote,
}: {
  draft: TemplateExerciseDraft;
  colors: Theme;
  s: ReturnType<typeof styles>;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onUpdateSet: (setId: string, field: keyof TemplateSetDraft, val: string) => void;
  onRemoveExercise: () => void;
  onUpdateNote: (note: string) => void;
}) {
  const [showNotes, setShowNotes] = useState(false);

  return (
    <View style={s.exerciseCard}>
      <View style={s.exerciseCardHeader}>
        <Text style={s.exerciseCardName}>{draft.exercise.name}</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity onPress={() => setShowNotes((v) => !v)}>
            <Text style={s.noteToggle}>📝</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRemoveExercise}>
            <Text style={s.removeExBtn}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showNotes && (
        <TextInput
          style={s.exerciseNoteInput}
          value={draft.notes}
          onChangeText={onUpdateNote}
          placeholder="Exercise notes…"
          placeholderTextColor={colors.textTertiary}
          multiline
        />
      )}

      {/* Set header */}
      <View style={s.setTableHeader}>
        <Text style={[s.setHeaderCol, { width: 28 }]}>Set</Text>
        <Text style={[s.setHeaderCol, { flex: 1 }]}>kg</Text>
        <Text style={[s.setHeaderCol, { flex: 1 }]}>Reps</Text>
        <Text style={[s.setHeaderCol, { width: 52 }]}>Rest(s)</Text>
        <View style={{ width: 24 }} />
      </View>

      {draft.sets.map((set) => (
        <View key={set.id} style={s.setTableRow}>
          <Text style={[s.setNum, { width: 28 }]}>{set.set_number}</Text>
          <TextInput
            style={[s.setInput, { flex: 1 }]}
            value={
              set.target_weight_kg != null ? String(set.target_weight_kg) : ""
            }
            onChangeText={(v) => onUpdateSet(set.id, "target_weight_kg", v)}
            placeholder="—"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={[s.setInput, { flex: 1 }]}
            value={String(set.target_reps)}
            onChangeText={(v) => onUpdateSet(set.id, "target_reps", v)}
            keyboardType="number-pad"
          />
          <TextInput
            style={[s.setInput, { width: 52 }]}
            value={set.rest_seconds != null ? String(set.rest_seconds) : ""}
            onChangeText={(v) => onUpdateSet(set.id, "rest_seconds", v)}
            placeholder="90"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
          />
          <TouchableOpacity
            onPress={() => onRemoveSet(set.id)}
            style={{ width: 24, alignItems: "center" }}
          >
            <Text style={{ color: colors.textTertiary, fontSize: 16 }}>−</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={s.addSetBtn} onPress={onAddSet}>
        <Text style={s.addSetBtnText}>+ Add Set</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const styles = (colors: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    backBtn: { width: 60, paddingVertical: 4 },
    backText: { color: colors.primary, fontSize: FontSize.md },
    headerTitle: {
      color: colors.text,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
    },
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: Spacing.md, paddingBottom: 60 },
    templateNameInput: {
      color: colors.text,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
      marginBottom: Spacing.sm,
    },
    notesInput: {
      color: colors.textSecondary,
      fontSize: FontSize.sm,
      paddingVertical: Spacing.xs,
      marginBottom: Spacing.lg,
    },
    exerciseCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    exerciseCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.sm,
    },
    exerciseCardName: {
      color: colors.text,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      flex: 1,
    },
    noteToggle: { fontSize: 18 },
    removeExBtn: { color: colors.error, fontSize: 16, fontWeight: FontWeight.bold },
    exerciseNoteInput: {
      backgroundColor: colors.background,
      borderRadius: BorderRadius.sm,
      padding: Spacing.sm,
      color: colors.text,
      fontSize: FontSize.sm,
      marginBottom: Spacing.sm,
    },
    setTableHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    setHeaderCol: {
      color: colors.textSecondary,
      fontSize: FontSize.xs,
      textAlign: "center",
    },
    setTableRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 6,
    },
    setNum: {
      color: colors.textSecondary,
      fontSize: FontSize.sm,
      textAlign: "center",
    },
    setInput: {
      backgroundColor: colors.background,
      borderRadius: BorderRadius.sm,
      padding: 8,
      color: colors.text,
      fontSize: FontSize.sm,
      textAlign: "center",
    },
    addSetBtn: {
      marginTop: Spacing.sm,
      alignItems: "center",
      padding: Spacing.sm,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.primary,
    },
    addSetBtnText: { color: colors.primary, fontSize: FontSize.sm },
    addExerciseBtn: {
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      alignItems: "center",
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: colors.primary,
      marginBottom: Spacing.sm,
    },
    addExerciseBtnText: {
      color: colors.primary,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
    },
    // Modal
    modal: { flex: 1 },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      color: colors.text,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
    },
    modalClose: { color: colors.textSecondary, fontSize: 18 },
    searchInput: {
      margin: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.sm,
      color: colors.text,
      fontSize: FontSize.md,
    },
    muscleFilters: { paddingHorizontal: Spacing.md, gap: 8, paddingBottom: Spacing.sm },
    muscleChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    muscleChipActive: { backgroundColor: colors.primary },
    muscleChipText: { color: colors.textSecondary, fontSize: FontSize.sm },
    muscleChipTextActive: { color: colors.background, fontWeight: FontWeight.semibold },
    exerciseRow: {
      padding: Spacing.md,
      paddingVertical: 14,
    },
    exerciseRowName: {
      color: colors.text,
      fontSize: FontSize.md,
    },
    exerciseRowMeta: {
      color: colors.textSecondary,
      fontSize: FontSize.xs,
      marginTop: 2,
      textTransform: "capitalize",
    },
  });
