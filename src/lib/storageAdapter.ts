import type { SupportedStorage } from '@supabase/supabase-js';

function getAsyncStorage() {
  try {
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    return null;
  }
}

function makeFallbackStorage(): SupportedStorage {
  const store = new Map<string, string>();
  return {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => { store.set(key, value); },
    removeItem: async (key: string) => { store.delete(key); },
  };
}

let _adapter: SupportedStorage | null = null;

export function createAsyncStorageAdapter(): SupportedStorage {
  if (!_adapter) {
    const storage = getAsyncStorage();
    _adapter = storage
      ? {
          getItem: async (key: string) => {
            const value = await storage.getItem(key);
            return value;
          },
          setItem: async (key: string, value: string) => {
            await storage.setItem(key, value);
          },
          removeItem: async (key: string) => {
            await storage.removeItem(key);
          },
        }
      : makeFallbackStorage();
  }
  return _adapter;
}
