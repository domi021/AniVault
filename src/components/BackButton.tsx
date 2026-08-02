import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

export function BackButton() {
  const router = useRouter();

  if (Platform.OS !== 'web') return null;

  return (
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
      <Text style={styles.icon}>{'\u2039'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 1000,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
    marginLeft: 1,
    marginTop: -1,
  },
});
