import { useState, useEffect } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/src/hooks/useColors';
import { checkForUpdate, getUpdateUrl, UpdateInfo } from '@/src/lib/update';

export default function ForceUpdate() {
  const colors = useColors();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    checkForUpdate().then((info) => {
      if (info) setUpdate(info);
    });
  }, []);

  const handleUpdate = () => {
    Linking.openURL(getUpdateUrl());
  };

  return (
    <Modal visible={!!update} transparent animationType="fade" onRequestClose={() => setUpdate(null)}>
      <View style={[styles.overlay, { backgroundColor: colors.background }]}>
        <Text style={[styles.icon, { color: colors.tint }]}>{'\u039B'}</Text>
        <Text style={[styles.title, { color: colors.text }]}>Update Available</Text>
        <Text style={[styles.desc, { color: colors.secondaryText }]}>
          A new version is ready. Tap below to download it.
        </Text>
        <Pressable
          onPress={handleUpdate}
          style={[styles.btn, { backgroundColor: colors.tint }]}
        >
          <Text style={styles.btnText}>Download</Text>
        </Pressable>
        <Pressable onPress={() => setUpdate(null)} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.secondaryText, fontSize: 14 }}>Later</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  icon: { fontSize: 72, fontWeight: '900', transform: [{ scaleX: 1.6 }], marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  desc: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  btn: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 10, minWidth: 220, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
