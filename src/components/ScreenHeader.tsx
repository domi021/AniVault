import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/src/hooks/useColors';

export function ScreenHeader({ title }: { title?: string }) {
  const router = useRouter();
  const colors = useColors();

  if (Platform.OS !== 'web') return null;

  return (
    <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        hitSlop={6}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/');
          }
        }}
        style={styles.button}
      >
        <Text style={[styles.icon, { color: colors.text }]}>{'\u2039'}</Text>
      </Pressable>
      {title ? (
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 32,
    marginLeft: 1,
    marginTop: -1,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
    marginRight: 44,
  },
});
