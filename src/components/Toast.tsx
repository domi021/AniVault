import { StyleSheet, Text, View } from 'react-native';
import { useToastStore } from '@/src/store/toastStore';
import { useColors } from '@/src/hooks/useColors';

export function Toast() {
  const message = useToastStore((s) => s.message);
  const colors = useColors();

  if (!message) return null;

  return (
    <View style={[styles.overlay, { zIndex: 9999 }]} pointerEvents="none">
      <View style={[styles.toast, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 80,
    alignItems: 'center',
  },
  toast: {
    maxWidth: '90%',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
});
