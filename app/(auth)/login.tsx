import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, TouchableOpacity, ScrollView,
} from 'react-native';
import { alertDialog } from '../../src/utils/alert';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/lib/supabase';
import { Button, Input } from '../../src/components/ui';
import { Colors, FontSize, FontWeight, Spacing } from '../../src/constants';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'otp-send' | 'otp-verify'>('password');
  const [otpCode, setOtpCode] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { signInWithEmail, isLoading } = useAuthStore();
  const C = Colors.dark;

  const handleLogin = async () => {
    if (!email.trim()) {
      alertDialog('Error', 'Please enter your email');
      return;
    }
    try {
      await signInWithEmail(email.trim(), password);
      router.replace('/(tabs)/workouts');
    } catch (err: any) {
      alertDialog('Login failed', err.message ?? 'Please try again');
    }
  };

  const handleSendOtp = async () => {
    if (!email.trim()) {
      alertDialog('Error', 'Please enter your email');
      return;
    }
    setIsSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setMode('otp-verify');
    } catch (err: any) {
      alertDialog('Error', err.message ?? 'Could not send code');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.length < 6) {
      alertDialog('Error', 'Enter the code from your email');
      return;
    }
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'email',
      });
      if (error) throw error;
      router.replace('/(tabs)/workouts');
    } catch (err: any) {
      alertDialog('Invalid code', err.message ?? 'Please try again');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>💪</Text>
            <Text style={[styles.title, { color: C.text }]}>PersonalCoach</Text>
            <Text style={[styles.subtitle, { color: C.textSecondary }]}>
              Your AI-powered gym companion
            </Text>
          </View>

          <View style={styles.form}>
            {/* ── OTP verify step ── */}
            {mode === 'otp-verify' ? (
              <>
                <View style={styles.otpInfo}>
                  <Text style={{ fontSize: 36 }}>📬</Text>
                  <Text style={[styles.otpTitle, { color: C.text }]}>Check your email</Text>
                  <Text style={[styles.otpDesc, { color: C.textSecondary }]}>
                    We sent a 6-digit code to{' '}
                    <Text style={{ color: C.primary }}>{email}</Text>
                  </Text>
                </View>
                <Input
                  label="Login code"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  placeholder="12345678"
                  placeholderTextColor={C.textTertiary}
                  maxLength={8}
                />
                <Button
                  title="Verify Code"
                  onPress={handleVerifyOtp}
                  loading={isLoading}
                  fullWidth
                />
                <TouchableOpacity onPress={() => { setMode('otp-send'); setOtpCode(''); }}>
                  <Text style={[styles.toggle, { color: C.primary }]}>Resend code</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode('password')}>
                  <Text style={[styles.toggle, { color: C.textTertiary }]}>Use password instead</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Input
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  placeholder="you@example.com"
                  placeholderTextColor={C.textTertiary}
                />

                {mode === 'password' && (
                  <Input
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="password"
                    placeholder="••••••••"
                    placeholderTextColor={C.textTertiary}
                  />
                )}

                <Button
                  title={mode === 'password' ? 'Sign In' : 'Send Code'}
                  onPress={mode === 'password' ? handleLogin : handleSendOtp}
                  loading={isLoading || isSending}
                  fullWidth
                />

                <TouchableOpacity onPress={() => setMode(mode === 'password' ? 'otp-send' : 'password')}>
                  <Text style={[styles.toggle, { color: C.primary }]}>
                    {mode === 'password' ? 'Sign in with email code instead' : 'Use password instead'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={{ color: C.textSecondary }}>Don't have an account?</Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={[styles.link, { color: C.primary }]}> Sign Up</Text>
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
  title: { fontSize: FontSize.display, fontWeight: FontWeight.extrabold },
  subtitle: { fontSize: FontSize.md },
  form: { gap: Spacing.lg, marginBottom: Spacing.xl },
  toggle: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    paddingVertical: Spacing.sm,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  link: { fontWeight: FontWeight.semibold },
  otpInfo: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  otpTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  otpDesc: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
});
