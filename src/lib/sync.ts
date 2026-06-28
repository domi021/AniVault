import { supabase } from './supabase';
import { UserAnime } from '../types';

export async function uploadAnimes(animes: UserAnime[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const rows = animes.map((a) => ({
    user_id: user.id,
    mal_id: a.mal_id,
    title: a.title,
    image_url: a.image_url,
    status: a.status,
    episodes_watched: a.episodes_watched,
    total_episodes: a.total_episodes ?? null,
    score: a.score ?? null,
    added_at: a.added_at,
    favorite: a.favorite ?? false,
  }));

  const { error } = await supabase.from('user_anime').upsert(rows, {
    onConflict: 'user_id,mal_id',
    ignoreDuplicates: false,
  });
  if (error) throw error;
}

export async function downloadAnimes(): Promise<UserAnime[] | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_anime')
    .select('*')
    .eq('user_id', user.id);

  if (error) throw error;
  if (!data) return [];

  return data.map((row) => ({
    mal_id: row.mal_id,
    title: row.title,
    image_url: row.image_url,
    status: row.status as UserAnime['status'],
    episodes_watched: row.episodes_watched,
    total_episodes: row.total_episodes ?? undefined,
    score: row.score ?? undefined,
    added_at: row.added_at,
    favorite: row.favorite ?? false,
  }));
}
