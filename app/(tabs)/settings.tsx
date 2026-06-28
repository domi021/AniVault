import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/src/hooks/useColors';
import { useThemeStore, ThemeMode } from '@/src/store/themeStore';
import { useLanguageStore, Language } from '@/src/store/languageStore';
import { useTranslation } from '@/src/hooks/useTranslation';
import { useAuthStore } from '@/src/store/authStore';
import { supabase } from '@/src/lib/supabase';
import { getAniList, mapAniListStatus, parseAnimeText, searchAnimeByTitle } from '@/src/api/jikan';
import { useAnimeStore, SortOrder } from '@/src/store/animeStore';

const MODES: { key: ThemeMode; labelKey: keyof Translations['settings'] }[] = [
  { key: 'light', labelKey: 'light' },
  { key: 'dark', labelKey: 'dark' },
];

const PRESET_COLORS = [
  '#10b981',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
];

const LANGUAGES: { key: Language; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'es', label: 'Español' },
  { key: 'ja', label: '日本語' },
];

import type { Translations } from '@/src/i18n';

export default function SettingsScreen() {
  const colors = useColors();
  const t = useTranslation();
  const router = useRouter();
  const { mode, primaryColor, setMode, setPrimaryColor } = useThemeStore();
  const { language, setLanguage } = useLanguageStore();
  const { session, signOut } = useAuthStore();
  const importAnimes = useAnimeStore((s) => s.importFromMAL);
  const sortOrder = useAnimeStore((s) => s.sortOrder);
  const setSortOrder = useAnimeStore((s) => s.setSortOrder);
  const [username, setUsername] = useState('');
  const [importing, setImporting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasting, setPasting] = useState(false);
  const [pasteProgress, setPasteProgress] = useState({ done: 0, total: 0 });
  const [deleting, setDeleting] = useState(false);

  const handleImport = async () => {
    const name = username.trim();
    if (!name) return;
    setImporting(true);
    try {
      const entries = await getAniList(name);
      const mapped = entries.map((e) => ({
        mal_id: e.media.idMal,
        anime: {
          mal_id: e.media.idMal,
          title: e.media.title.english || e.media.title.romaji,
          images: { jpg: { image_url: e.media.coverImage.large } },
          episodes: e.media.episodes,
        },
        status: mapAniListStatus(e.status),
        score: e.score,
        episodes_watched: e.progress,
      }));
      importAnimes(mapped);
      Alert.alert(t.settings.importSuccess.replace('{count}', String(mapped.length)));
      setUsername('');
    } catch {
      Alert.alert(t.settings.importError);
    } finally {
      setImporting(false);
    }
  };

  const handlePasteImport = async () => {
    const lines = pasteText.trim();
    if (!lines) return;
    setPasting(true);
    const parsed = parseAnimeText(lines);
    setPasteProgress({ done: 0, total: parsed.length });
    const imported: any[] = [];
    for (let i = 0; i < parsed.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 350));
      setPasteProgress({ done: i, total: parsed.length });
      const anime = await searchAnimeByTitle(parsed[i].name);
      if (anime) {
        imported.push({
          mal_id: anime.mal_id,
          anime: {
            mal_id: anime.mal_id,
            title: anime.title_english || anime.title,
            images: { jpg: { image_url: anime.images.jpg.image_url } },
            episodes: anime.episodes,
          },
          status: 'completed',
          score: parsed[i].score ?? undefined,
          episodes_watched: anime.episodes ?? 0,
        });
      }
    }
    setPasteProgress({ done: parsed.length, total: parsed.length });
    if (imported.length > 0) {
      importAnimes(imported);
      Alert.alert(t.settings.pasteImportSuccess.replace('{count}', String(imported.length)));
    }
    setPasteText('');
    setPasting(false);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      <View
        style={[
          styles.accountCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.accountLeft}>
          <Text style={[styles.accountLogo, { color: colors.tint }]}>{'\u039B'}</Text>
          <View>
            <Text style={[styles.accountLabel, { color: colors.secondaryText }]}>
              {t.auth.account}
            </Text>
            <Text style={[styles.accountValue, { color: colors.text }]} numberOfLines={1}>
              {session ? (session.user.user_metadata?.username || session.user.email) : t.auth.guest}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => {
            supabase.auth.signOut();
            signOut();
            router.replace('/login');
          }}
          style={[styles.accountLogoutBtn, { borderColor: colors.border }]}
        >
          <Text style={[styles.accountLogoutText, { color: '#ef4444' }]}>{t.auth.logout}</Text>
        </Pressable>
      </View>

      {session && (
        <Pressable
          onPress={() => useAnimeStore.getState().syncToServer()}
          style={[styles.syncBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.syncBtnText, { color: colors.tint }]}>Sync data to server</Text>
        </Pressable>
      )}

      <Text style={[styles.heading, { color: colors.text, marginTop: 32 }]}>{t.settings.theme}</Text>

      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => setMode(m.key)}
            style={[
              styles.modeBtn,
              {
                backgroundColor: mode === m.key ? colors.tint : colors.card,
                borderColor: mode === m.key ? colors.tint : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.modeLabel,
                { color: mode === m.key ? '#fff' : colors.text },
              ]}
            >
              {t.settings[m.labelKey]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.heading, { color: colors.text, marginTop: 32 }]}>
        {t.settings.accentColor}
      </Text>

      <View style={styles.presets}>
        {PRESET_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setPrimaryColor(c)}
            style={[
              styles.colorSwatch,
              { backgroundColor: c },
              primaryColor === c && {
                borderWidth: 3,
                borderColor: colors.text,
              },
            ]}
          />
        ))}
      </View>

      <Text style={[styles.heading, { color: colors.text, marginTop: 32 }]}>
        {t.settings.language}
      </Text>

      <View style={styles.modeRow}>
        {LANGUAGES.map((l) => (
          <Pressable
            key={l.key}
            onPress={() => setLanguage(l.key)}
            style={[
              styles.modeBtn,
              {
                backgroundColor: language === l.key ? colors.tint : colors.card,
                borderColor: language === l.key ? colors.tint : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.modeLabel,
                { color: language === l.key ? '#fff' : colors.text },
              ]}
            >
              {l.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.heading, { color: colors.text, marginTop: 32 }]}>
        {t.settings.sortOrder}
      </Text>

      <View style={styles.modeRow}>
        {(['desc', 'asc'] as SortOrder[]).map((order) => (
          <Pressable
            key={order}
            onPress={() => setSortOrder(order)}
            style={[
              styles.modeBtn,
              {
                backgroundColor: sortOrder === order ? colors.tint : colors.card,
                borderColor: sortOrder === order ? colors.tint : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.modeLabel,
                { color: sortOrder === order ? '#fff' : colors.text },
              ]}
            >
              {order === 'desc' ? t.settings.sortDesc : t.settings.sortAsc}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.heading, { color: colors.text, marginTop: 32 }]}>
        {t.settings.import}
      </Text>

      <View style={styles.importRow}>
        <TextInput
          style={[
            styles.importInput,
            {
              color: colors.text,
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          value={username}
          onChangeText={setUsername}
          placeholder={t.settings.importPlaceholder}
          placeholderTextColor={colors.secondaryText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          onPress={handleImport}
          disabled={importing || username.trim().length === 0}
          style={[
            styles.importBtn,
            {
              backgroundColor: importing || username.trim().length === 0
                ? colors.border
                : colors.tint,
            },
          ]}
        >
          {importing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.importBtnText}>
              {t.settings.importBtn}
            </Text>
          )}
        </Pressable>
      </View>

      <Text style={[styles.heading, { color: colors.text, marginTop: 32 }]}>
        {t.settings.pasteImport}
      </Text>

      <TextInput
        style={[
          styles.pasteInput,
          {
            color: colors.text,
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
        value={pasteText}
        onChangeText={setPasteText}
        placeholder={t.settings.pasteImportPlaceholder}
        placeholderTextColor={colors.secondaryText}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {pasting && (
        <Text style={[styles.pasteProgress, { color: colors.secondaryText }]}>
          {t.settings.pasteImportProgress
            .replace('{done}', String(pasteProgress.done))
            .replace('{total}', String(pasteProgress.total))}
        </Text>
      )}

      <Pressable
        onPress={handlePasteImport}
        disabled={pasting || pasteText.trim().length === 0}
        style={[
          styles.pasteBtn,
          {
            backgroundColor: pasting || pasteText.trim().length === 0
              ? colors.border
              : colors.tint,
          },
        ]}
      >
        {pasting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.importBtnText}>
            {t.settings.pasteImportBtn}
          </Text>
        )}
      </Pressable>

      {session && (
        <>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 32 }} />
          <Pressable
            onPress={() => {
              Alert.alert(
                'Delete Account',
                'This will permanently delete your account and all data. Are you sure?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      setDeleting(true);
                      try {
                        const { error } = await supabase.rpc('delete_user');
                        if (error) throw error;
                        supabase.auth.signOut();
                        signOut();
                        router.replace('/login');
                      } catch (e: any) {
                        Alert.alert('Error', e.message || 'Failed to delete account');
                      } finally {
                        setDeleting(false);
                      }
                    },
                  },
                ],
              );
            }}
            disabled={deleting}
            style={{ alignItems: 'center', paddingVertical: 12 }}
          >
            <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '500' }}>
              {deleting ? 'Deleting...' : 'Delete Account'}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },

  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  accountLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  accountLogo: { fontSize: 28, fontWeight: '900', transform: [{ scaleX: 1.6 }] },
  accountLabel: { fontSize: 12, fontWeight: '500' },
  accountValue: { fontSize: 15, fontWeight: '600', marginTop: 1 },
  accountLogoutBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  accountLogoutText: { fontSize: 14, fontWeight: '600' },
  syncBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 16,
  },
  syncBtnText: { fontSize: 15, fontWeight: '600' },
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  modeLabel: { fontSize: 14, fontWeight: '600' },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  label: { fontSize: 14, fontWeight: '500' },
  importRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  importInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  importBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  importBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  pasteInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 130,
  },
  pasteProgress: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  pasteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
});
