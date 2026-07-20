import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useColors } from '@/src/hooks/useColors';
import { useTranslation } from '@/src/hooks/useTranslation';
import { searchStreaming, getStreamAnimeInfo, bestStreamingMatch } from '@/src/api/streaming';
import { getAnimeById } from '@/src/api/jikan';
import { useAnimeStore } from '@/src/store/animeStore';
import { usePreferenceStore, AudioType } from '@/src/store/preferenceStore';

export default function WatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const malId = parseInt(id, 10);
  const colors = useColors();
  const t = useTranslation();
  const router = useRouter();

  const anime = useAnimeStore((s) => s.animes.find((a) => a.mal_id === malId));
  const updateEpisodes = useAnimeStore((s) => s.updateEpisodes);
  const addAnime = useAnimeStore((s) => s.addAnime);

  const audioFilter = usePreferenceStore((s) => s.audioType);
  const setAudioFilter = usePreferenceStore((s) => s.setAudioType);

  const animeQuery = useQuery({
    queryKey: ['anime', malId],
    queryFn: () => getAnimeById(malId),
  });

  const jikanAnime = animeQuery.data?.data;
  const searchTitle = (jikanAnime?.title_english || jikanAnime?.title || '').split(/[:/[\]()]+/)[0].trim();

  const searchQuery = useQuery({
    queryKey: ['stream-search', searchTitle],
    queryFn: () => searchStreaming(searchTitle),
    enabled: searchTitle.length > 0,
  });

  const bestMatch = searchQuery.data ? bestStreamingMatch(searchQuery.data, jikanAnime?.title_english || jikanAnime?.title || searchTitle) : undefined;
  const streamId = bestMatch?.id ?? bestMatch?.slug;

  const streamQuery = useQuery({
    queryKey: ['stream-info', streamId],
    queryFn: () => getStreamAnimeInfo(streamId!),
    enabled: streamId != null,
  });

  const allEpisodes = streamQuery.data?.episodes ?? [];

  const availableTypes = useMemo(() => {
    const types = new Set(allEpisodes.map((ep) => ep.type).filter(Boolean));
    const result: AudioType[] = [];
    if (types.has('sub')) result.push('sub');
    if (types.has('dub')) result.push('dub');
    return result;
  }, [allEpisodes]);

  const episodes = useMemo(() => {
    if (availableTypes.length <= 1) return allEpisodes;
    return allEpisodes.filter((ep) => ep.type === audioFilter);
  }, [allEpisodes, audioFilter, availableTypes]);

  const subCount = useMemo(() => allEpisodes.filter((ep) => ep.type === 'sub').length, [allEpisodes]);
  const dubCount = useMemo(() => allEpisodes.filter((ep) => ep.type === 'dub').length, [allEpisodes]);

  const episodesWatched = anime?.episodes_watched ?? 0;

  const handleEpisodePress = (episodeNumber: number, embedUrl: string, type?: 'sub' | 'dub') => {
    if (!anime) {
      addAnime({
        mal_id: malId,
        title: jikanAnime?.title_english || jikanAnime?.title || 'Unknown',
        image_url: jikanAnime?.images?.jpg?.image_url || '',
        status: 'watching',
        episodes_watched: 0,
        total_episodes: jikanAnime?.episodes,
        score: undefined,
        added_at: Date.now(),
      });
    }

    if (episodeNumber > episodesWatched) {
      updateEpisodes(malId, episodeNumber);
    }

    const sameType = episodes.filter((ep) => ep.type === type);
    const urls = sameType.map((ep) => ep.embedUrl);
    const typeParam = type ? `&type=${type}` : '';
    const urlsParam = `&urls=${encodeURIComponent(JSON.stringify(urls))}`;
    router.push(`/anime/${malId}/watch/${episodeNumber}?url=${encodeURIComponent(embedUrl)}${typeParam}${urlsParam}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: anime?.title || (jikanAnime ? (jikanAnime.title_english || jikanAnime.title) : 'Watch'),
          headerShown: true,
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
        }}
      />

      {availableTypes.length > 1 && (
        <View style={[styles.audioBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={[styles.audioSegment, { backgroundColor: colors.background + '80', borderColor: colors.border }]}>
            {availableTypes.map((type) => {
              const active = audioFilter === type;
              const label = type === 'sub' ? t.watch.sub : t.watch.dub;
              const count = type === 'sub' ? subCount : dubCount;
              return (
                <Pressable
                  key={type}
                  onPress={() => setAudioFilter(type)}
                  style={[
                    styles.audioSegmentBtn,
                    active && { backgroundColor: colors.tint },
                  ]}
                >
                  <Text style={[styles.audioSegmentText, { color: active ? '#fff' : colors.text }]}>
                    {label}
                  </Text>
                  <Text style={[styles.audioSegmentCount, { color: active ? '#ffffffaa' : colors.secondaryText }]}>
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {searchQuery.isLoading || streamQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.secondaryText }]}>
            {t.watch.loading}
          </Text>
        </View>
      ) : searchQuery.isError || streamQuery.isError ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.secondaryText }]}>
            {t.watch.failedToLoad}
          </Text>
          <Text style={[styles.errorSub, { color: colors.secondaryText }]}>
            {t.watch.tryDifferentSource}
          </Text>
        </View>
      ) : episodes.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.secondaryText }]}>
            {t.watch.noEpisodes}
          </Text>
        </View>
      ) : (
        <FlatList
          data={episodes}
          keyExtractor={(item) => `${item.episodeNumber}-${item.type}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const watched = item.episodeNumber <= episodesWatched;
            return (
              <Pressable
                style={[
                  styles.episodeCard,
                  { backgroundColor: colors.card, borderColor: watched ? colors.tint : colors.border },
                ]}
                onPress={() => handleEpisodePress(item.episodeNumber, item.embedUrl, item.type)}
              >
                <View style={[styles.episodeNum, watched && { backgroundColor: colors.tint + '30' }]}>
                  <Text style={[styles.episodeNumText, { color: watched ? colors.tint : colors.secondaryText }]}>
                    {watched ? '\u2713' : item.episodeNumber}
                  </Text>
                </View>
                <View style={styles.episodeInfo}>
                  <Text style={[styles.episodeTitle, { color: colors.text }]}>
                    {t.watch.episode} {item.episodeNumber}
                  </Text>
                  {item.type && (
                    <View style={[styles.typeBadge, {
                      backgroundColor: item.type === 'dub' ? '#8b5cf620' : '#3b82f620',
                      borderColor: item.type === 'dub' ? '#8b5cf660' : '#3b82f660',
                    }]}>
                      <Text style={[styles.typeBadgeText, { color: item.type === 'dub' ? '#8b5cf6' : '#3b82f6' }]}>
                        {item.type === 'sub' ? t.watch.sub : t.watch.dub}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.playIcon, { color: colors.tint }]}>{'\u25B6'}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  errorSub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  list: { padding: 12, gap: 8 },
  audioBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  audioSegment: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
  },
  audioSegmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  audioSegmentText: { fontSize: 13, fontWeight: '700' },
  audioSegmentCount: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  episodeNum: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.1)',
  },
  episodeNumText: { fontSize: 16, fontWeight: '700' },
  episodeInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  episodeTitle: { fontSize: 15, fontWeight: '600' },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  playIcon: { fontSize: 18 },
});
