import { Anime } from '../types';

const BASE_URL = 'https://api.jikan.moe/v4';

async function fetchJikan<T>(endpoint: string): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jikan error: ${res.status}`);
  const data = await res.json();
  return data as T;
}

export interface Pagination {
  last_visible_page: number;
  has_next_page: boolean;
}

export interface SearchResponse {
  data: Anime[];
  pagination: Pagination;
}

export function searchAnime(query: string, page = 1): Promise<SearchResponse> {
  return fetchJikan<SearchResponse>(
    `/anime?q=${encodeURIComponent(query)}&page=${page}&sfw=true`
  );
}

export function getAnimeById(id: number): Promise<{ data: Anime }> {
  return fetchJikan<{ data: Anime }>(`/anime/${id}/full`);
}

export interface Recommendation {
  entry: Anime;
  url: string;
  votes: number;
}

export interface RecommendationsResponse {
  data: Recommendation[];
}

export function getAnimeRecommendations(id: number): Promise<RecommendationsResponse> {
  return fetchJikan<RecommendationsResponse>(`/anime/${id}/recommendations`);
}

const ANILIST_API = 'https://graphql.anilist.co';

const ANILIST_QUERY = `
query ($username: String) {
  MediaListCollection(userName: $username, type: ANIME) {
    lists {
      entries {
        media {
          idMal
          title { romaji english }
          coverImage { large }
          episodes
        }
        status
        score
        progress
      }
    }
  }
}
`;

export interface AniListEntry {
  media: {
    idMal: number;
    title: { romaji: string; english: string | null };
    coverImage: { large: string };
    episodes: number | null;
  };
  status: string;
  score: number;
  progress: number;
}

export async function getAniList(username: string): Promise<AniListEntry[]> {
  const res = await fetch(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: ANILIST_QUERY,
      variables: { username },
    }),
  });
  if (!res.ok) throw new Error(`AniList error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || 'User not found');
  const lists = json.data?.MediaListCollection?.lists ?? [];
  return lists.flatMap((l: any) => l.entries);
}

export interface ParsedAnimeLine {
  name: string;
  score?: number;
}

function extractScore(line: string): { name: string; score?: number } {
  let clean = line.trim();
  let score: number | undefined;

  const startDec = clean.match(/^(\d+\.\d+)\s+(.+)$/);
  if (startDec) {
    const s = parseFloat(startDec[1]);
    if (s >= 1 && s <= 10) score = s;
    clean = startDec[2].trim();
    return { name: clean, score };
  }

  const startFrac = clean.match(/^(\d+(?:\.\d+)?)\s*\/\s*10\s+(.+)$/);
  if (startFrac) {
    const s = parseFloat(startFrac[1]);
    if (s >= 1 && s <= 10) score = s;
    clean = startFrac[2].trim();
    return { name: clean, score };
  }

  const sep = clean.match(/^(.+?)\s*[-–:]\s*(\d+(?:\.\d+)?)(?:\/10)?\s*$/);
  if (sep) {
    const s = parseFloat(sep[2]);
    if (s >= 1 && s <= 10) score = s;
    clean = sep[1].trim();
    return { name: clean, score };
  }

  const plain = clean.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
  if (plain) {
    const s = parseFloat(plain[2]);
    if (s >= 1 && s <= 10) score = s;
    clean = plain[1].trim();
    return { name: clean, score };
  }

  const free = clean.match(/^(.+)\s+(\d+(?:\.\d+)?)\s*\/\s*10\s*$/);
  if (free) {
    const s = parseFloat(free[2]);
    if (s >= 1 && s <= 10) score = s;
    clean = free[1].trim();
    return { name: clean, score };
  }

  return { name: clean, score: undefined };
}

export function parseAnimeText(text: string): ParsedAnimeLine[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const { name, score } = extractScore(line);
      let clean = name.replace(/^[-–:*\s]+|[-–:*\s]+$/g, '');
      clean = clean.replace(/[\(\[].*?[\)\]]/g, '').replace(/\s+/g, ' ').trim();
      return { name: clean, score };
    });
}

function titleMatch(searchTitle: string, anime: Anime): boolean {
  const t = (anime.title_english || anime.title).toLowerCase();
  const s = searchTitle.toLowerCase();
  return t === s || t.includes(s) || s.includes(t);
}

export async function searchAnimeByTitle(title: string): Promise<Anime | null> {
  try {
    let clean = title.replace(/[\(\[].*?[\)\]]/g, '').replace(/\s+/g, ' ').trim();
    if (!clean) return null;

    const words = clean.split(/\s+/);
    const queries = words.length > 3
      ? [clean, words.slice(0, 3).join(' '), words[0]]
      : [clean];

    for (const q of queries) {
      const res = await searchAnime(q, 1);
      const results = res.data;
      if (!results.length) continue;

      for (const a of results) {
        if (titleMatch(clean, a)) return a;
      }
      return results[0];
    }
    return null;
  } catch {
    return null;
  }
}

export function mapAniListStatus(status: string): string {
  switch (status) {
    case 'CURRENT': return 'watching';
    case 'COMPLETED': return 'completed';
    case 'PLANNING': return 'plan_to_watch';
    case 'DROPPED': return 'dropped';
    case 'PAUSED': return 'on_hold';
    case 'REPEATING': return 'watching';
    default: return 'plan_to_watch';
  }
}
