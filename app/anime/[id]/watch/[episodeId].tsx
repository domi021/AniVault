import { useLocalSearchParams, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useColors } from '@/src/hooks/useColors';
import { WebView } from 'react-native-webview';
import { getAdBlockJS, getPlayerJS, shouldBlockAdUrl, extractIframeSrc } from '@/src/api/webviewInject';
import { getSourceById } from '@/src/api/streaming';

const DIRECT_DOMAINS = ['megaplay.buzz', 'goload.pro', 'embtaku.pro'];

export default function EpisodePlayerScreen() {
  const { episodeId, url, source } = useLocalSearchParams<{ episodeId: string; url: string; source?: string }>();
  const colors = useColors();
  const rawUrl = url ? decodeURIComponent(url) : null;
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [referer, setReferer] = useState<string | undefined>();

  const sourceConfig = source ? getSourceById(source) : undefined;
  const sourceBaseUrl = sourceConfig?.baseUrl || 'https://www.anipub.xyz';

  useEffect(() => {
    if (!rawUrl) return;

    if (DIRECT_DOMAINS.some((d) => rawUrl.includes(d))) {
      setPlayerUrl(rawUrl);
      setReferer(`${sourceBaseUrl}/`);
      return;
    }

    setReferer(rawUrl);

    fetch(rawUrl)
      .then((r) => r.text())
      .then((html) => {
        const iframeSrc = extractIframeSrc(html);
        if (iframeSrc) {
          setPlayerUrl(iframeSrc.startsWith('http') ? iframeSrc : `https:${iframeSrc}`);
        } else {
          setPlayerUrl(rawUrl);
        }
      })
      .catch(() => {
        setPlayerUrl(rawUrl);
      });
  }, [rawUrl, sourceBaseUrl]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: `Episode ${episodeId}`,
          headerShown: true,
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
        }}
      />

      {!rawUrl ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.secondaryText }]}>
            No video URL available
          </Text>
        </View>
      ) : !playerUrl ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.secondaryText }]}>
            Loading player...
          </Text>
        </View>
      ) : (
        <View style={styles.videoContainer}>
          <WebView
            source={{
              uri: playerUrl,
              headers: referer ? { Referer: referer } : undefined,
            }}
            style={styles.video}
            javaScriptEnabled
            domStorageEnabled
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            startInLoadingState
            injectedJavaScriptBeforeContentLoaded={getAdBlockJS()}
            injectedJavaScript={getPlayerJS()}
            onShouldStartLoadWithRequest={(request) => !shouldBlockAdUrl(request.url)}
            onError={() => {}}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.tint} />
              </View>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 16, fontWeight: '600' },
  loadingText: { marginTop: 12, fontSize: 14 },
  videoContainer: { flex: 1, justifyContent: 'center' },
  video: { width: '100%', height: 300 },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
