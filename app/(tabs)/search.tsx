import { useState, useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/src/hooks/useColors';
import { useTranslation } from '@/src/hooks/useTranslation';
import { searchAnime } from '@/src/api/jikan';
import { AnimeCard } from '@/src/components/AnimeCard';
import { EmptyState } from '@/src/components/EmptyState';

export default function SearchScreen() {
  const colors = useColors();
  const t = useTranslation();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchAnime(debouncedQuery),
    enabled: debouncedQuery.length > 1,
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={{ fontSize: 18, marginRight: 8 }}>{'\u{1F50D}'}</Text>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={t.search.placeholder}
          placeholderTextColor={colors.secondaryText}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {isLoading && (
        <ActivityIndicator size="large" color={colors.tint} style={{ marginTop: 40 }} />
      )}

      {isError && (
        <View style={styles.center}>
          <EmptyState icon="exclamationmark" title={t.search.error} subtitle={t.search.errorSub} />
          <Pressable
            onPress={() => queryClient.invalidateQueries({ queryKey: ['search', debouncedQuery] })}
            style={[styles.retryBtn, { backgroundColor: colors.tint }]}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {!isLoading && !isError && debouncedQuery.length > 1 && data?.data?.length === 0 && (
        <EmptyState icon="magnifyingglass" title={t.search.noResults} subtitle={`${t.search.noResultsSub} "${debouncedQuery}"`} />
      )}

      {debouncedQuery.length <= 1 && !isLoading && (
        <EmptyState
          icon="magnifyingglass"
          title={t.search.emptyTitle}
          subtitle={t.search.emptySub}
        />
      )}

      {data && data.data && data.data.length > 0 && (
        <FlatList
          data={data.data.filter((item, index, self) => self.findIndex((i) => i.mal_id === item.mal_id) === index)}
          keyExtractor={(item) => String(item.mal_id)}
          renderItem={({ item }) => <AnimeCard anime={item} />}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    alignItems: 'center',
    marginTop: 40,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
