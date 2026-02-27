import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, TouchableOpacity, ScrollView,
} from 'react-native';
import { alertDialog } from '../../src/utils/alert';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { Button, Input } from '../../src/components/ui';
import { Colors, FontSize, FontWeight, Spacing } from '../../src/constants';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { signUpWithEmail, isLoading } = useAuthStore();
  const C = Colors.dark;

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) {
      alertDialog('Error', 'Please fill in all required fields');
      return;
    }
    if (password !== confirm) {
      alertDialog('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 8) {
      alertDialog('Error', 'Password must be at least 8 characters');
      return;
    }
    try {
      await signUpWithEmail(email.trim(), password, name.trim() || undefined);
      // Navigate straight in — ensure email confirmation is disabled in Supabase
      router.replace('/(tabs)/workouts');
    } catch (err: any) {
      alertDialog('Sign up failed', err.message ?? 'Please try again');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.logo}>🏋️</Text>
            <Text style={[styles.title, { color: C.text }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: C.textSecondary }]}>
              Start your fitness journey
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Display Name (optional)"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholder="Your name"
              placeholderTextColor={C.textTertiary}
            />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              required
              placeholder="you@example.com"
              placeholderTextColor={C.textTertiary}
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              required
              placeholder="Min. 8 characters"
              placeholderTextColor={C.textTertiary}
            />
            <Input
              label="Confirm Password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              required
              placeholder="Repeat password"
              placeholderTextColor={C.textTertiary}
            />
            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={isLoading}
              fullWidth
            />
          </View>

          <View style={styles.footer}>
            <Text style={{ color: C.textSecondary }}>Already have an account?</Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={[styles.link, { color: C.primary }]}> Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, padding: Spacing.xl, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: Spacing.xxxl, gap: Spacing.sm },
  logo: { fontSize: 56 },
  title: { fontSize: FontSize.xxxl, fontWeight: FontWeight.extrabold },
  subtitle: { fontSize: FontSize.md },
  form: { gap: Spacing.lg, marginBottom: Spacing.xl },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  link: { fontWeight: FontWeight.semibold },
});
