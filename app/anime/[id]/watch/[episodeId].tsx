import { useLocalSearchParams, Stack } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useColors } from '@/src/hooks/useColors';
import { WebView } from 'react-native-webview';
import { getAdBlockJS, getPlayerJS, shouldBlockAdUrl, extractIframeSrc } from '@/src/api/webviewInject';

const DIRECT_DOMAINS = ['megaplay.buzz', 'goload.pro', 'embtaku.pro'];
const MAX_AUTO_RETRIES = 2;

export default function EpisodePlayerScreen() {
  const { episodeId, url, urls } = useLocalSearchParams<{ episodeId: string; url: string; urls: string }>();
  const colors = useColors();
  const rawUrl = url ? decodeURIComponent(url) : null;

  const altUrls = useRef<string[]>([]);
  useEffect(() => {
    if (urls) {
      try { altUrls.current = JSON.parse(decodeURIComponent(urls)); } catch { altUrls.current = []; }
    }
  }, [urls]);

  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [referer, setReferer] = useState<string | undefined>();
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const currentUrlIndex = useRef(0);
  const webViewRef = useRef<WebView>(null);
  const loadTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const resolveUrl = useCallback(async (targetUrl: string) => {
    if (DIRECT_DOMAINS.some((d) => targetUrl.includes(d))) {
      return { player: targetUrl, referer: 'https://anipub.xyz/' };
    }
    try {
      const res = await fetch(targetUrl);
      const html = await res.text();
      const iframeSrc = extractIframeSrc(html);
      if (iframeSrc) {
        const full = iframeSrc.startsWith('http') ? iframeSrc : `https:${iframeSrc}`;
        return { player: full, referer: targetUrl };
      }
    } catch { /* fall through */ }
    return { player: targetUrl, referer: targetUrl };
  }, []);

  const tryUrl = useCallback(async (targetUrl: string) => {
    setPlayerUrl(null);
    setFailed(false);
    const resolved = await resolveUrl(targetUrl);
    setReferer(resolved.referer);
    setPlayerUrl(resolved.player);

    clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => {
      handleErrorRef.current();
    }, 15000);
  }, [resolveUrl]);

  const handleError = useCallback(() => {
    clearTimeout(loadTimer.current);
    const nextIndex = currentUrlIndex.current + 1;

    if (retryCount < MAX_AUTO_RETRIES) {
      setRetryCount((c) => c + 1);
      tryUrl(rawUrl!);
      return;
    }

    if (nextIndex < altUrls.current.length) {
      currentUrlIndex.current = nextIndex;
      setRetrying(true);
      setRetryCount(0);
      tryUrl(altUrls.current[nextIndex]).then(() => setRetrying(false));
      return;
    }

    setFailed(true);
  }, [retryCount, rawUrl, tryUrl]);

  const handleErrorRef = useRef(handleError);
  handleErrorRef.current = handleError;

  useEffect(() => {
    if (!rawUrl) return;
    currentUrlIndex.current = 0;
    setRetryCount(0);
    setFailed(false);
    setRetrying(true);
    tryUrl(rawUrl).then(() => setRetrying(false));

    return () => clearTimeout(loadTimer.current);
  }, [rawUrl, tryUrl]);

  const handleManualRetry = () => {
    currentUrlIndex.current = 0;
    setRetryCount(0);
    setFailed(false);
    setRetrying(true);
    tryUrl(rawUrl!).then(() => setRetrying(false));
  };

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
      ) : failed ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.secondaryText }]}>
            Source unavailable
          </Text>
          <Text style={[styles.errorSub, { color: colors.secondaryText }]}>
            Could not load video after multiple attempts
          </Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: colors.tint }]} onPress={handleManualRetry}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : !playerUrl || retrying ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.secondaryText }]}>
            {retrying ? 'Trying another source...' : 'Loading player...'}
          </Text>
        </View>
      ) : (
        <View style={styles.videoContainer}>
          <WebView
            ref={webViewRef}
            key={playerUrl}
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
            onLoadEnd={() => clearTimeout(loadTimer.current)}
            onError={handleError}
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
  errorText: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  errorSub: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
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
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
