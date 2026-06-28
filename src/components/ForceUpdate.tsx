import { useState, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/src/hooks/useColors';
import { checkForUpdate, downloadAndInstall, UpdateInfo } from '@/src/lib/update';
import Constants from 'expo-constants';

export default function ForceUpdate() {
  const colors = useColors();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const current = Constants.expoConfig?.version || '1.0.0';
    checkForUpdate(current).then((info) => {
      if (info) setUpdate(info);
    });
  }, []);

  const handleDownload = async () => {
    if (!update) return;
    setDownloading(true);
    try {
      await downloadAndInstall(update.apkUrl);
    } catch (e: any) {
      setDownloading(false);
    }
  };

  return (
    <Modal visible={!!update} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={[styles.overlay, { backgroundColor: colors.background }]}>
        <Text style={[styles.icon, { color: colors.tint }]}>{'\u039B'}</Text>
        <Text style={[styles.title, { color: colors.text }]}>Update Available</Text>
        <Text style={[styles.desc, { color: colors.secondaryText }]}>
          A new version is ready. Please download and install to continue using the app.
        </Text>
        <Pressable
          onPress={handleDownload}
          disabled={downloading}
          style={[styles.btn, { backgroundColor: colors.tint }]}
        >
          <Text style={styles.btnText}>
            {downloading ? 'Downloading...' : 'Download & Install'}
          </Text>
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
