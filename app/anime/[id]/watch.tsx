import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useLayoutEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/src/hooks/useColors';
import { useTranslation } from '@/src/hooks/useTranslation';
import { searchStreaming, getStreamAnimeInfo, STREAMING_SOURCES, bestStreamingMatch } from '@/src/api/streaming';
import { getAnimeById } from '@/src/api/jikan';
import { useAnimeStore } from '@/src/store/animeStore';
import { usePreferenceStore, AudioType } from '@/src/store/preferenceStore';

export default function WatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const malId = parseInt(id, 10);
  const colors = useColors();
  const t = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();

  const anime = useAnimeStore((s) => s.animes.find((a) => a.mal_id === malId));
  const updateEpisodes = useAnimeStore((s) => s.updateEpisodes);
  const addAnime = useAnimeStore((s) => s.addAnime);

  const audioFilter = usePreferenceStore((s) => s.audioType);
  const setAudioFilter = usePreferenceStore((s) => s.setAudioType);
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);

  const currentSource = STREAMING_SOURCES[selectedSourceIndex];

  const animeQuery = useQuery({
    queryKey: ['anime', malId],
    queryFn: () => getAnimeById(malId),
  });

  const jikanAnime = animeQuery.data?.data;
  const searchTitle = (jikanAnime?.title_english || jikanAnime?.title || '').split(/[:/[\]()]+/)[0].trim();

  const searchQuery = useQuery({
    queryKey: ['stream-search', searchTitle, currentSource.id],
    queryFn: () => searchStreaming(searchTitle),
    enabled: searchTitle.length > 0,
  });

  const bestMatch = searchQuery.data ? bestStreamingMatch(searchQuery.data, jikanAnime?.title_english || jikanAnime?.title || searchTitle) : undefined;
  const streamId = bestMatch?.id ?? bestMatch?.slug;

  const streamQuery = useQuery({
    queryKey: ['stream-info', streamId, currentSource.id],
    queryFn: () => getStreamAnimeInfo(streamId!),
    enabled: streamId != null,
  });

  const allEpisodes = streamQuery.data?.episodes ?? [];

  const availableTypes = useMemo(() => {
    const types = new Set(allEpisodes.map((ep) => ep.type).filter(Boolean));
    const result: AudioType[] = ['all'];
    if (types.has('sub')) result.push('sub');
    if (types.has('dub')) result.push('dub');
    return result;
  }, [allEpisodes]);

  const episodes = useMemo(() => {
    if (audioFilter === 'all') return allEpisodes;
    return allEpisodes.filter((ep) => ep.type === audioFilter);
  }, [allEpisodes, audioFilter]);

  const hasDub = allEpisodes.some((ep) => ep.type === 'dub');
  const episodesWatched = anime?.episodes_watched ?? 0;

  const cycleAudio = useCallback(() => {
    const idx = availableTypes.indexOf(audioFilter);
    setAudioFilter(availableTypes[(idx + 1) % availableTypes.length]);
  }, [audioFilter, setAudioFilter, availableTypes]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: availableTypes.length > 1
        ? () => (
            <Pressable
              onPress={cycleAudio}
              style={[styles.headerToggle, { backgroundColor: colors.tint + '20', borderColor: colors.tint }]}
            >
              <Text style={[styles.headerToggleText, { color: colors.tint }]}>
                {audioFilter.toUpperCase()}
              </Text>
            </Pressable>
          )
        : undefined,
    });
  }, [audioFilter, colors.tint, cycleAudio, navigation, availableTypes]);

  const handleEpisodePress = (episodeNumber: number, embedUrl: string) => {
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

    const sourceParam = currentSource.id !== 'anipub' ? `&source=${currentSource.id}` : '';
    router.push(`/anime/${malId}/watch/${episodeNumber}?url=${encodeURIComponent(embedUrl)}${sourceParam}`);
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

      <View style={[styles.sourceBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {STREAMING_SOURCES.map((source, index) => {
          const active = index === selectedSourceIndex;
          return (
            <Pressable
              key={source.id}
              onPress={() => setSelectedSourceIndex(index)}
              style={[
                styles.sourceBtn,
                { backgroundColor: active ? colors.tint : 'transparent', borderColor: active ? colors.tint : colors.border },
              ]}
            >
              <Text style={[styles.sourceBtnText, { color: active ? '#fff' : colors.text }]}>
                {source.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {searchQuery.isLoading || streamQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.secondaryText }]}>
            Loading episodes...
          </Text>
        </View>
      ) : searchQuery.isError || streamQuery.isError ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.secondaryText }]}>
            Failed to load episodes
          </Text>
          <Text style={[styles.errorSub, { color: colors.secondaryText }]}>
            The streaming source may be unavailable. Try a different source above.
          </Text>
        </View>
      ) : episodes.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.secondaryText }]}>
            No episodes found
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
                onPress={() => handleEpisodePress(item.episodeNumber, item.embedUrl)}
              >
                <View style={[styles.episodeNum, watched && { backgroundColor: colors.tint + '30' }]}>
                  <Text style={[styles.episodeNumText, { color: watched ? colors.tint : colors.secondaryText }]}>
                    {watched ? '✓' : item.episodeNumber}
                  </Text>
                </View>
                <View style={styles.episodeInfo}>
                  <Text style={[styles.episodeTitle, { color: colors.text }]}>
                    Episode {item.episodeNumber}
                  </Text>
                  {item.type && (
                    <Text style={[styles.episodeType, { color: colors.secondaryText }]}>
                      {item.type.toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={[styles.playIcon, { color: colors.tint }]}>▶</Text>
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
  sourceBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  sourceBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  sourceBtnText: { fontSize: 12, fontWeight: '600' },
  headerToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  headerToggleText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
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
  episodeType: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, opacity: 0.6 },
  playIcon: { fontSize: 18 },
});
