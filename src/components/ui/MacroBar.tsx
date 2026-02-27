import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { FontSize, FontWeight, Spacing, BorderRadius } from '../../constants';

interface MacroBarProps {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  targetKcal?: number;
}

export const MacroBar: React.FC<MacroBarProps> = ({
  kcal, protein_g, carbs_g, fat_g, targetKcal,
}) => {
  const theme = useTheme();
  const total = protein_g * 4 + carbs_g * 4 + fat_g * 9;

  const pPct = total > 0 ? (protein_g * 4) / total : 0;
  const cPct = total > 0 ? (carbs_g * 4) / total : 0;
  const fPct = total > 0 ? (fat_g * 9) / total : 0;

  return (
    <View style={styles.container}>
      <View style={styles.totalRow}>
        <Text style={[styles.kcalText, { color: theme.text }]}>{Math.round(kcal)} kcal</Text>
        {targetKcal && (
          <Text style={[styles.targetText, { color: theme.textTertiary }]}>
            / {targetKcal} goal
          </Text>
        )}
      </View>

      {/* Bar */}
      <View style={[styles.bar, { backgroundColor: theme.surfaceHighlight }]}>
        <View style={[styles.barSegment, { flex: pPct, backgroundColor: '#4FC3F7' }]} />
        <View style={[styles.barSegment, { flex: cPct, backgroundColor: '#AED581' }]} />
        <View style={[styles.barSegment, { flex: fPct, backgroundColor: '#FFD54F' }]} />
      </View>

      {/* Macro labels */}
      <View style={styles.macroRow}>
        <MacroLabel label="Protein" value={protein_g} color="#4FC3F7" theme={theme} />
        <MacroLabel label="Carbs" value={carbs_g} color="#AED581" theme={theme} />
        <MacroLabel label="Fat" value={fat_g} color="#FFD54F" theme={theme} />
      </View>
    </View>
  );
};

const MacroLabel: React.FC<{
  label: string; value: number; color: string; theme: any;
}> = ({ label, value, color, theme }) => (
  <View style={styles.macroLabel}>
    <View style={[styles.dot, { backgroundColor: color }]} />
    <Text style={[styles.macroValue, { color: theme.text }]}>{Math.round(value)}g</Text>
    <Text style={[styles.macroName, { color: theme.textTertiary }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  kcalText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  targetText: { fontSize: FontSize.sm },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  barSegment: { height: '100%' },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
  },
  macroValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  macroName: { fontSize: FontSize.xs },
});
