import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useColors } from '@/src/hooks/useColors';
import { useTranslation } from '@/src/hooks/useTranslation';
import { useAnimeStore } from '@/src/store/animeStore';
import { UserAnime } from '../types';

interface Props {
  anime: UserAnime;
}

export function UserAnimeCard({ anime }: Props) {
  const colors = useColors();
  const t = useTranslation();
  const toggleFavorite = useAnimeStore((s) => s.toggleFavorite);

  return (
    <Link href={`/anime/${anime.mal_id}`} asChild>
      <Pressable>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Image
            source={{ uri: anime.image_url }}
            style={styles.poster}
            resizeMode="cover"
          />
          <View style={styles.info}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {anime.title}
            </Text>
            <Text style={[styles.episodes, { color: colors.secondaryText }]}>
              {t.lists.episodes}: {anime.episodes_watched}
              {anime.total_episodes ? ` / ${anime.total_episodes}` : ''}
            </Text>
            {anime.score ? (
              <Text style={[styles.score, { color: colors.secondaryText }]}>
                {t.lists.score}: {anime.score}/10
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(anime.mal_id);
            }}
            hitSlop={8}
            style={styles.favBtn}
          >
            <Text style={{ fontSize: 16 }}>
              {anime.favorite ? '\u{2B50}' : '\u{2606}'}
            </Text>
          </Pressable>
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
    width: 70,
    height: 105,
  },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  episodes: {
    fontSize: 13,
    marginTop: 4,
  },
  score: {
    fontSize: 13,
    marginTop: 2,
  },
  favBtn: {
    position: 'absolute',
    bottom: 4,
    right: 6,
  },
});
