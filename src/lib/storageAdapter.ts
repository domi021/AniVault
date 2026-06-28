import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupportedStorage } from '@supabase/supabase-js';

export function createAsyncStorageAdapter(): SupportedStorage {
  return {
    getItem: async (key: string) => {
      const value = await AsyncStorage.getItem(key);
      return value;
    },
    setItem: async (key: string, value: string) => {
      await AsyncStorage.setItem(key, value);
    },
    removeItem: async (key: string) => {
      await AsyncStorage.removeItem(key);
    },
  };
}
