import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Keyboard,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { alertDialog } from '../../../src/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../src/stores/authStore';
import { useTheme } from '../../../src/hooks/useTheme';
import { Button, Card } from '../../../src/components/ui';
import {
  FontSize, FontWeight, Spacing, BorderRadius,
} from '../../../src/constants';
import { supabase } from '../../../src/lib/supabase';
import type { ChatMessage, CoachGoals, Exercise } from '../../../src/types';
import { generateId } from '../../../src/utils/calculations';

const COACH_ENDPOINT = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/coach-chat`
  : '';

// ── Onboarding flow ───────────────────────────

interface OnboardingStep {
  key: keyof CoachGoals | 'intro';
  question: string;
  options?: string[];
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: 'intro', question: 'Welcome! 👋 I\'m your Personal Coach. Let me learn about your goals so I can give you the best advice.' },
  {
    key: 'primary_goal',
    question: 'What\'s your primary fitness goal?',
    options: ['Muscle Gain 💪', 'Fat Loss 🔥', 'Strength 🏋️', 'Maintenance ⚖️', 'General Fitness 🏃'],
  },
  {
    key: 'experience_level',
    question: 'What\'s your training experience?',
    options: ['Beginner (< 1 year)', 'Intermediate (1-3 years)', 'Advanced (3+ years)'],
  },
  {
    key: 'training_frequency_per_week',
    question: 'How many days per week can you train?',
    options: ['2 days', '3 days', '4 days', '5 days', '6+ days'],
  },
  {
    key: 'injuries',
    question: 'Any injuries or limitations I should know about? (Type or tap Skip)',
  },
];

function OnboardingModal({
  onComplete,
  theme,
}: {
  onComplete: (goals: Partial<CoachGoals>) => void;
  theme: any;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<CoachGoals>>({});
  const [textInput, setTextInput] = useState('');

  const current = ONBOARDING_STEPS[step];

  const handleOption = (opt: string) => {
    let value: any = opt;

    if (current.key === 'primary_goal') {
      const map: Record<string, CoachGoals['primary_goal']> = {
        'Muscle Gain 💪': 'muscle_gain', 'Fat Loss 🔥': 'fat_loss',
        'Strength 🏋️': 'strength', 'Maintenance ⚖️': 'maintenance',
        'General Fitness 🏃': 'general_fitness',
      };
      value = map[opt];
    } else if (current.key === 'experience_level') {
      const map: Record<string, CoachGoals['experience_level']> = {
        'Beginner (< 1 year)': 'beginner',
        'Intermediate (1-3 years)': 'intermediate',
        'Advanced (3+ years)': 'advanced',
      };
      value = map[opt];
    } else if (current.key === 'training_frequency_per_week') {
      value = parseInt(opt);
    }

    const newAnswers = { ...answers, [current.key]: value };
    setAnswers(newAnswers);
    advance(newAnswers);
  };

  const advance = (currentAnswers: Partial<CoachGoals>) => {
    if (step >= ONBOARDING_STEPS.length - 1) {
      onComplete(currentAnswers);
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <View style={[styles.onboarding, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={{ fontSize: 40, textAlign: 'center' }}>🤖</Text>
      <Text style={[styles.onboardingQ, { color: theme.text }]}>{current.question}</Text>

      {current.options ? (
        <View style={styles.optionsList}>
          {current.options.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[styles.optionBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
              onPress={() => handleOption(opt)}
            >
              <Text style={[styles.optionText, { color: theme.text }]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : current.key === 'intro' ? (
        <Button title="Let's start! 🚀" onPress={() => advance(answers)} fullWidth />
      ) : (
        <View style={{ gap: Spacing.md }}>
          <TextInput
            style={[styles.onboardingInput, { color: theme.text, borderColor: theme.border }]}
            value={textInput}
            onChangeText={setTextInput}
            placeholder="Type here..."
            placeholderTextColor={theme.textTertiary}
          />
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Button
              title="Skip"
              variant="ghost"
              onPress={() => advance(answers)}
              style={{ flex: 1 }}
            />
            <Button
              title="Continue"
              onPress={() => {
                advance({ ...answers, [current.key]: textInput || undefined } as any);
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

// ── Message bubble ────────────────────────────

const MessageBubble: React.FC<{ message: ChatMessage; theme: any }> = ({ message, theme }) => {
  const isUser = message.role === 'user';
  return (
    <View style={[
      styles.messageBubble,
      isUser ? styles.userBubble : styles.assistantBubble,
    ]}>
      {!isUser && <Text style={{ fontSize: 16, marginBottom: 4 }}>🤖</Text>}
      <View style={[
        styles.bubbleContent,
        {
          backgroundColor: isUser ? theme.primary : theme.surface,
          borderColor: isUser ? theme.primary : theme.border,
        },
      ]}>
        <Text style={[
          styles.messageText,
          { color: isUser ? '#fff' : theme.text },
        ]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
};

// ── Template suggestion card ──────────────────

interface TemplateSuggestion {
  name: string;
  description?: string;
  exercises: Array<{ name: string; sets: number; reps: number; rest_seconds: number }>;
}

const TemplateSuggestionCard: React.FC<{
  template: TemplateSuggestion;
  onAccept: () => void;
  onDismiss: () => void;
  isCreating: boolean;
  theme: any;
}> = ({ template, onAccept, onDismiss, isCreating, theme }) => (
  <View style={[templateStyles.card, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
    <View style={templateStyles.cardHeader}>
      <Text style={{ fontSize: 24 }}>📋</Text>
      <View style={{ flex: 1 }}>
        <Text style={[templateStyles.title, { color: theme.text }]}>{template.name}</Text>
        {template.description ? (
          <Text style={[templateStyles.desc, { color: theme.textSecondary }]}>{template.description}</Text>
        ) : null}
      </View>
    </View>
    {template.exercises.slice(0, 5).map((ex, i) => (
      <Text key={i} style={[templateStyles.exerciseRow, { color: theme.textSecondary }]}>
        • {ex.name} — {ex.sets}×{ex.reps}  Rest {ex.rest_seconds}s
      </Text>
    ))}
    {template.exercises.length > 5 && (
      <Text style={[templateStyles.exerciseRow, { color: theme.textTertiary }]}>
        +{template.exercises.length - 5} more exercises
      </Text>
    )}
    <View style={templateStyles.actions}>
      <TouchableOpacity
        onPress={onDismiss}
        style={[templateStyles.btn, templateStyles.dismissBtn, { borderColor: theme.border }]}
      >
        <Text style={{ color: theme.textSecondary, fontWeight: FontWeight.medium }}>No thanks</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onAccept}
        disabled={isCreating}
        style={[templateStyles.btn, templateStyles.acceptBtn, { backgroundColor: theme.primary }]}
      >
        {isCreating ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: FontWeight.semibold }}>✅ Create Template</Text>
        )}
      </TouchableOpacity>
    </View>
  </View>
);

const templateStyles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg, borderWidth: 2,
    padding: Spacing.md, gap: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  desc: { fontSize: FontSize.sm, marginTop: 2 },
  exerciseRow: { fontSize: FontSize.sm, paddingLeft: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  btn: {
    flex: 1, padding: Spacing.sm, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center', minHeight: 40,
  },
  dismissBtn: { borderWidth: 1 },
  acceptBtn: {},
});

// ── Suggested prompts ─────────────────────────

const SUGGESTED_PROMPTS = [
  "How did I do this week?",
  "What should I focus on today?",
  "Suggest progression for my bench press",
  "Am I eating enough protein?",
  "Create a 3-day workout plan for me",
];

// ── Main Coach Screen ─────────────────────────

export default function CoachScreen() {
  const theme = useTheme();
  const { user, profile, updateProfile } = useAuthStore();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [suggestedTemplate, setSuggestedTemplate] = useState<TemplateSuggestion | null>(null);
  const [conversationId] = useState(() => generateId());
  const flatListRef = useRef<FlatList>(null);

  const needsOnboarding = !profile?.coach_onboarding_complete;

  // Fetch exercises for template name-matching
  const { data: allExercises = [] } = useQuery<Exercise[]>({
    queryKey: ['exercises'],
    queryFn: async () => {
      const { data } = await supabase
        .from('exercises')
        .select('id, name, primary_muscles')
        .or(`is_custom.eq.false,user_id.eq.${user?.id}`)
        .order('name');
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (messages.length === 0 && !needsOnboarding) {
      setMessages([{
        id: generateId(),
        conversation_id: conversationId,
        role: 'assistant',
        content: `Hey${profile?.display_name ? ` ${profile.display_name}` : ''}! 👋 I'm your Personal Coach powered by GPT-4o. I can see your workout history and nutrition data.\n\nAsk me anything — or try "Create a 3-day workout plan for me"!`,
        created_at: new Date().toISOString(),
      }]);
    }
  }, [needsOnboarding]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || !user) return;

    setInput('');
    setSuggestedTemplate(null);
    Keyboard.dismiss();

    const userMsg: ChatMessage = {
      id: generateId(),
      conversation_id: conversationId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Fetch context data
      const [workoutsRes, mealsRes] = await Promise.all([
        supabase
          .from('workouts')
          .select('id, name, started_at, total_volume_kg, duration_seconds')
          .eq('user_id', user.id)
          .not('finished_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(7),
        supabase
          .from('meals')
          .select('name, eaten_at, meal_items(kcal, protein_g, carbs_g, fat_g)')
          .eq('user_id', user.id)
          .gte('eaten_at', new Date(Date.now() - 7 * 86400000).toISOString())
          .limit(14),
      ]);

      // Build context in the format the edge function expects
      const context = {
        profile: {
          name: profile?.display_name ?? undefined,
          fitness_goal: (profile?.coach_goals as any)?.primary_goal ?? undefined,
          experience_level: (profile?.coach_goals as any)?.experience_level ?? undefined,
          body_weight_kg: (profile as any)?.body_weight_kg ?? undefined,
        },
        recentWorkouts: (workoutsRes.data ?? []).map((w: any) => ({
          name: w.name,
          date: w.started_at?.split('T')[0] ?? '',
          duration_seconds: w.duration_seconds ?? 0,
          total_volume_kg: w.total_volume_kg ?? 0,
        })),
        recentMeals: (mealsRes.data ?? []).map((m: any) => {
          const items = m.meal_items ?? [];
          return {
            date: m.eaten_at?.split('T')[0] ?? '',
            kcal: Math.round(items.reduce((s: number, i: any) => s + (i.kcal ?? 0), 0)),
            protein: Math.round(items.reduce((s: number, i: any) => s + (i.protein_g ?? 0), 0)),
            carbs: Math.round(items.reduce((s: number, i: any) => s + (i.carbs_g ?? 0), 0)),
            fat: Math.round(items.reduce((s: number, i: any) => s + (i.fat_g ?? 0), 0)),
          };
        }),
        conversationHistory: messages.slice(-8).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      };

      let reply = '';
      let receivedTemplate: TemplateSuggestion | null = null;

      if (COACH_ENDPOINT && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const res = await fetch(COACH_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ message: content, context }),
            signal: controller.signal,
          });
          if (res.ok) {
            const data = await res.json();
            reply = data.reply ?? 'Sorry, I could not generate a response.';
            receivedTemplate = data.suggestedTemplate ?? null;
          } else {
            reply = generateHeuristicReply(content, { user_goals: profile?.coach_goals, recent_workouts: workoutsRes.data ?? [], recent_meals: [] });
          }
        } catch {
          reply = generateHeuristicReply(content, { user_goals: profile?.coach_goals, recent_workouts: workoutsRes.data ?? [], recent_meals: [] });
        } finally {
          clearTimeout(timeout);
        }
      } else {
        reply = generateHeuristicReply(content, { user_goals: profile?.coach_goals, recent_workouts: workoutsRes.data ?? [], recent_meals: [] });
      }

      const assistantMsg: ChatMessage = {
        id: generateId(),
        conversation_id: conversationId,
        role: 'assistant',
        content: reply,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);
      if (receivedTemplate) setSuggestedTemplate(receivedTemplate);

      // Fire-and-forget — don't block on DB insert
      supabase.from('coach_messages').insert([
        { ...userMsg, user_id: user.id },
        { ...assistantMsg, user_id: user.id },
      ]).then(() => {}).catch(() => {});
    } catch (err) {
      console.error('[Coach] Error:', err);
      setMessages(prev => [...prev, {
        id: generateId(),
        conversation_id: conversationId,
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again.",
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleCreateTemplate = async () => {
    if (!suggestedTemplate || !user) return;
    setIsCreatingTemplate(true);
    try {
      // Create the template
      const { data: tmpl, error: tmplErr } = await supabase
        .from('templates')
        .insert({
          user_id: user.id,
          name: suggestedTemplate.name,
          description: suggestedTemplate.description ?? null,
        })
        .select('id')
        .single();
      if (tmplErr) throw tmplErr;

      // Match exercises by name and insert
      let matchedCount = 0;
      for (let i = 0; i < suggestedTemplate.exercises.length; i++) {
        const ex = suggestedTemplate.exercises[i];
        const found = allExercises.find(
          e => e.name.toLowerCase() === ex.name.toLowerCase()
            || e.name.toLowerCase().includes(ex.name.toLowerCase())
        );
        if (!found) continue;

        const { data: te, error: teErr } = await supabase
          .from('template_exercises')
          .insert({
            template_id: tmpl.id,
            exercise_id: found.id,
            order_index: i,
          })
          .select('id')
          .single();
        if (teErr) continue;

        matchedCount++;
        const setsToInsert = Array.from({ length: ex.sets }, (_, j) => ({
          template_exercise_id: te.id,
          set_number: j + 1,
          target_reps: ex.reps,
          rest_seconds: ex.rest_seconds ?? 90,
        }));
        await supabase.from('template_sets').insert(setsToInsert);
      }

      setSuggestedTemplate(null);
      qc.invalidateQueries({ queryKey: ['templates'] });
      alertDialog(
        '✅ Template Created!',
        `"${suggestedTemplate.name}" added to your Workouts tab with ${matchedCount}/${suggestedTemplate.exercises.length} exercises matched.${matchedCount < suggestedTemplate.exercises.length ? '\n\nSome exercises not found in library — add them manually.' : ''}`
      );
    } catch (err: any) {
      alertDialog('Error', err.message ?? 'Failed to create template');
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  const handleOnboardingComplete = async (goals: Partial<CoachGoals>) => {
    await updateProfile({
      coach_onboarding_complete: true,
      coach_goals: goals as CoachGoals,
    });
    setMessages([{
      id: generateId(),
      conversation_id: conversationId,
      role: 'assistant',
      content: `Perfect! 🎯 Goal set: **${formatGoal(goals.primary_goal)}**. I'm ready to help you with ${goals.experience_level ?? 'your'} level training ${goals.training_frequency_per_week ?? 3}x per week.\n\nStart logging workouts and meals and I'll give you personalized coaching!`,
      created_at: new Date().toISOString(),
    }]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={{ fontSize: 24 }}>🤖</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heading, { color: theme.text }]}>Personal Coach</Text>
          <Text style={[styles.subheading, { color: theme.textSecondary }]}>GPT-4o powered advisor</Text>
        </View>
      </View>

      {needsOnboarding ? (
        <ScrollView contentContainerStyle={styles.onboardingContainer}>
          <OnboardingModal onComplete={handleOnboardingComplete} theme={theme} />
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={() => (
              messages.length === 0 ? (
                <View style={styles.suggestedContainer}>
                  <Text style={[styles.suggestedTitle, { color: theme.textSecondary }]}>
                    Suggested questions
                  </Text>
                  {SUGGESTED_PROMPTS.map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.suggestedBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
                      onPress={() => sendMessage(p)}
                    >
                      <Text style={[styles.suggestedText, { color: theme.text }]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null
            )}
            renderItem={({ item }) => <MessageBubble message={item} theme={theme} />}
            ListFooterComponent={() => (
              <>
                {isLoading && (
                  <View style={styles.typingIndicator}>
                    <Text style={{ fontSize: 16 }}>🤖</Text>
                    <View style={[styles.typingBubble, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <ActivityIndicator size="small" color={theme.primary} />
                      <Text style={{ color: theme.textSecondary, fontSize: FontSize.sm }}>Thinking...</Text>
                    </View>
                  </View>
                )}
                {suggestedTemplate && (
                  <TemplateSuggestionCard
                    template={suggestedTemplate}
                    onAccept={handleCreateTemplate}
                    onDismiss={() => setSuggestedTemplate(null)}
                    isCreating={isCreatingTemplate}
                    theme={theme}
                  />
                )}
              </>
            )}
          />

          {/* Input */}
          <View style={[styles.inputRow, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <TextInput
              style={[styles.chatInput, { color: theme.text, backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
              value={input}
              onChangeText={setInput}
              placeholder="Ask your coach..."
              placeholderTextColor={theme.textTertiary}
              multiline
              maxLength={500}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              style={[
                styles.sendBtn,
                { backgroundColor: input.trim() ? theme.primary : theme.surfaceHighlight },
              ]}
            >
              <Text style={{ fontSize: 18 }}>↑</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

// ── Heuristic fallback (no LLM) ──────────────

function generateHeuristicReply(message: string, context: any): string {
  const lower = message.toLowerCase();
  const workouts = context.recent_workouts ?? [];

  if (lower.includes('week') || lower.includes('how did')) {
    const count = workouts.length;
    const vol = workouts.reduce((s: number, w: any) => s + (w.total_volume_kg ?? 0), 0);
    return `This week you've completed ${count} workout${count !== 1 ? 's' : ''} with ${Math.round(vol)} kg total volume. ${count >= 3 ? 'Great consistency! 🔥' : count > 0 ? 'Keep going! 💪' : 'No workouts yet this week — let\'s get moving!'}`;
  }

  if (lower.includes('protein') || lower.includes('nutrition')) {
    return `Aim for 1.6–2.2g of protein per kg of bodyweight. Track your meals in the Meals tab for personalized advice! 🥩`;
  }

  return `Great question! Connect your OpenAI key in Supabase Secrets (AI_PROVIDER=openai, OPENAI_API_KEY=sk-...) for full AI coaching. 💪`;
}

function formatGoal(goal?: string): string {
  const map: Record<string, string> = {
    muscle_gain: 'Muscle Gain', fat_loss: 'Fat Loss',
    strength: 'Strength', maintenance: 'Maintenance', general_fitness: 'General Fitness',
  };
  return map[goal ?? ''] ?? goal ?? 'Fitness';
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  heading: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold },
  subheading: { fontSize: FontSize.sm },
  messageList: { padding: Spacing.lg, gap: Spacing.md },
  messageBubble: { marginBottom: Spacing.sm },
  userBubble: { alignItems: 'flex-end' },
  assistantBubble: { alignItems: 'flex-start' },
  bubbleContent: {
    maxWidth: '85%', padding: Spacing.md,
    borderRadius: BorderRadius.lg, borderWidth: 1,
  },
  messageText: { fontSize: FontSize.md, lineHeight: 22 },
  typingIndicator: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    padding: Spacing.sm,
  },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    padding: Spacing.md, borderTopWidth: 1,
  },
  chatInput: {
    flex: 1, borderWidth: 1, borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, maxHeight: 100, minHeight: 44,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  // Onboarding
  onboardingContainer: { padding: Spacing.lg },
  onboarding: {
    borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.xl,
    gap: Spacing.lg,
  },
  onboardingQ: {
    fontSize: FontSize.lg, fontWeight: FontWeight.semibold,
    textAlign: 'center', lineHeight: 24,
  },
  optionsList: { gap: Spacing.sm },
  optionBtn: {
    padding: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1, alignItems: 'center',
  },
  optionText: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  onboardingInput: {
    borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md,
    fontSize: FontSize.md,
  },
  // Suggested prompts
  suggestedContainer: { gap: Spacing.sm, paddingBottom: Spacing.lg },
  suggestedTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginBottom: Spacing.sm },
  suggestedBtn: {
    padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1,
  },
  suggestedText: { fontSize: FontSize.sm },
});
