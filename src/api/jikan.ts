import { Anime } from '../types';

const ANILIST_API = 'https://graphql.anilist.co';

async function fetchAniList<T>(query: string, variables: Record<string, any>): Promise<T> {
  const res = await fetch(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || 'AniList query failed');
  return json.data as T;
}

function mapAniListToAnime(m: any): Anime {
  const img = m.coverImage?.large || m.coverImage?.medium || '';
  return {
    mal_id: m.idMal ?? m.id,
    title: m.title?.romaji || m.title?.native || '',
    title_english: m.title?.english || undefined,
    synopsis: m.description?.replace(/<[^>]*>/g, '') || undefined,
    images: {
      jpg: {
        image_url: img,
        small_image_url: m.coverImage?.medium || img,
        large_image_url: img,
      },
    },
    episodes: m.episodes ?? undefined,
    status: m.status || undefined,
    score: m.averageScore != null ? m.averageScore / 10 : undefined,
    genres: m.genres?.map((g: any, i: number) => ({ mal_id: i, name: typeof g === 'string' ? g : g.name || '' })) || undefined,
    studios: m.studios?.edges?.map((e: any, i: number) => ({ mal_id: i, name: e.node?.name || '' })) || undefined,
    type: m.format || undefined,
    aired: m.startDate?.year ? { from: `${m.startDate.year}-${m.startDate.month}-${m.startDate.day}` } : undefined,
  };
}

export interface Pagination {
  last_visible_page: number;
  has_next_page: boolean;
}

export interface SearchResponse {
  data: Anime[];
  pagination: Pagination;
}

const SEARCH_QUERY = `
query ($page: Int, $search: String) {
  Page(page: $page, perPage: 25) {
    media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
      id idMal
      title { romaji english native }
      coverImage { large medium }
      episodes averageScore status format
      genres
    }
    pageInfo { lastPage hasNextPage }
  }
}`;

export async function searchAnime(query: string, page = 1): Promise<SearchResponse> {
  const data = await fetchAniList<any>(SEARCH_QUERY, { page, search: query });
  const pageData = data.Page;
  return {
    data: (pageData.media ?? []).map(mapAniListToAnime),
    pagination: {
      last_visible_page: pageData.pageInfo?.lastPage ?? 1,
      has_next_page: pageData.pageInfo?.hasNextPage ?? false,
    },
  };
}

const ANIME_BY_ID_QUERY = `
query ($idMal: Int) {
  Media(idMal: $idMal, type: ANIME) {
    id idMal
    title { romaji english native }
    description(asHtml: false)
    coverImage { large medium }
    episodes averageScore status format
    genres
    startDate { year month day }
    streamingEpisodes { title thumbnail url site }
  }
}`;

export function getAnimeById(id: number): Promise<{ data: Anime }> {
  return fetchAniList<any>(ANIME_BY_ID_QUERY, { idMal: id }).then((data) => ({
    data: mapAniListToAnime(data.Media),
  }));
}

export interface Recommendation {
  entry: Anime;
  url: string;
  votes: number;
}

export interface RecommendationsResponse {
  data: Recommendation[];
}

const RECOMMENDATIONS_QUERY = `
query ($idMal: Int) {
  Media(idMal: $idMal, type: ANIME) {
    recommendations(perPage: 20, sort: RATING_DESC) {
      edges {
        node {
          rating
          mediaRecommendation {
            id idMal
            title { romaji english native }
            coverImage { large medium }
            episodes averageScore status format
            genres
          }
        }
      }
    }
  }
}`;

export function getAnimeRecommendations(id: number): Promise<RecommendationsResponse> {
  return fetchAniList<any>(RECOMMENDATIONS_QUERY, { idMal: id }).then((data) => {
    const edges = data.Media?.recommendations?.edges ?? [];
    return {
      data: edges
        .filter((e: any) => e.node?.mediaRecommendation?.idMal)
        .map((e: any) => ({
          entry: mapAniListToAnime(e.node.mediaRecommendation),
          url: '',
          votes: e.node.rating ?? 0,
        })),
    };
  });
}

export { fetchAniList };

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

const SEARCH_MEDIA_QUERY = `
query ($search: String) {
  Media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
    id idMal
    title { romaji english native }
    coverImage { large medium }
    episodes averageScore status format
    genres
  }
}`;

export async function searchAnimeByTitle(title: string): Promise<Anime | null> {
  try {
    let clean = title.replace(/[\(\[].*?[\)\]]/g, '').replace(/\s+/g, ' ').trim();
    if (!clean) return null;

    const words = clean.split(/\s+/);
    const queries = words.length > 3
      ? [clean, words.slice(0, 3).join(' '), words[0]]
      : [clean];

    for (const q of queries) {
      const data = await fetchAniList<any>(SEARCH_MEDIA_QUERY, { search: q });
      const results = data.Media ? [data.Media] : [];
      if (!results.length) continue;

      const mapped = results.map(mapAniListToAnime);
      for (const a of mapped) {
        if (titleMatch(clean, a)) return a;
      }
      return mapped[0];
    }
    return null;
  } catch {
    return null;
  }
}

const ANILIST_USER_LIST_QUERY = `
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
}`;

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
      query: ANILIST_USER_LIST_QUERY,
      variables: { username },
    }),
  });
  if (!res.ok) throw new Error(`AniList error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || 'User not found');
  const lists = json.data?.MediaListCollection?.lists ?? [];
  return lists.flatMap((l: any) => l.entries);
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
