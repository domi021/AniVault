import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/src/hooks/useColors';
import { useTranslation } from '@/src/hooks/useTranslation';
import { useAnimeStore } from '@/src/store/animeStore';
import { EmptyState } from '@/src/components/EmptyState';
import type { UserAnime, WatchStatus } from '@/src/types';

export default function HomeScreen() {
  const colors = useColors();
  const t = useTranslation();
  const animes = useAnimeStore((s) => s.animes);

  const watching = animes.filter((a) => a.status === 'watching');
  const completed = animes.filter((a) => a.status === 'completed');
  const plan = animes.filter((a) => a.status === 'plan_to_watch');
  const dropped = animes.filter((a) => a.status === 'dropped');

  if (animes.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="popcorn"
          title={t.home.noAnimes}
          subtitle={t.home.noAnimesSub}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.heading, { color: colors.text }]}>{t.home.dashboard}</Text>

      <View style={styles.stats}>
        <StatBox
          label={t.home.watching}
          count={watching.length}
          color={colors.tint}
          colors={colors}
          tab="watching"
        />
        <StatBox
          label={t.home.completed}
          count={completed.length}
          color="#22c55e"
          colors={colors}
          tab="completed"
        />
        <StatBox
          label={t.home.planned}
          count={plan.length}
          color="#f59e0b"
          colors={colors}
          tab="plan_to_watch"
        />
        <StatBox
          label={t.home.dropped}
          count={dropped.length}
          color="#ef4444"
          colors={colors}
          tab="dropped"
        />
      </View>

      {watching.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t.home.currentlyWatching} ({watching.length})
          </Text>
          <HorizontalAnimeList items={watching} />
        </View>
      )}

      {completed.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t.home.recentlyCompleted} ({completed.length})
          </Text>
          <HorizontalAnimeList items={completed.slice(0, 5)} />
        </View>
      )}
    </ScrollView>
  );
}

function HorizontalAnimeList({ items }: { items: UserAnime[] }) {
  const colors = useColors();
  const router = useRouter();

  return (
    <FlatList
      data={items}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => String(item.mal_id)}
      contentContainerStyle={{ gap: 10 }}
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/anime/${item.mal_id}`)}>
          <View style={[styles.hCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Image
              source={{ uri: item.image_url }}
              style={styles.hPoster}
              resizeMode="cover"
            />
            <Text style={[styles.hTitle, { color: colors.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.hMeta, { color: colors.secondaryText }]}>
              {item.episodes_watched}{item.total_episodes ? ` / ${item.total_episodes}` : ''} eps
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

function StatBox({
  label,
  count,
  color,
  colors,
  tab,
}: {
  label: string;
  count: number;
  color: string;
  colors: any;
  tab: WatchStatus;
}) {
  const router = useRouter();

  return (
    <Pressable
      style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/(tabs)/lists?tab=${tab}`)}
    >
      <Text style={[styles.statCount, { color }]}>{count}</Text>
      <Text style={[styles.statLabel, { color: colors.secondaryText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  heading: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  statCount: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  hCard: {
    width: 130,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  hPoster: {
    width: 128,
    height: 180,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  hTitle: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  hMeta: {
    fontSize: 11,
    paddingHorizontal: 6,
    paddingBottom: 8,
    paddingTop: 2,
  },
});
