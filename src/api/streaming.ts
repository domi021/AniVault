const DEFAULT_BASE = 'https://anipub.xyz';

let _baseUrl = DEFAULT_BASE;

export const STREAMING_SOURCES = [
  { id: 'anipub', name: 'AniPub', baseUrl: 'https://anipub.xyz' },
  { id: 'animeunity', name: 'AnimeUnity', baseUrl: 'https://www.animeunity.to' },
  { id: 'animepahe', name: 'AnimePahe', baseUrl: 'https://animepahe.ru' },
];

export function setStreamingBaseUrl(url: string) {
  _baseUrl = url;
}

export function getStreamingBaseUrl(): string {
  return _baseUrl;
}

export function getSourceById(id: string): typeof STREAMING_SOURCES[number] | undefined {
  return STREAMING_SOURCES.find((s) => s.id === id);
}

export interface StreamSearchResult {
  id: number;
  title: string;
  slug: string;
  image: string;
}

export interface StreamEpisode {
  episodeNumber: number;
  embedUrl: string;
  type?: 'sub' | 'dub';
}

export interface StreamAnimeInfo {
  id: number;
  title: string;
  slug: string;
  episodes: StreamEpisode[];
}

async function fetchStream<T>(path: string, baseUrl?: string): Promise<T> {
  const base = baseUrl || _baseUrl;
  const url = `${base}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Streaming API error: ${res.status}`);
  return res.json();
}

function stripSrc(link: string): string {
  return link.replace(/^src=/, '');
}

function detectType(url: string): 'sub' | 'dub' {
  const lower = url.toLowerCase();
  if (lower.includes('type=dub') || lower.includes('/dub') || lower.endsWith('dub')) {
    return 'dub';
  }
  return 'sub';
}

export async function searchStreaming(query: string): Promise<StreamSearchResult[]> {
  const data = await fetchStream<any[]>(`/api/search/${encodeURIComponent(query)}`);
  const results = (data ?? []).map((r: any) => ({
    id: r.Id,
    title: r.Name,
    slug: r.finder,
    image: r.Image?.startsWith('http') ? r.Image : `${_baseUrl}/${r.Image}`,
  }));
  return results;
}

export function bestStreamingMatch(results: StreamSearchResult[], title: string): StreamSearchResult | undefined {
  if (results.length === 0) return undefined;
  if (results.length === 1) return results[0];

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normTitle = normalize(title);

  let best = results[0];
  let bestScore = Infinity;

  for (const r of results) {
    const normName = normalize(r.title);
    if (normName === normTitle) return r;
    const dist = Math.abs(normName.length - normTitle.length);
    if (dist < bestScore) {
      bestScore = dist;
      best = r;
    }
  }

  return best;
}

export async function getStreamAnimeInfo(animeIdOrSlug: string | number): Promise<StreamAnimeInfo> {
  const data = await fetchStream<any>(`/v1/api/details/${animeIdOrSlug}`);
  const local = data.local;
  const episodes: StreamEpisode[] = [];

  const allEpisodes: { link: string; type?: 'sub' | 'dub' }[] = [];

  if (local.link) {
    const link = stripSrc(local.link);
    allEpisodes.push({ link, type: detectType(link) });
  }

  if (local.ep && Array.isArray(local.ep)) {
    local.ep.forEach((e: any) => {
      const link = stripSrc(e.link);
      allEpisodes.push({ link, type: detectType(link) });
    });
  }

  if (local.dub && Array.isArray(local.dub)) {
    local.dub.forEach((e: any) => {
      const link = stripSrc(e.link);
      allEpisodes.push({ link, type: 'dub' });
    });
  }

  if (local.episodes && Array.isArray(local.episodes)) {
    local.episodes.forEach((e: any) => {
      const num = e.number || e.episodeNumber || e.numbering;
      const link = e.link || e.embed || e.url;
      if (num && link) {
        const cleanLink = stripSrc(link);
        allEpisodes.push({ link: cleanLink, type: detectType(cleanLink) });
      }
    });
  }

  let sorted: StreamEpisode[] = allEpisodes.map((e, i) => ({
    episodeNumber: i + 1,
    embedUrl: e.link,
    type: e.type as 'sub' | 'dub',
  }));

  return {
    id: local._id,
    title: local.name,
    slug: local.finder,
    episodes: sorted,
  };
}
