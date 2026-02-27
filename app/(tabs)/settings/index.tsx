import React, { useState } from 'react';
import {
  View, Text, ScrollView, Switch, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../src/stores/authStore';
import { useTheme } from '../../../src/hooks/useTheme';
import { Button, Card } from '../../../src/components/ui';
import {
  FontSize, FontWeight, Spacing, BorderRadius,
} from '../../../src/constants';
import { calculatePlates } from '../../../src/utils/calculations';
import { confirmDialog } from '../../../src/utils/alert';

const UNIT_SYSTEMS = [
  { key: 'metric' as const, label: 'Metric (kg)', icon: '⚖️' },
  { key: 'imperial' as const, label: 'Imperial (lbs)', icon: '🇺🇸' },
];

const THEMES = [
  { key: 'dark' as const, label: 'Dark', icon: '🌑' },
  { key: 'light' as const, label: 'Light', icon: '☀️' },
  { key: 'system' as const, label: 'System', icon: '📱' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { profile, updateProfile, signOut, user } = useAuthStore();
  const [plateTestWeight, setPlateTestWeight] = useState(100);

  const handleSignOut = () => {
    confirmDialog(
      'Sign Out',
      'Are you sure?',
      signOut,
      { confirmText: 'Sign Out', destructive: true }
    );
  };

  const restOptions = [60, 90, 120, 180, 240];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Profile */}
        <Text style={[styles.sectionHeader, { color: theme.textTertiary }]}>ACCOUNT</Text>
        <Card style={styles.card}>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: theme.primary + '33' }]}>
              <Text style={{ fontSize: 24 }}>👤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { color: theme.text }]}>
                {profile?.display_name ?? 'Athlete'}
              </Text>
              <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
                {user?.email ?? ''}
              </Text>
            </View>
          </View>
          <Button title="Sign Out" variant="danger" size="sm" onPress={handleSignOut} />
        </Card>

        {/* Units */}
        <Text style={[styles.sectionHeader, { color: theme.textTertiary }]}>PREFERENCES</Text>
        <Card style={styles.card}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>Unit System</Text>
          <View style={styles.optionRow}>
            {UNIT_SYSTEMS.map(u => (
              <TouchableOpacity
                key={u.key}
                style={[
                  styles.optionBtn,
                  {
                    backgroundColor: profile?.unit_system === u.key ? theme.primary : theme.surfaceHighlight,
                    borderColor: profile?.unit_system === u.key ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => updateProfile({ unit_system: u.key })}
              >
                <Text style={{ fontSize: 16 }}>{u.icon}</Text>
                <Text style={{
                  fontSize: FontSize.sm,
                  color: profile?.unit_system === u.key ? '#fff' : theme.textSecondary,
                  fontWeight: FontWeight.medium,
                }}>
                  {u.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Theme */}
        <Card style={styles.card}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>Theme</Text>
          <View style={styles.optionRow}>
            {THEMES.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.optionBtn,
                  {
                    flex: 1,
                    backgroundColor: profile?.theme === t.key ? theme.primary : theme.surfaceHighlight,
                    borderColor: profile?.theme === t.key ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => updateProfile({ theme: t.key })}
              >
                <Text>{t.icon}</Text>
                <Text style={{
                  fontSize: FontSize.sm,
                  color: profile?.theme === t.key ? '#fff' : theme.textSecondary,
                  fontWeight: FontWeight.medium,
                }}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Default rest timer */}
        <Card style={styles.card}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>Default Rest Timer</Text>
          <View style={styles.optionRow}>
            {restOptions.map(s => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.restBtn,
                  {
                    backgroundColor: profile?.default_rest_seconds === s ? theme.primary : theme.surfaceHighlight,
                    borderColor: profile?.default_rest_seconds === s ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => updateProfile({ default_rest_seconds: s })}
              >
                <Text style={{
                  color: profile?.default_rest_seconds === s ? '#fff' : theme.textSecondary,
                  fontWeight: FontWeight.medium, fontSize: FontSize.sm,
                }}>
                  {s < 60 ? `${s}s` : `${s / 60}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Plate Calculator */}
        <Text style={[styles.sectionHeader, { color: theme.textTertiary }]}>TOOLS</Text>
        <Card style={styles.card}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>Plate Calculator</Text>
          <PlateCalculatorDemo theme={theme} />
        </Card>

        {/* About */}
        <Text style={[styles.sectionHeader, { color: theme.textTertiary }]}>ABOUT</Text>
        <Card style={styles.card}>
          <SettingRow label="Version" value="1.0.0" theme={theme} />
          <SettingRow label="Build" value="MVP" theme={theme} />
          <SettingRow label="AI Provider" value="Anthropic / OpenAI" theme={theme} />
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PlateCalculatorDemo({ theme }: { theme: any }) {
  const [target, setTarget] = useState(100);
  const config = {
    bar_weight_kg: 20,
    available_plates_kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  };
  const result = calculatePlates(target, config);

  const targets = [60, 80, 100, 120, 140, 160];

  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.optionRow}>
        {targets.map(t => (
          <TouchableOpacity
            key={t}
            style={[
              styles.restBtn,
              {
                backgroundColor: target === t ? theme.primary : theme.surfaceHighlight,
                borderColor: target === t ? theme.primary : theme.border,
              },
            ]}
            onPress={() => setTarget(t)}
          >
            <Text style={{
              color: target === t ? '#fff' : theme.textSecondary,
              fontSize: FontSize.sm, fontWeight: FontWeight.medium,
            }}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.plateResult, { backgroundColor: theme.surfaceHighlight }]}>
        <Text style={{ color: theme.textSecondary, fontSize: FontSize.sm }}>
          Target: <Text style={{ color: theme.text, fontWeight: FontWeight.bold }}>{target} kg</Text>
          {' '}| Bar: {config.bar_weight_kg} kg
        </Text>
        <Text style={[styles.platesDisplay, { color: theme.text }]}>
          {result.plates_per_side.length > 0
            ? `Each side: ${result.plates_per_side.join(' + ')} kg`
            : 'Just the bar'}
        </Text>
        {result.total_weight_kg !== target && (
          <Text style={{ color: theme.warning, fontSize: FontSize.sm }}>
            ⚠️ Nearest: {result.total_weight_kg} kg
          </Text>
        )}
      </View>
    </View>
  );
}

function SettingRow({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={[styles.settingRow, { borderBottomColor: theme.borderSubtle }]}>
      <Text style={[styles.settingRowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.settingRowValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: Spacing.lg, gap: Spacing.sm },
  sectionHeader: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold,
    letterSpacing: 1, paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.lg, paddingBottom: Spacing.sm,
  },
  card: { gap: Spacing.md },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  profileName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  profileEmail: { fontSize: FontSize.sm, marginTop: 2 },
  settingLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  optionRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  optionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md, borderWidth: 1,
  },
  restBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingRowLabel: { fontSize: FontSize.md },
  settingRowValue: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  plateResult: {
    padding: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.xs,
  },
  platesDisplay: {
    fontSize: FontSize.lg, fontWeight: FontWeight.bold,
  },
});
