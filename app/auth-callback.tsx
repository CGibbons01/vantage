import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/auth';
import { COLORS } from '@/constants/theme';

// Dismiss the in-app browser on native after OAuth redirect
WebBrowser.maybeCompleteAuthSession();

type Status = 'processing' | 'success' | 'error';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCallback = async () => {
    try {
      // On web, extract tokens from the URL hash and set the Supabase session
      if (typeof window !== 'undefined' && window.location?.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          console.log('[AuthCallback] Setting session from URL hash tokens');
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            console.error('[AuthCallback] setSession error:', error.message);
            setStatus('error');
            setMessage('Authentication failed. Please try again.');
            return;
          }
          setStatus('success');
          setMessage('Authentication successful! Redirecting...');
          setTimeout(() => router.replace('/(tabs)'), 1000);
          return;
        }

        const errorParam = hashParams.get('error_description') || hashParams.get('error');
        if (errorParam) {
          console.error('[AuthCallback] OAuth error in URL:', errorParam);
          setStatus('error');
          setMessage(`Authentication failed: ${errorParam}`);
          return;
        }
      }

      // On native, Supabase session is set via setSession in AuthContext after WebBrowser returns.
      // Just navigate back to the app.
      console.log('[AuthCallback] No hash tokens — navigating to tabs');
      setStatus('success');
      setMessage('Authentication successful! Redirecting...');
      setTimeout(() => router.replace('/(tabs)'), 800);
    } catch (err) {
      console.error('[AuthCallback] Unexpected error:', err);
      setStatus('error');
      setMessage('Failed to process authentication');
    }
  };

  return (
    <View style={styles.container}>
      {status === 'processing' && <ActivityIndicator size="large" color={COLORS.primaryLight} />}
      {status === 'success' && <Text style={styles.successIcon}>✓</Text>}
      {status === 'error' && <Text style={styles.errorIcon}>✗</Text>}
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.background,
  },
  successIcon: {
    fontSize: 48,
    color: COLORS.success,
  },
  errorIcon: {
    fontSize: 48,
    color: COLORS.error,
  },
  message: {
    fontSize: 18,
    marginTop: 20,
    textAlign: 'center',
    color: COLORS.text,
  },
});
