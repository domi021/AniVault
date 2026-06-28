import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  isGuest: boolean;
  avatarColor: string;
  setSession: (session: Session | null) => void;
  setGuest: (isGuest: boolean) => void;
  signOut: () => void;
  setAvatarColor: (color: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      isGuest: false,
      avatarColor: '#3b82f6',
      setSession: (session) => set({ session, isGuest: false }),
      setGuest: (isGuest) => set({ isGuest, session: null }),
      signOut: () => set({ session: null, isGuest: false }),
      setAvatarColor: (avatarColor) => set({ avatarColor }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
