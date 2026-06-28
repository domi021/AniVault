import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/src/hooks/useColors';
import { useTranslation } from '@/src/hooks/useTranslation';
import { useAnimeStore } from '@/src/store/animeStore';
import { getAnimeRecommendations } from '@/src/api/jikan';
import type { Anime } from '@/src/types';
import { AnimeCard } from '@/src/components/AnimeCard';
import { EmptyState } from '@/src/components/EmptyState';

export default function RecommendationsScreen() {
  const colors = useColors();
  const t = useTranslation();
  const animes = useAnimeStore((s) => s.animes);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const trackedIds = animes.map((a) => a.mal_id);

  const [seedId, setSeedId] = useState<number | null>(null);

  useEffect(() => {
    if (trackedIds.length > 0 && seedId === null) {
      const randomIndex = Math.floor(Math.random() * trackedIds.length);
      setSeedId(trackedIds[randomIndex]);
    }
  }, [trackedIds, seedId]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['recommendations', seedId],
    queryFn: () => (seedId ? getAnimeRecommendations(seedId) : Promise.resolve(null)),
    enabled: seedId != null,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const randomIndex = Math.floor(Math.random() * trackedIds.length);
    const newSeed = trackedIds[randomIndex];
    setSeedId(newSeed);
    await queryClient.invalidateQueries({ queryKey: ['recommendations', newSeed] });
    setRefreshing(false);
  }, [trackedIds, queryClient]);

  const shuffled = data?.data
    ? [...data.data]
        .sort(() => Math.random() - 0.5)
        .slice(0, 20)
        .map((r) => r.entry)
        .filter((entry) => !trackedIds.includes(entry.mal_id))
    : [];

  if (animes.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="popcorn"
          title={t.recommend.noAnimes}
          subtitle={t.recommend.noAnimesSub}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t.recommend.title}</Text>
        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
          {t.recommend.subtitle}
        </Text>
      </View>

      {isLoading && (
        <ActivityIndicator size="large" color={colors.tint} style={{ marginTop: 40 }} />
      )}

      {isError && (
        <EmptyState icon="exclamationmark" title={t.search.error} subtitle={t.recommend.noRecsSub} />
      )}

      {!isLoading && !isError && shuffled.length === 0 && (
        <EmptyState
          icon="tray"
          title={t.recommend.noRecs}
          subtitle={t.recommend.noRecsSub}
        />
      )}

      {shuffled.length > 0 && (
        <FlatList
          data={shuffled}
          keyExtractor={(item) => String(item.mal_id)}
          renderItem={({ item }) => <AnimeCard anime={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingBottom: 0 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4, marginBottom: 8 },
  list: { padding: 16, paddingBottom: 32 },
});
