import { useState, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/src/hooks/useColors';
import { useTranslation } from '@/src/hooks/useTranslation';
import { useAuthStore } from '@/src/store/authStore';
import { useAnimeStore } from '@/src/store/animeStore';
import { supabase } from '@/src/lib/supabase';

export default function LoginScreen() {
  const colors = useColors();
  const t = useTranslation();
  const router = useRouter();
  const { session, isGuest, setSession, setGuest } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session || isGuest) router.replace('/(tabs)');
  }, [session, isGuest]);

  const handleAuth = async () => {
    setError('');
    if (!email.trim()) { setError('Email is required'); return; }
    if (password.length < 6) { setError(t.auth.passwordShort); return; }
    if (mode === 'signup' && !username.trim()) { setError('Username is required'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { data, error: authErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authErr) throw authErr;
        if (data.session) {
          setSession(data.session);
          useAnimeStore.getState().fetchFromServer();
        }
      } else {
        const { data, error: authErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: username.trim() } },
        });
        if (authErr) throw authErr;
        if (data.session) {
          setSession(data.session);
        } else {
          setEmail('');
          setPassword('');
          setError(t.auth.checkEmail);
        }
      }
    } catch (e: any) {
      setError(e.message === 'Invalid login credentials'
        ? t.auth.loginError
        : e.message || t.auth.signupError);
    } finally {
      setLoading(false);
    }
  };

  const skip = () => {
    setGuest(true);
    router.replace('/(tabs)');
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.inner}>
        <Text style={[styles.logo, { color: colors.tint }]}>{'\u039B'}</Text>
        <Text style={[styles.title, { color: colors.text }]}>Anime Tracker</Text>
        <Text style={[styles.tagline, { color: colors.secondaryText }]}>{t.auth.tagline}</Text>

        <View style={styles.form}>
          <TextInput
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
            ]}
            placeholder="Email"
            placeholderTextColor={colors.secondaryText}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          {mode === 'signup' && (
            <TextInput
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
              ]}
              placeholder="Username"
              placeholderTextColor={colors.secondaryText}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
          <TextInput
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
            ]}
            placeholder="Password"
            placeholderTextColor={colors.secondaryText}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? <Text style={[styles.error, { color: '#ef4444' }]}>{error}</Text> : null}

          <Pressable
            onPress={handleAuth}
            disabled={loading}
            style={[styles.btn, { backgroundColor: loading ? colors.border : colors.tint }]}
          >
            <Text style={styles.btnText}>
              {loading ? '...' : mode === 'login' ? t.auth.login : t.auth.signup}
            </Text>
          </Pressable>

          <Pressable onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setUsername(''); }}>
            <Text style={[styles.toggle, { color: colors.tint }]}>
              {mode === 'login' ? t.auth.noAccount : t.auth.hasAccount}
            </Text>
          </Pressable>

          <Pressable onPress={skip}>
            <Text style={[styles.skip, { color: colors.secondaryText }]}>{t.auth.skip}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  logo: {
    fontSize: 72,
    fontWeight: '900',
    transform: [{ scaleX: 1.6 }],
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    marginBottom: 40,
  },
  form: { width: '100%', gap: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { fontSize: 14, textAlign: 'center' },
  toggle: { fontSize: 14, textAlign: 'center', marginTop: 4 },
  skip: { fontSize: 14, textAlign: 'center', marginTop: 16 },
});
