import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/src/hooks/useColors';

interface Props {
  icon?: string;
  title: string;
  subtitle?: string;
}

const ICONS: Record<string, string> = {
  tray: '\u{1F4E6}',
  magnifyingglass: '\u{1F50D}',
  exclamationmark: '\u26A0\uFE0F',
  popcorn: '\u{1F37F}',
};

export function EmptyState({ icon = 'tray', title, subtitle }: Props) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <Text style={{ fontSize: 48 }}>{ICONS[icon] || '\u{1F4E6}'}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>{subtitle}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});
