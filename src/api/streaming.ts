const DEFAULT_BASE = 'https://anipub.xyz';

let _baseUrl = DEFAULT_BASE;

export const STREAMING_SOURCES = [
  { id: 'anipub', name: 'AniPub', baseUrl: 'https://anipub.xyz' },
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

async function fetchStream<T>(path: string, baseUrl?: string, init?: RequestInit): Promise<T> {
  const base = baseUrl || _baseUrl;
  const url = `${base}${path}`;
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Streaming API error: ${res.status}`);
  return res.json();
}

function stripSrc(link: string): string {
  return link.replace(/^src=/, '');
}

function detectType(url: string, explicitType?: string): 'sub' | 'dub' {
  if (explicitType === 'dub') return 'dub';
  if (explicitType === 'sub') return 'sub';
  const lower = url.toLowerCase();
  if (
    lower.includes('type=dub') ||
    lower.includes('/dub') ||
    lower.includes('.dub.') ||
    lower.includes('-dub-') ||
    lower.endsWith('dub')
  ) {
    return 'dub';
  }
  return 'sub';
}

function swapAudioType(url: string): string {
  if (url.includes('/sub')) return url.replace('/sub', '/dub');
  if (url.includes('/dub')) return url.replace('/dub', '/sub');
  if (url.includes('type=sub')) return url.replace('type=sub', 'type=dub');
  if (url.includes('type=dub')) return url.replace('type=dub', 'type=sub');
  return url;
}

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function derivativePenalty(name: string): number {
  const lower = name.toLowerCase();
  let penalty = 0;
  if (/\bmovie\b|\bfilm\b/.test(lower)) penalty += 200;
  if (/\bspecials?\b|\bona\b|\bova\b|\boad\b|\brecap\b/.test(lower)) penalty += 150;
  if (/\barc\b/.test(lower)) penalty += 100;
  if (/\bpart\s*[2-9]|\bseason\s*[2-9]/.test(lower)) penalty += 100;
  if (/\b(ii|iii|iv|v|vi|vii|viii|ix|x)\b/.test(lower) || /\br[2-9]\b/.test(lower)) penalty += 100;
  return penalty;
}

function parseSearchResults(data: any, base: string): StreamSearchResult[] {
  if (!data || data.found === false) return [];
  const items = Array.isArray(data) ? data : [data];
  return items.map((r: any) => ({
    id: r.Id,
    title: r.Name,
    slug: r.finder,
    image: r.Image?.startsWith('http') ? r.Image : `${base}/${r.Image}`,
  }));
}

function queryVariations(query: string): string[] {
  const words = query.trim().split(/\s+/);
  if (words.length <= 1) return words.length === 0 ? [] : [words[0]];
  const variations: string[] = [query];
  for (let i = words.length - 1; i >= 1; i--) {
    variations.push(words.slice(0, i).join(' '));
  }
  return variations;
}

export async function searchStreaming(query: string, baseUrl?: string): Promise<StreamSearchResult[]> {
  const base = baseUrl || _baseUrl;
  const variations = queryVariations(query);

  for (const q of variations) {
    try {
      const data = await fetchStream<any>(`/api/search/${encodeURIComponent(q)}`, base);
      const results = parseSearchResults(data, base);
      if (results.length > 0) return results;
    } catch { /* continue to next variation */ }
  }

  try {
    const data = await fetchStream<any>(`/api/searchall/${encodeURIComponent(query)}`, base);
    const results = parseSearchResults(data?.AniData, base);
    if (results.length > 0) return results;
  } catch { /* ignore */ }

  return [];
}

export function bestStreamingMatch(results: StreamSearchResult[], title: string): StreamSearchResult | undefined {
  if (results.length === 0) return undefined;
  if (results.length === 1) return results[0];

  const normTitle = normalizeTitle(title);
  const titleWords = normTitle.split(/(?=[a-z0-9])/).filter(Boolean);

  let best = results[0];
  let bestScore = -Infinity;

  for (const r of results) {
    const normName = normalizeTitle(r.title);
    if (normName === normTitle) return r;

    const penalty = derivativePenalty(r.title);

    if (normName.startsWith(normTitle) || normTitle.startsWith(normName)) {
      const score = 1000 - Math.abs(normName.length - normTitle.length) + penalty;
      if (score > bestScore) { bestScore = score; best = r; }
      continue;
    }

    const nameWords = normName.split(/(?=[a-z0-9])/).filter(Boolean);
    const matched = titleWords.filter((w) => nameWords.some((nw) => nw.includes(w) || w.includes(nw)));
    const score = (matched.length / Math.max(titleWords.length, 1)) * 500 + penalty;
    if (score > bestScore) { bestScore = score; best = r; }
  }

  return best;
}

export async function getStreamAnimeInfo(animeIdOrSlug: string | number, baseUrl?: string): Promise<StreamAnimeInfo> {
  const base = baseUrl || _baseUrl;
  const data = await fetchStream<any>(`/v1/api/details/${animeIdOrSlug}`, base);
  const local = data.local;

  const subLinks: string[] = [];
  const dubLinks: string[] = [];
  const seen = new Set<string>();

  function collectLink(link: string, type?: 'sub' | 'dub') {
    const clean = stripSrc(link);
    const epType = type || detectType(clean);
    if (seen.has(clean)) return;
    seen.add(clean);
    if (epType === 'dub') dubLinks.push(clean);
    else subLinks.push(clean);
  }

  if (local.link) {
    collectLink(local.link);
  }

  if (local.ep && Array.isArray(local.ep)) {
    local.ep.forEach((e: any) => {
      if (e.link) collectLink(e.link, e.type);
    });
  }

  const subSet = new Set(subLinks);
  const dubSet = new Set(dubLinks);

  if (subLinks.length > 0 && dubLinks.length === 0) {
    for (const s of subLinks) {
      const alt = swapAudioType(s);
      if (!dubSet.has(alt) && !seen.has(alt)) {
        dubLinks.push(alt);
        seen.add(alt);
      }
    }
  } else if (dubLinks.length > 0 && subLinks.length === 0) {
    for (const d of dubLinks) {
      const alt = swapAudioType(d);
      if (!subSet.has(alt) && !seen.has(alt)) {
        subLinks.push(alt);
        seen.add(alt);
      }
    }
  }

  subLinks.sort();
  dubLinks.sort();

  const result: StreamEpisode[] = [];
  subLinks.forEach((link, i) => {
    result.push({ episodeNumber: i + 1, embedUrl: link, type: 'sub' });
  });
  dubLinks.forEach((link, i) => {
    result.push({ episodeNumber: i + 1, embedUrl: link, type: 'dub' });
  });

  return {
    id: local._id,
    title: local.name,
    slug: local.finder,
    episodes: result,
  };
}
