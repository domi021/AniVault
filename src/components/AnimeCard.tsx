import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/src/hooks/useColors';
import { Anime } from '../types';

interface Props {
  anime: Anime;
}

export function AnimeCard({ anime }: Props) {
  const colors = useColors();

  return (
    <Link href={`/anime/${anime.mal_id}`} asChild>
      <Pressable>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Image
            source={{ uri: anime.images.jpg.image_url }}
            style={styles.poster}
            resizeMode="cover"
          />
          <View style={styles.info}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {anime.title_english || anime.title}
            </Text>
            <View style={styles.meta}>
              {anime.type && (
                <Text style={[styles.badge, { backgroundColor: colors.accent, color: colors.tint }]}>
                  {anime.type}
                </Text>
              )}
              {anime.score && (
                <Text style={[styles.score, { color: colors.secondaryText }]}>
                  {anime.score}
                </Text>
              )}
              {anime.episodes && (
                <Text style={[styles.episodes, { color: colors.secondaryText }]}>
                  {anime.episodes} eps
                </Text>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  poster: {
    width: 80,
    height: 120,
  },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  score: {
    fontSize: 13,
  },
  episodes: {
    fontSize: 13,
  },
});
