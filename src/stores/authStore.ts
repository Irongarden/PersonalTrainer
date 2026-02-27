import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isInitialized: boolean;
  isLoading: boolean;

  initialize: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data as Profile;
}

async function upsertProfile(userId: string, updates: Partial<Profile>): Promise<void> {
  await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isInitialized: false,
  isLoading: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let profile: Profile | null = null;
      if (session?.user) {
        profile = await fetchProfile(session.user.id);
      }
      set({
        session,
        user: session?.user ?? null,
        profile,
        isInitialized: true,
      });
    } catch {
      set({ isInitialized: true });
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      let profile: Profile | null = null;
      if (session?.user) {
        profile = await fetchProfile(session.user.id);
      }
      set({
        session,
        user: session?.user ?? null,
        profile,
      });
    });
  },

  signInWithEmail: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const profile = data.user ? await fetchProfile(data.user.id) : null;
      set({ session: data.session, user: data.user, profile });
    } finally {
      set({ isLoading: false });
    }
  },

  signUpWithEmail: async (email, password, displayName) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) {
        await upsertProfile(data.user.id, {
          display_name: displayName ?? null,
          unit_system: 'metric',
          theme: 'dark',
          default_rest_seconds: 90,
        });
        const profile = await fetchProfile(data.user.id);
        set({ session: data.session, user: data.user, profile });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return;
    // Optimistic update
    set(s => ({ profile: s.profile ? { ...s.profile, ...updates } : null }));
    await upsertProfile(user.id, updates);
  },
}));
