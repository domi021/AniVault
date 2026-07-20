import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AudioType = 'sub' | 'dub';

interface PreferenceState {
  audioType: AudioType;
  setAudioType: (type: AudioType) => void;
}

export const usePreferenceStore = create<PreferenceState>()(
  persist(
    (set) => ({
      audioType: 'sub',
      setAudioType: (audioType) => set({ audioType }),
    }),
    {
      name: 'preference-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
