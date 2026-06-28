import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useColors } from '@/src/hooks/useColors';
import { useTranslation } from '@/src/hooks/useTranslation';
import { useAnimeStore } from '@/src/store/animeStore';
import { UserAnimeCard } from '@/src/components/UserAnimeCard';
import { EmptyState } from '@/src/components/EmptyState';
import { WatchStatus } from '@/src/types';
import type { Translations } from '@/src/i18n';

const TABS: { key: WatchStatus; labelKey: keyof Translations['lists'] }[] = [
  { key: 'watching', labelKey: 'watching' },
  { key: 'completed', labelKey: 'completed' },
  { key: 'plan_to_watch', labelKey: 'plan' },
  { key: 'dropped', labelKey: 'dropped' },
];

export default function ListsScreen() {
  const colors = useColors();
  const t = useTranslation();
  const { tab } = useLocalSearchParams<{ tab?: WatchStatus }>();
  const [activeTab, setActiveTab] = useState<WatchStatus>('watching');
  const [search, setSearch] = useState('');
  const animes = useAnimeStore((s) => s.animes);
  const getList = useAnimeStore((s) => s.getList);
  const list = useMemo(() => getList(activeTab), [animes, activeTab, getList]);

  useEffect(() => {
    if (tab && TABS.some((t) => t.key === tab)) {
      setActiveTab(tab);
      setSearch('');
    }
  }, [tab]);

  const filtered = useMemo(
    () =>
      search.trim()
        ? list.filter((a) =>
            a.title.toLowerCase().includes(search.toLowerCase()),
          )
        : list,
    [list, search],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.tabs}>
        {TABS.map((tabItem) => (
          <Pressable
            key={tabItem.key}
            onPress={() => setActiveTab(tabItem.key)}
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === tabItem.key ? colors.tint : 'transparent',
                borderColor: activeTab === tabItem.key ? colors.tint : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === tabItem.key ? '#fff' : colors.text },
              ]}
            >
              {t.lists[tabItem.labelKey]}
            </Text>
          </Pressable>
        ))}
      </View>

      {list.length > 0 && (
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 16, marginRight: 6 }}>{'\u{1F50D}'}</Text>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={t.lists.searchPlaceholder}
            placeholderTextColor={colors.secondaryText}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={search ? 'magnifyingglass' : 'tray'}
          title={search ? t.lists.noSearchResults : t.lists.empty}
          subtitle={search ? t.lists.noSearchResultsSub : t.lists.emptySub}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.mal_id)}
          renderItem={({ item }) => <UserAnimeCard anime={item} />}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 0,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 0,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 40,
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
});
