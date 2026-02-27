import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, TextInput, ScrollView, Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../../src/stores/authStore';
import { useMealsStore } from '../../../src/stores/mealsStore';
import { useTheme } from '../../../src/hooks/useTheme';
import {
  Button, Card, MacroBar, LoadingSpinner, EmptyState,
} from '../../../src/components/ui';
import {
  FontSize, FontWeight, Spacing, BorderRadius,
} from '../../../src/constants';
import type { Meal, MealItem } from '../../../src/types';
import { generateId, formatDate } from '../../../src/utils/calculations';
import { alertDialog, confirmDialog } from '../../../src/utils/alert';

// ── Date navigation ───────────────────────────

function DateNav({
  date, onPrev, onNext, onToday, theme,
}: {
  date: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  theme: any;
}) {
  const isToday = date === new Date().toISOString().split('T')[0];
  const displayDate = isToday ? 'Today' : formatDate(date + 'T00:00:00.000Z');

  return (
    <View style={[styles.dateNav, { borderBottomColor: theme.border }]}>
      <TouchableOpacity onPress={onPrev} style={styles.dateNavBtn}>
        <Text style={{ color: theme.primary, fontSize: 20 }}>‹</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onToday}>
        <Text style={[styles.dateText, { color: theme.text }]}>{displayDate}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onNext} style={styles.dateNavBtn} disabled={isToday}>
        <Text style={{ color: isToday ? theme.textDisabled : theme.primary, fontSize: 20 }}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Meal card ─────────────────────────────────

const MealCard: React.FC<{
  meal: Meal;
  onEdit: () => void;
  onDelete: () => void;
  theme: any;
}> = ({ meal, onEdit, onDelete, theme }) => {
  const mealTypeEmoji: Record<string, string> = {
    breakfast: '🌅', lunch: '☀️', dinner: '🌙',
    snack: '🍎', pre_workout: '⚡', post_workout: '💪',
  };

  return (
    <Card style={styles.mealCard}>
      {meal.photo_uri && (
        <Image source={{ uri: meal.photo_uri }} style={styles.mealPhoto} />
      )}
      <View style={styles.mealHeader}>
        <Text style={{ fontSize: 20 }}>{mealTypeEmoji[meal.meal_type ?? ''] ?? '🍽️'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.mealName, { color: theme.text }]}>{meal.name}</Text>
          <Text style={[styles.mealTime, { color: theme.textSecondary }]}>
            {new Date(meal.eaten_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {meal.is_ai_estimated && (
              <Text style={{ color: theme.warning }}> · AI estimate</Text>
            )}
          </Text>
        </View>
        <View style={styles.mealActions}>
          <TouchableOpacity onPress={onEdit} style={styles.mealActionBtn}>
            <Text style={{ color: theme.textSecondary }}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.mealActionBtn}>
            <Text style={{ color: theme.error }}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Items */}
      {meal.items.slice(0, 3).map(item => (
        <View key={item.id} style={styles.mealItemRow}>
          <Text style={[styles.mealItemName, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.mealItemMeta, { color: theme.textTertiary }]}>
            {item.grams}g · {Math.round(item.kcal)} kcal
          </Text>
        </View>
      ))}
      {meal.items.length > 3 && (
        <Text style={[styles.moreItems, { color: theme.textTertiary }]}>
          +{meal.items.length - 3} more items
        </Text>
      )}

      {/* Totals */}
      <View style={[styles.mealTotals, { borderTopColor: theme.borderSubtle }]}>
        <MacroTotal label="kcal" value={Math.round(meal.totals.kcal)} theme={theme} primary />
        <MacroTotal label="P" value={Math.round(meal.totals.protein_g)} unit="g" theme={theme} color="#4FC3F7" />
        <MacroTotal label="C" value={Math.round(meal.totals.carbs_g)} unit="g" theme={theme} color="#AED581" />
        <MacroTotal label="F" value={Math.round(meal.totals.fat_g)} unit="g" theme={theme} color="#FFD54F" />
      </View>
    </Card>
  );
};

const MacroTotal: React.FC<{
  label: string; value: number; unit?: string; theme: any; primary?: boolean; color?: string;
}> = ({ label, value, unit = '', theme, primary, color }) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={{
      fontSize: primary ? FontSize.lg : FontSize.md,
      fontWeight: FontWeight.bold,
      color: color ?? theme.text,
    }}>
      {value}{unit}
    </Text>
    <Text style={{ fontSize: FontSize.xs, color: theme.textTertiary }}>{label}</Text>
  </View>
);

// ── Add Meal Modal ────────────────────────────

const AddMealModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  userId: string;
  date: string;
}> = ({ visible, onClose, userId, date }) => {
  const theme = useTheme();
  const { addMeal, analyzePhoto, isAnalyzing } = useMealsStore();
  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [items, setItems] = useState<Omit<MealItem, 'id'>[]>([]);
  const [mealType, setMealType] = useState<Meal['meal_type']>('lunch');

  const MEAL_TYPES: Array<{ key: Meal['meal_type']; label: string; emoji: string }> = [
    { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
    { key: 'lunch', label: 'Lunch', emoji: '☀️' },
    { key: 'dinner', label: 'Dinner', emoji: '🌙' },
    { key: 'snack', label: 'Snack', emoji: '🍎' },
    { key: 'pre_workout', label: 'Pre-WO', emoji: '⚡' },
    { key: 'post_workout', label: 'Post-WO', emoji: '💪' },
  ];

  const handlePhotoAI = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alertDialog('Camera Permission Required', 'Please allow camera access so PersonalCoach can analyze your meals.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setPhotoUri(uri);
      try {
        const analysis = await analyzePhoto(uri);
        setItems(analysis.items.map(i => ({ ...i, id: undefined }) as any));
        if (!name) setName('Meal from photo');
        alertDialog(
          '🤖 AI Analysis',
          `Detected ${analysis.items.length} items. Review and adjust as needed.`
        );
      } catch (err) {
        alertDialog('Analysis failed', 'Could not analyze photo. Please add items manually.');
      }
    }
  };

  const handlePhotoLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alertDialog('Permission Required', 'Please allow photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const addManualItem = () => {
    setItems(prev => [...prev, {
      name: '',
      grams: 100,
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      source: 'manual',
    }]);
  };

  const updateItem = (idx: number, updates: Partial<MealItem>) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alertDialog('Error', 'Please enter a meal name');
      return;
    }
    const validItems = items.filter(i => i.name.trim());
    try {
      await addMeal({
        user_id: userId,
        name: name.trim(),
        meal_type: mealType,
        eaten_at: `${date}T${new Date().toTimeString().slice(0, 8)}`,
        photo_uri: photoUri,
        items: validItems.map(i => ({ ...i, id: generateId() })),
        is_ai_estimated: validItems.some(i => i.source === 'estimated'),
      });
      // Reset on success
      setName('');
      setPhotoUri(undefined);
      setItems([]);
      onClose();
    } catch (err: any) {
      alertDialog('Save failed', err?.message ?? 'Could not save meal. Please try again.');
    }
  };

  return (
    <Modal visible={visible} presentationStyle="pageSheet" animationType="slide">
      <SafeAreaView style={[styles.modal, { backgroundColor: theme.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: theme.textSecondary, fontSize: FontSize.md }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Add Meal</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={{ color: theme.primary, fontWeight: FontWeight.semibold }}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          {/* Name */}
          <TextInput
            style={[styles.mealNameInput, { color: theme.text, borderColor: theme.border }]}
            value={name}
            onChangeText={setName}
            placeholder="Meal name..."
            placeholderTextColor={theme.textTertiary}
          />

          {/* Meal type */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: Spacing.sm, paddingVertical: 4 }}>
              {MEAL_TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setMealType(t.key)}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: mealType === t.key ? theme.primary : theme.surfaceHighlight,
                      borderColor: mealType === t.key ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 14 }}>{t.emoji}</Text>
                  <Text style={{
                    fontSize: FontSize.sm,
                    color: mealType === t.key ? '#fff' : theme.textSecondary,
                    fontWeight: FontWeight.medium,
                  }}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Photo AI */}
          {isAnalyzing ? (
            <View style={[styles.photoRow, { borderColor: theme.border }]}>
              <ActivityIndicator color={theme.primary} />
              <Text style={{ color: theme.textSecondary }}>Analyzing photo with AI...</Text>
            </View>
          ) : (
            <View style={styles.photoRow}>
              <Button
                title="📷 Take Photo (AI)"
                variant="secondary"
                onPress={handlePhotoAI}
                size="sm"
                style={{ flex: 1 }}
              />
              <Button
                title="🖼 Library"
                variant="secondary"
                onPress={handlePhotoLibrary}
                size="sm"
                style={{ flex: 1 }}
              />
            </View>
          )}

          {photoUri && (
            <Image source={{ uri: photoUri }} style={styles.previewPhoto} />
          )}

          {/* Items */}
          <View style={styles.itemsSection}>
            <View style={styles.itemsHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Food Items</Text>
              <Button
                title="+ Add Item"
                variant="ghost"
                size="sm"
                onPress={addManualItem}
              />
            </View>

            {items.map((item, idx) => (
              <View key={idx} style={[styles.itemRow, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
                {item.source === 'estimated' && (
                  <Text style={{ color: theme.warning, fontSize: FontSize.xs }}>🤖 AI estimate</Text>
                )}
                <TextInput
                  style={[styles.itemNameInput, { color: theme.text, borderColor: theme.border }]}
                  value={item.name}
                  onChangeText={v => updateItem(idx, { name: v })}
                  placeholder="Food name"
                  placeholderTextColor={theme.textTertiary}
                />
                <View style={styles.itemMacros}>
                  <ItemMacroInput
                    label="g" value={item.grams}
                    onChange={v => updateItem(idx, { grams: v })}
                    theme={theme}
                  />
                  <ItemMacroInput
                    label="kcal" value={item.kcal}
                    onChange={v => updateItem(idx, { kcal: v })}
                    theme={theme}
                  />
                  <ItemMacroInput
                    label="P" value={item.protein_g}
                    onChange={v => updateItem(idx, { protein_g: v })}
                    theme={theme}
                  />
                  <ItemMacroInput
                    label="C" value={item.carbs_g}
                    onChange={v => updateItem(idx, { carbs_g: v })}
                    theme={theme}
                  />
                  <ItemMacroInput
                    label="F" value={item.fat_g}
                    onChange={v => updateItem(idx, { fat_g: v })}
                    theme={theme}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                  style={{ alignSelf: 'flex-end' }}
                >
                  <Text style={{ color: theme.error, fontSize: FontSize.sm }}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            {items.length === 0 && (
              <Text style={{ color: theme.textTertiary, textAlign: 'center', padding: Spacing.lg }}>
                Add items manually or use the camera to analyze your meal
              </Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const ItemMacroInput: React.FC<{
  label: string; value: number; onChange: (v: number) => void; theme: any;
}> = ({ label, value, onChange, theme }) => (
  <View style={{ alignItems: 'center', flex: 1 }}>
    <TextInput
      style={[styles.macroInput, { color: theme.text, borderColor: theme.border }]}
      value={value ? String(Math.round(value * 10) / 10) : ''}
      onChangeText={v => onChange(parseFloat(v) || 0)}
      keyboardType="decimal-pad"
      selectTextOnFocus
    />
    <Text style={{ color: theme.textTertiary, fontSize: FontSize.xs }}>{label}</Text>
  </View>
);

// ── Main Screen ───────────────────────────────

export default function MealsScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const {
    meals, selectedDate, setSelectedDate,
    fetchMeals, deleteMeal,
  } = useMealsStore();
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (user?.id) fetchMeals(user.id);
  }, [user?.id, selectedDate]);

  const navigateDate = (direction: 'prev' | 'next') => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const totalKcal = meals.reduce((s, m) => s + m.totals.kcal, 0);
  const totalProtein = meals.reduce((s, m) => s + m.totals.protein_g, 0);
  const totalCarbs = meals.reduce((s, m) => s + m.totals.carbs_g, 0);
  const totalFat = meals.reduce((s, m) => s + m.totals.fat_g, 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: theme.text }]}>Meals</Text>
        <Button title="+ Add" size="sm" onPress={() => setShowAdd(true)} />
      </View>

      {/* Date nav */}
      <DateNav
        date={selectedDate}
        onPrev={() => navigateDate('prev')}
        onNext={() => navigateDate('next')}
        onToday={() => setSelectedDate(new Date().toISOString().split('T')[0])}
        theme={theme}
      />

      {/* Daily totals */}
      {meals.length > 0 && (
        <Card style={StyleSheet.flatten([styles.totalsCard, { marginHorizontal: Spacing.lg }])}>
          <MacroBar
            kcal={totalKcal}
            protein={totalProtein}
            carbs={totalCarbs}
            fat={totalFat}
            targetKcal={user ? undefined : undefined}
          />
        </Card>
      )}

      <FlatList
        data={meals}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={() => (
          <EmptyState
            icon="🍽️"
            title="No meals logged"
            description="Track your nutrition by adding meals"
            action={<Button title="Add Meal" onPress={() => setShowAdd(true)} />}
          />
        )}
        renderItem={({ item }) => (
          <MealCard
            meal={item}
            theme={theme}
            onEdit={() => { /* TODO: edit meal modal */ }}
            onDelete={() => {
              confirmDialog('Delete meal?', item.name, () => deleteMeal(item.id), { confirmText: 'Delete', destructive: true });
            }}
          />
        )}
      />

      {user && (
        <AddMealModal
          visible={showAdd}
          onClose={() => setShowAdd(false)}
          userId={user.id}
          date={selectedDate}
        />
      )}
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
  dateNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: Spacing.md,
  },
  dateNavBtn: { padding: Spacing.sm, minWidth: 44, alignItems: 'center' },
  dateText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  totalsCard: { marginBottom: Spacing.md },
  list: { padding: Spacing.lg, gap: Spacing.md },
  mealCard: { gap: Spacing.sm },
  mealPhoto: { width: '100%', height: 160, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  mealHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  mealName: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  mealTime: { fontSize: FontSize.sm, marginTop: 2 },
  mealActions: { flexDirection: 'row', gap: 4 },
  mealActionBtn: { padding: 4 },
  mealItemRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingLeft: Spacing.xl,
  },
  mealItemName: { flex: 1, fontSize: FontSize.sm },
  mealItemMeta: { fontSize: FontSize.sm },
  moreItems: { fontSize: FontSize.sm, paddingLeft: Spacing.xl },
  mealTotals: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, marginTop: Spacing.xs,
  },
  // Modal styles
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  modalContent: { padding: Spacing.lg, gap: Spacing.lg },
  mealNameInput: {
    fontSize: FontSize.xl, fontWeight: FontWeight.bold,
    borderBottomWidth: 1, paddingBottom: Spacing.sm, marginBottom: Spacing.sm,
  },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  photoRow: {
    flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  previewPhoto: {
    width: '100%', height: 200, borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  itemsSection: { gap: Spacing.md },
  itemsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  itemRow: {
    padding: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1, gap: Spacing.sm,
  },
  itemNameInput: {
    fontSize: FontSize.md, paddingVertical: 6, paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
  },
  itemMacros: { flexDirection: 'row', gap: Spacing.sm },
  macroInput: {
    borderWidth: 1, borderRadius: BorderRadius.sm,
    textAlign: 'center', padding: 4, fontSize: FontSize.sm,
    width: '100%',
  },
});
