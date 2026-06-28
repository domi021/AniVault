import type { Translations } from '@/src/i18n';
import { useLocalSearchParams, Stack } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/src/hooks/useColors';
import { useTranslation } from '@/src/hooks/useTranslation';
import { getAnimeById } from '@/src/api/jikan';
import { useAnimeStore } from '@/src/store/animeStore';
import { WatchStatus } from '@/src/types';
import { useState } from 'react';

const STATUS_OPTIONS: { key: WatchStatus; labelKey: keyof Translations['detail']; color: string }[] = [
  { key: 'watching', labelKey: 'watching', color: '#7c3aed' },
  { key: 'completed', labelKey: 'completed', color: '#22c55e' },
  { key: 'plan_to_watch', labelKey: 'plan', color: '#f59e0b' },
  { key: 'dropped', labelKey: 'dropped', color: '#ef4444' },
];

export default function AnimeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const malId = parseInt(id, 10);
  const colors = useColors();
  const t = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['anime', malId],
    queryFn: () => getAnimeById(malId),
  });

  const anime = data?.data;
  const animes = useAnimeStore((s) => s.animes);
  const addAnime = useAnimeStore((s) => s.addAnime);
  const updateStatus = useAnimeStore((s) => s.updateStatus);
  const updateEpisodes = useAnimeStore((s) => s.updateEpisodes);
  const updateScore = useAnimeStore((s) => s.updateScore);
  const removeAnime = useAnimeStore((s) => s.removeAnime);
  const toggleFavorite = useAnimeStore((s) => s.toggleFavorite);

  const userAnime = animes.find((a) => a.mal_id === malId);

  const [episodeInput, setEpisodeInput] = useState(
    userAnime ? String(userAnime.episodes_watched) : '0'
  );
  const [scoreInput, setScoreInput] = useState(
    userAnime?.score != null ? String(userAnime.score) : ''
  );

  const handleAddToList = (status: WatchStatus) => {
    if (userAnime) {
      updateStatus(malId, status);
    } else if (anime) {
      addAnime({
        mal_id: malId,
        title: anime.title_english || anime.title,
        image_url: anime.images.jpg.image_url,
        status,
        episodes_watched: 0,
        total_episodes: anime.episodes,
        score: undefined,
        added_at: Date.now(),
      });
    }
    setEpisodeInput('0');
  };

  const handleEpisodeChange = (text: string) => {
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 0) {
      setEpisodeInput(text);
      updateEpisodes(malId, num);
    }
  };

  const handleRemove = () => {
    removeAnime(malId);
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!anime) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>{t.detail.animeNotFound}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: anime.title_english || anime.title }} />

      <View style={styles.heroWrap}>
        <Image
          source={{ uri: anime.images.jpg.large_image_url }}
          style={styles.hero}
          resizeMode="cover"
        />
        {userAnime && (
          <Pressable
            onPress={() => toggleFavorite(malId)}
            style={styles.starBtn}
          >
            <Text style={{ fontSize: 28 }}>
              {userAnime.favorite ? '\u{2B50}' : '\u{2606}'}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>
          {anime.title_english || anime.title}
        </Text>
        {anime.title_english && anime.title !== anime.title_english && (
          <Text style={[styles.japaneseTitle, { color: colors.secondaryText }]}>
            {anime.title}
          </Text>
        )}

        <View style={styles.metaRow}>
          {anime.type && <Badge label={anime.type} colors={colors} />}
          {anime.episodes && (
            <Text style={[styles.metaText, { color: colors.secondaryText }]}>
              {anime.episodes} {t.detail.episodes}
            </Text>
          )}
          {anime.score && (
            <Text style={[styles.metaText, { color: colors.secondaryText }]}>
                {t.detail.score}: {anime.score}
            </Text>
          )}
          {anime.status && (
            <Badge label={anime.status} colors={colors} />
          )}
        </View>

        {anime.genres && anime.genres.length > 0 && (
          <View style={styles.genreRow}>
            {anime.genres.map((g) => (
              <Badge key={g.mal_id} label={g.name} colors={colors} variant="accent" />
            ))}
          </View>
        )}

        {anime.synopsis && (
          <Text style={[styles.synopsis, { color: colors.secondaryText }]}>
            {anime.synopsis}
          </Text>
        )}

        <View style={styles.divider} />

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.detail.myList}</Text>

        <View style={styles.statusButtons}>
          {STATUS_OPTIONS.map((opt) => {
            const active = userAnime?.status === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => handleAddToList(opt.key)}
                style={[
                  styles.statusBtn,
                  {
                    borderColor: active ? opt.color : colors.border,
                    backgroundColor: active ? opt.color + '20' : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBtnText,
                    { color: active ? opt.color : colors.text },
                  ]}
                >
                  {t.detail[opt.labelKey]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {userAnime && (
          <View style={styles.trackingSection}>
            <View style={styles.episodeRow}>
              <Text style={[styles.label, { color: colors.text }]}>{t.detail.episodesWatched}</Text>
              <TextInput
                style={[styles.episodeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                value={episodeInput}
                onChangeText={handleEpisodeChange}
                keyboardType="number-pad"
                returnKeyType="done"
              />
              {anime.episodes && (
                <Text style={[styles.label, { color: colors.secondaryText }]}>/ {anime.episodes}</Text>
              )}
            </View>

            <View style={styles.scoreRow}>
              <Text style={[styles.label, { color: colors.text }]}>{t.detail.rating}</Text>
              <View style={styles.scoreInputRow}>
                <TextInput
                  style={[styles.scoreInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                  value={scoreInput}
                  onChangeText={(text) => {
                    setScoreInput(text);
                    const num = parseFloat(text);
                    if (!isNaN(num) && num >= 0 && num <= 10) {
                      updateScore(malId, Math.round(num * 10) / 10);
                    }
                  }}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  placeholder="0.0"
                  placeholderTextColor={colors.secondaryText}
                />
                <Text style={[styles.label, { color: colors.secondaryText }]}>/ 10</Text>
              </View>
            </View>

            <Pressable onPress={handleRemove} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>{t.detail.remove}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Badge({
  label,
  colors,
  variant = 'default',
}: {
  label: string;
  colors: any;
  variant?: 'default' | 'accent';
}) {
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: variant === 'accent' ? colors.accent : colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.badgeText, { color: colors.secondaryText }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 40 },
  heroWrap: { position: 'relative' },
  hero: { width: '100%', height: 300 },
  starBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  japaneseTitle: { fontSize: 14, marginTop: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' },
  metaText: { fontSize: 13 },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 12 },
  synopsis: { fontSize: 14, lineHeight: 22, marginTop: 16 },
  divider: { height: 1, backgroundColor: '#e8e6f0', marginVertical: 20, opacity: 0.5 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  statusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  statusBtnText: { fontSize: 13, fontWeight: '600' },
  trackingSection: { marginTop: 20, gap: 16 },
  episodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 14, fontWeight: '500' },
  episodeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 16,
    fontWeight: '600',
    width: 70,
    textAlign: 'center',
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scoreInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 16,
    fontWeight: '600',
    width: 70,
    textAlign: 'center',
  },
  removeBtn: { paddingVertical: 12, alignItems: 'center' },
  removeBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
});
