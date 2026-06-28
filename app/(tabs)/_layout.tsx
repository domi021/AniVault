import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColors } from '@/src/hooks/useColors';
import { useTranslation } from '@/src/hooks/useTranslation';

function TabIcon({ color }: { color: string }) {
  return <Text style={{ fontSize: 18, fontWeight: '900', color, transform: [{ scaleX: 1.6 }] }}>{'\u039B'}</Text>;
}

export default function TabLayout() {
  const colors = useColors();
  const t = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: useClientOnlyValue(false, true),
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabs.home, tabBarIcon: ({ color }) => <TabIcon color={color} /> }} />
      <Tabs.Screen name="search" options={{ title: t.tabs.search, tabBarIcon: ({ color }) => <TabIcon color={color} /> }} />
      <Tabs.Screen name="recommendations" options={{ title: t.tabs.recommend, tabBarIcon: ({ color }) => <TabIcon color={color} /> }} />
      <Tabs.Screen name="lists" options={{ title: t.tabs.lists, tabBarIcon: ({ color }) => <TabIcon color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: t.tabs.settings, tabBarIcon: ({ color }) => <TabIcon color={color} /> }} />
    </Tabs>
  );
}
