import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { UserAnime, WatchStatus } from '../types';
import { uploadAnimes, downloadAnimes } from '../lib/sync';

function mapMALStatus(status: string): WatchStatus {
  switch (status) {
    case 'watching': return 'watching';
    case 'completed': return 'completed';
    case 'on_hold': return 'watching';
    case 'plan_to_watch': return 'plan_to_watch';
    case 'dropped': return 'dropped';
    default: return 'plan_to_watch';
  }
}

export type SortOrder = 'desc' | 'asc';

interface AnimeState {
  animes: UserAnime[];
  sortOrder: SortOrder;
  addAnime: (anime: UserAnime) => void;
  removeAnime: (mal_id: number) => void;
  updateStatus: (mal_id: number, status: WatchStatus) => void;
  updateEpisodes: (mal_id: number, episodes: number) => void;
  updateScore: (mal_id: number, score: number) => void;
  getList: (status: WatchStatus) => UserAnime[];
  importFromMAL: (entries: any[]) => void;
  setSortOrder: (order: SortOrder) => void;
  toggleFavorite: (mal_id: number) => void;
  syncToServer: () => Promise<void>;
  fetchFromServer: () => Promise<void>;
}

export const useAnimeStore = create<AnimeState>()(
  persist(
    (set, get) => ({
      animes: [],
      sortOrder: 'desc',

      addAnime: (anime) => {
        set((state) => {
          if (state.animes.some((a) => a.mal_id === anime.mal_id)) {
            return state;
          }
          return { animes: [anime, ...state.animes] };
        });
        uploadAnimes(get().animes).catch(() => {});
      },

      removeAnime: (mal_id) => {
        set((state) => ({
          animes: state.animes.filter((a) => a.mal_id !== mal_id),
        }));
        uploadAnimes(get().animes).catch(() => {});
      },

      updateStatus: (mal_id, status) => {
        set((state) => ({
          animes: state.animes.map((a) =>
            a.mal_id === mal_id ? { ...a, status } : a
          ),
        }));
        uploadAnimes(get().animes).catch(() => {});
      },

      updateEpisodes: (mal_id, episodes) => {
        set((state) => ({
          animes: state.animes.map((a) =>
            a.mal_id === mal_id ? { ...a, episodes_watched: episodes } : a
          ),
        }));
        uploadAnimes(get().animes).catch(() => {});
      },

      updateScore: (mal_id, score) => {
        set((state) => ({
          animes: state.animes.map((a) =>
            a.mal_id === mal_id ? { ...a, score } : a
          ),
        }));
        uploadAnimes(get().animes).catch(() => {});
      },

      getList: (status) => {
        const { animes, sortOrder } = get();
        return animes
          .filter((a) => a.status === status)
          .sort((a, b) => {
            if (a.favorite && !b.favorite) return -1;
            if (!a.favorite && b.favorite) return 1;
            const sa = a.score ?? -1;
            const sb = b.score ?? -1;
            return sortOrder === 'desc' ? sb - sa : sa - sb;
          });
      },

      setSortOrder: (sortOrder) => set({ sortOrder }),

      toggleFavorite: (mal_id) => {
        set((state) => ({
          animes: state.animes.map((a) =>
            a.mal_id === mal_id ? { ...a, favorite: !a.favorite } : a,
          ),
        }));
        uploadAnimes(get().animes).catch(() => {});
      },

      importFromMAL: (entries) => {
        set((state) => {
          const existing = new Set(state.animes.map((a) => a.mal_id));
          const newAnimes: UserAnime[] = entries
            .filter((e) => !existing.has(e.mal_id))
            .map((e) => ({
              mal_id: e.mal_id,
              title: e.anime.title,
              image_url: e.anime.images.jpg.image_url,
              status: mapMALStatus(e.status),
              episodes_watched: e.episodes_watched,
              total_episodes: e.anime.episodes,
              score: e.score || undefined,
              added_at: Date.now(),
            }));
          return { animes: [...newAnimes, ...state.animes] };
        });
        uploadAnimes(get().animes).catch(() => {});
      },

      syncToServer: async () => {
        await uploadAnimes(get().animes);
      },

      fetchFromServer: async () => {
        const animes = await downloadAnimes();
        if (animes) set({ animes });
      },
    }),
    {
      name: 'anime-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
