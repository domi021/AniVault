import { Anime, RecommendationsResponse, SearchResponse } from '../types';

const KITSU_API = 'https://kitsu.io/api/edge';
const LIMIT = 20;

async function fetchKitsu<T>(path: string): Promise<T> {
  const res = await fetch(`${KITSU_API}${path}`, {
    headers: { Accept: 'application/vnd.api+json' },
  });
  if (!res.ok) throw new Error(`Kitsu error: ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0]?.title || 'Kitsu query failed');
  return json as T;
}

function malIdFromMappings(item: any, included: any[]): number | null {
  const refs = item?.relationships?.mappings?.data ?? [];
  for (const ref of refs) {
    const mapping = included?.find((i) => i.type === 'mappings' && i.id === ref.id);
    if (mapping?.attributes?.externalSite === 'myanimelist/anime') {
      const id = parseInt(mapping.attributes.externalId, 10);
      if (!Number.isNaN(id)) return id;
    }
  }
  return null;
}

function mapKitsuToAnime(item: any, malId: number | null): Anime {
  const attrs = item?.attributes ?? {};
  const poster = attrs.posterImage ?? {};
  const img = poster.original || poster.large || poster.medium || '';
  const titles = attrs.titles ?? {};
  return {
    mal_id: malId ?? parseInt(item.id, 10),
    title: titles.en_jp || attrs.canonicalTitle || '',
    title_english: titles.en || undefined,
    synopsis: attrs.synopsis || undefined,
    images: {
      jpg: {
        image_url: img,
        small_image_url: poster.medium || poster.small || img,
        large_image_url: img,
      },
    },
    episodes: attrs.episodeCount ?? undefined,
    status: attrs.status || undefined,
    score: attrs.averageRating != null ? parseFloat(attrs.averageRating) / 10 : undefined,
    type: attrs.subtype ? attrs.subtype.toUpperCase() : undefined,
    aired: attrs.startDate ? { from: attrs.startDate } : undefined,
  };
}

function findItem(data: any, included: any[]): Anime {
  const item = Array.isArray(data?.data) ? data.data[0] : data?.data;
  if (!item) throw new Error('Kitsu: anime not found');
  return mapKitsuToAnime(item, malIdFromMappings(item, included ?? []));
}

export async function searchKitsuAnime(query: string, page = 1): Promise<SearchResponse> {
  const q = encodeURIComponent(query);
  const offset = (page - 1) * LIMIT;
  const url = `/anime?filter%5Btext%5D=${q}&page%5Blimit%5D=${LIMIT}&page%5Boffset%5D=${offset}&sort=-user_count&include=mappings`;
  const data = await fetchKitsu<any>(url);
  const items: any[] = data.data ?? [];
  const included: any[] = data.included ?? [];
  const count = data.meta?.count ?? 0;
  return {
    data: items.map((item) => mapKitsuToAnime(item, malIdFromMappings(item, included))),
    pagination: {
      last_visible_page: Math.max(1, Math.ceil(count / LIMIT)),
      has_next_page: offset + LIMIT < count,
    },
  };
}

async function kitsuIdForMalId(malId: number): Promise<string | null> {
  const url = `/mappings?filter%5BexternalSite%5D=myanimelist%2Fanime&filter%5BexternalId%5D=${malId}&include=item`;
  const data = await fetchKitsu<any>(url);
  const mapping = data.data?.[0];
  return mapping?.relationships?.item?.data?.id ?? null;
}

export async function getKitsuAnimeByMalId(malId: number): Promise<{ data: Anime }> {
  let kitsuId: string | null = null;
  try {
    kitsuId = await kitsuIdForMalId(malId);
  } catch {
    kitsuId = null;
  }
  if (kitsuId) {
    const data = await fetchKitsu<any>(`/anime/${kitsuId}?include=mappings`);
    return { data: findItem(data, data.included) };
  }
  const data = await fetchKitsu<any>(`/anime/${malId}?include=mappings`);
  return { data: findItem(data, data.included) };
}

export async function getKitsuRecommendations(): Promise<RecommendationsResponse> {
  const url = `/anime?page%5Blimit%5D=${LIMIT}&sort=-user_count&include=mappings`;
  const data = await fetchKitsu<any>(url);
  const items: any[] = data.data ?? [];
  const included: any[] = data.included ?? [];
  return {
    data: items.map((item) => ({
      entry: mapKitsuToAnime(item, malIdFromMappings(item, included)),
      url: '',
      votes: 0,
    })),
  };
}

function titleMatch(searchTitle: string, anime: Anime): boolean {
  const t = (anime.title_english || anime.title).toLowerCase();
  const s = searchTitle.toLowerCase();
  return t === s || t.includes(s) || s.includes(t);
}

export async function searchKitsuAnimeByTitle(title: string): Promise<Anime | null> {
  try {
    const clean = title.replace(/[\(\[].*?[\)\]]/g, '').replace(/\s+/g, ' ').trim();
    if (!clean) return null;
    const res = await searchKitsuAnime(clean, 1);
    for (const a of res.data) {
      if (titleMatch(clean, a)) return a;
    }
    return res.data[0] ?? null;
  } catch {
    return null;
  }
}
