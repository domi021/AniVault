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

const SEASON_STOP_WORDS = new Set(['the', 'season', 'part', 'movie', 'film', 'final']);

function seasonSubtitle(title: string): string {
  const parts = title.split(/\s+-\s+/);
  return parts.length > 1 ? parts[parts.length - 1].trim().toLowerCase() : '';
}

function subtitleWords(subtitle: string): string[] {
  return subtitle.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !SEASON_STOP_WORDS.has(w));
}

function seasonNumber(title: string): string | null {
  const lower = title.toLowerCase();
  const m = lower.match(/(?:season|part)\s*([0-9]+|[ivxlc]+)/);
  if (m) return m[1];
  const n = lower.match(/([0-9]+)(?:st|nd|rd|th)\s+season/);
  return n ? n[1] : null;
}

function hasSeasonNumber(resultTitle: string, num: string): boolean {
  const lower = resultTitle.toLowerCase();
  return (
    new RegExp(`(?:season|part)\\s*${num}`, 'i').test(lower) ||
    new RegExp(`${num}(?:st|nd|rd|th)\\s+season`, 'i').test(lower)
  );
}

const ROMAN_TO_ARABIC: Record<string, string> = {
  i: '1', ii: '2', iii: '3', iv: '4', v: '5',
  vi: '6', vii: '7', viii: '8', ix: '9', x: '10',
};

function partNumber(title: string): string | null {
  const m = title.toLowerCase().match(/\bpart\s*([0-9]+|[ivxlc]+)/);
  if (!m) return null;
  return /\d/.test(m[1]) ? m[1] : ROMAN_TO_ARABIC[m[1]] ?? null;
}

function hasPartNumber(resultTitle: string, num: string): boolean {
  const roman = Object.entries(ROMAN_TO_ARABIC).find(([, a]) => a === num);
  const tokens = [num, roman?.[0]].filter(Boolean);
  return tokens.some((t) => new RegExp(`\\bpart\\s*${t}\\b`, 'i').test(resultTitle));
}

function isValidSeasonMatch(resultTitle: string, titles: string[]): boolean {
  const normResult = normalizeTitle(resultTitle);
  let strictSeen = false;
  for (const t of titles) {
    const partNum = partNumber(t);
    if (partNum && !hasPartNumber(resultTitle, partNum)) return false;
    const sub = seasonSubtitle(t);
    if (!sub) continue;
    const words = subtitleWords(sub);
    if (words.length === 0) continue;
    strictSeen = true;
    if (words.every((w) => normResult.includes(w))) return true;
  }
  return !strictSeen;
}

function formatBonus(name: string, format: string | undefined): number {
  const lower = name.toLowerCase();
  const isMovieEntry = /\bmovie\b|\bfilm\b/.test(lower);
  if (format === 'MOVIE') {
    return isMovieEntry ? 200 : -100;
  }
  if (format === 'TV' || format === 'ONA') {
    return isMovieEntry ? -200 : 0;
  }
  return 0;
}

function derivativePenalty(name: string, format: string | undefined): number {
  const lower = name.toLowerCase();
  let penalty = 0;
  if (/\bpart\s*[2-9]|\bseason\s*[2-9]/.test(lower)) penalty += 100;
  if (/\b(ii|iii|iv|v|vi|vii|viii|ix|x)\b/.test(lower) || /\br[2-9]\b/.test(lower)) penalty += 100;
  if (format === 'MOVIE') {
    if (/\bspecials?\b|\bona\b|\bova\b|\boad\b|\brecap\b/.test(lower)) penalty += 150;
  }
  return penalty;
}

function parseSearchResults(data: any, base: string): StreamSearchResult[] {
  if (!data || data.found === false) return [];
  const items = Array.isArray(data) ? data : [data];
  return items.map((r: any) => {
    const id = r.Id ?? r._id;
    const image = r.Image ?? r.ImagePath;
    return {
      id,
      title: r.Name,
      slug: r.finder,
      image: image?.startsWith('http') ? image : image ? `${base}/${image}` : '',
    };
  });
}

function queryVariations(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const words = trimmed.split(/\s+/);
  if (words.length <= 1) return [trimmed];

  const variations: string[] = [trimmed];

  const clean = trimmed.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (clean && clean !== trimmed) variations.push(clean);

  for (const n of [3, 2, 1]) {
    if (n >= words.length) continue;
    const v = words.slice(0, n).join(' ').replace(/[^\p{L}\p{N}]$/gu, '');
    if (v && !variations.includes(v)) variations.push(v);
  }

  for (let i = words.length - 1; i >= 1; i--) {
    const v = words.slice(0, i).join(' ');
    if (!variations.includes(v)) variations.push(v);
  }

  return variations;
}

const MAX_SEARCH_VARIATIONS = 5;
const MAX_SEARCH_RESULTS = 6;

export async function searchStreaming(query: string, baseUrl?: string): Promise<StreamSearchResult[]> {
  const base = baseUrl || _baseUrl;
  const variations = queryVariations(query);

  const results: StreamSearchResult[] = [];
  const seen = new Set<number>();
  let searched = 0;

  for (const q of variations) {
    if (searched >= MAX_SEARCH_VARIATIONS || results.length >= MAX_SEARCH_RESULTS) break;
    searched++;
    try {
      const data = await fetchStream<any>(`/api/search/${encodeURIComponent(q)}`, base);
      const parsed = parseSearchResults(data, base);
      for (const r of parsed) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          results.push(r);
        }
      }
    } catch { /* continue to next variation */ }
  }

  if (results.length === 0) {
    try {
      const data = await fetchStream<any>(`/api/searchall/${encodeURIComponent(query)}`, base);      const parsed = parseSearchResults(data?.AniData, base);
      for (const r of parsed) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          results.push(r);
        }
      }
    } catch { /* ignore */ }
  }

  return results;
}

const MIN_MATCH_SCORE = 200;
const SEASON_MATCH_BONUS = 400;

export function bestStreamingMatch(results: StreamSearchResult[], title: string | string[], format?: string): StreamSearchResult | undefined {
  if (results.length === 0) return undefined;

  const titles = Array.isArray(title) ? title : [title];
  const isMovie = format === 'MOVIE';

  if (results.length === 1) {
    return isValidSeasonMatch(results[0].title, titles) ? results[0] : undefined;
  }

  function scoreEntry(r: StreamSearchResult): number {
    const normName = normalizeTitle(r.title);
    let best = -Infinity;

    for (const t of titles) {
      const normTitle = normalizeTitle(t);
      if (normName === normTitle) return Infinity;

      const fBonus = formatBonus(r.title, format);
      const dPenalty = derivativePenalty(r.title, format);

      let score: number;

      if ((normName.startsWith(normTitle) || normTitle.startsWith(normName)) &&
          (!isMovie || /\bmovie\b|\bfilm\b/i.test(r.title))) {
        score = 1000 - Math.abs(normName.length - normTitle.length) + fBonus - dPenalty;
      } else {
        const titleWords = t.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
        const nameWords = r.title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
        const fTitleWords = titleWords.filter((w) => w.length >= 4);
        const matched = fTitleWords.filter((w) => nameWords.some((nw) => nw.includes(w) || w.includes(nw)));
        if (matched.length < 2) {
          score = -1000;
        } else {
          const recall = matched.length / Math.max(fTitleWords.length, 1);
          const precision = matched.length / Math.max(nameWords.length, 1);
          score = (recall + precision) / 2 * 500 + fBonus - dPenalty;
        }
      }

      const seasonNum = seasonNumber(t);
      if (seasonNum) {
        score += hasSeasonNumber(r.title, seasonNum) ? SEASON_MATCH_BONUS : -SEASON_MATCH_BONUS;
      }

      const partNum = partNumber(t);
      if (partNum) {
        score += hasPartNumber(r.title, partNum) ? SEASON_MATCH_BONUS : -SEASON_MATCH_BONUS;
      }

      if (score > best) best = score;
    }

    return best;
  }

  let best: StreamSearchResult | undefined;
  let bestScore = -Infinity;

  for (const r of results) {
    if (!isValidSeasonMatch(r.title, titles)) continue;
    const score = scoreEntry(r);
    if (score === Infinity) return r;
    if (score < MIN_MATCH_SCORE) continue;
    const rLen = normalizeTitle(r.title).length;
    const bLen = best ? normalizeTitle(best.title).length : Infinity;
    if (score > bestScore || (score === bestScore && rLen < bLen)) {
      bestScore = score;
      best = r;
    }
  }

  return bestScore > 0 ? best : undefined;
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
