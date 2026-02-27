import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { alertDialog } from "@/utils/alert";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useTheme, Theme } from "@/hooks/useTheme";
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from "@/constants";
import { Button } from "@/components/ui";
import { generateId } from "@/utils/calculations";
import type { MuscleGroup, Equipment } from "@/types";

const MUSCLE_GROUPS: { value: MuscleGroup; label: string }[] = [
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
  { value: "forearms", label: "Forearms" },
  { value: "cardio", label: "Cardio" },
];

const EQUIPMENT_OPTIONS: { value: Equipment; label: string; emoji: string }[] = [
  { value: "barbell", label: "Barbell", emoji: "🏋️" },
  { value: "dumbbell", label: "Dumbbell", emoji: "💪" },
  { value: "cable", label: "Cable", emoji: "🔗" },
  { value: "machine", label: "Machine", emoji: "⚙️" },
  { value: "bodyweight", label: "Bodyweight", emoji: "🤸" },
  { value: "other", label: "Other", emoji: "🔩" },
];

export default function NewExerciseScreen() {
  const user = useAuthStore((s) => s.user);
  const colors = useTheme();
  const s = styles(colors);

  const [name, setName] = useState("");
  const [primaryMuscle, setPrimaryMuscle] = useState<MuscleGroup>("chest");
  const [equipment, setEquipment] = useState<Equipment>("barbell");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      alertDialog("Name required", "Please enter an exercise name.");
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("exercises").insert({
        id: generateId(),
        name: name.trim(),
        type: "weight_reps",
        primary_muscles: [primaryMuscle],
        secondary_muscles: [],
        equipment,
        instructions: instructions.trim() || null,
        is_custom: true,
        user_id: user.id,
      });
      if (error) throw error;
      alertDialog("Saved!", `"${name.trim()}" added to your exercise library.`);
      router.back();
    } catch (e: any) {
      alertDialog("Error", e.message ?? "Could not save exercise.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Name */}
      <Text style={s.label}>Exercise Name *</Text>
      <TextInput
        style={s.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Bulgarian Split Squat"
        placeholderTextColor={colors.textTertiary}
        autoFocus
        returnKeyType="next"
      />

      {/* Equipment */}
      <Text style={[s.label, { marginTop: Spacing.lg }]}>Equipment</Text>
      <View style={s.chipGrid}>
        {EQUIPMENT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[s.chip, equipment === opt.value && s.chipSelected]}
            onPress={() => setEquipment(opt.value)}
          >
            <Text style={s.chipEmoji}>{opt.emoji}</Text>
            <Text
              style={[
                s.chipText,
                equipment === opt.value && s.chipTextSelected,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Primary muscle */}
      <Text style={[s.label, { marginTop: Spacing.lg }]}>Primary Muscle</Text>
      <View style={s.chipGrid}>
        {MUSCLE_GROUPS.map((mg) => (
          <TouchableOpacity
            key={mg.value}
            style={[s.chip, primaryMuscle === mg.value && s.chipSelected]}
            onPress={() => setPrimaryMuscle(mg.value)}
          >
            <Text
              style={[
                s.chipText,
                primaryMuscle === mg.value && s.chipTextSelected,
              ]}
            >
              {mg.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Instructions */}
      <Text style={[s.label, { marginTop: Spacing.lg }]}>
        Instructions (optional)
      </Text>
      <TextInput
        style={[s.input, s.textArea]}
        value={instructions}
        onChangeText={setInstructions}
        placeholder="Describe how to perform this exercise…"
        placeholderTextColor={colors.textTertiary}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
      />

      <Button
        title={saving ? "Saving…" : "Save Exercise"}
        onPress={handleSave}
        disabled={saving || !name.trim()}
        style={{ marginTop: Spacing.xl }}
      />
    </ScrollView>
  );
}

const styles = (colors: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: Spacing.md, paddingBottom: 60 },
    label: {
      color: colors.textSecondary,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.medium,
      marginBottom: Spacing.xs,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      color: colors.text,
      fontSize: FontSize.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textArea: { height: 100 },
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    chipEmoji: { fontSize: 14 },
    chipText: { color: colors.textSecondary, fontSize: FontSize.sm },
    chipTextSelected: { color: colors.primary, fontWeight: FontWeight.semibold },
  });
