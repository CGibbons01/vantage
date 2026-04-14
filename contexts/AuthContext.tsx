import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/auth';

interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function supabaseUserToUser(supabaseUser: any): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    name: supabaseUser.user_metadata?.name ?? supabaseUser.user_metadata?.full_name,
    image: supabaseUser.user_metadata?.avatar_url,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  useEffect(() => {
    // Listen to Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (__DEV__) console.log('[AuthContext] onAuthStateChange — event:', _event, 'user:', session?.user?.email ?? null);
      if (session?.user) {
        setUser(supabaseUserToUser(session.user));
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Initial session fetch
    fetchUser();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchUser = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      if (__DEV__) console.log('[AuthContext] fetchUser — calling getSession');
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        if (__DEV__) console.warn('[AuthContext] fetchUser — getSession error:', error.message);
        setUser(null);
      } else if (data.session?.user) {
        if (__DEV__) console.log('[AuthContext] fetchUser — session found, user:', data.session.user.email);
        setUser(supabaseUserToUser(data.session.user));
      } else {
        if (__DEV__) console.log('[AuthContext] fetchUser — no session, user is null');
        setUser(null);
      }
    } catch (error) {
      if (__DEV__) console.error('[AuthContext] fetchUser error:', error);
      setUser(null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (__DEV__) console.log('[AuthContext] signInWithEmail called for:', email);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (__DEV__) console.log('[AuthContext] signInWithPassword response — user:', data?.user?.email ?? null, 'error:', error?.message ?? null);
    if (error) {
      throw new Error(error.message || 'Sign in failed. Please check your credentials.');
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    if (__DEV__) console.log('[AuthContext] signUpWithEmail called for:', email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (__DEV__) console.log('[AuthContext] signUp response — user:', data?.user?.email ?? null, 'error:', error?.message ?? null);
    if (error) {
      throw new Error(error.message || 'Sign up failed. Please try again.');
    }
    // If email confirmation is disabled, the user is signed in immediately.
    // If confirmation is required, data.session will be null — inform the user.
    if (!data.session) {
      if (__DEV__) console.log('[AuthContext] signUpWithEmail — email confirmation required, auto signing in');
      // Attempt immediate sign-in in case confirmation is not required
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        // Confirmation is likely required — surface a friendly message
        throw new Error('Account created! Please check your email to confirm your account before signing in.');
      }
    }
  };

  const signInWithGoogle = async () => {
    if (__DEV__) console.log('[AuthContext] signInWithGoogle called');

    if (Platform.OS === 'web') {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth-callback` },
        });
        if (error) throw new Error(error.message || 'Google sign in failed');
      } catch (e: any) {
        if (__DEV__) console.error('[AuthContext] signInWithGoogle web error:', e);
        throw new Error('Sign in with Google is currently unavailable. Please use email and password.');
      }
      return;
    }

    // Native: use deep link scheme
    const redirectUrl = makeRedirectUri({
      scheme: 'vantageairecruitment',
      path: 'auth-callback',
    });
    if (__DEV__) console.log('[AuthContext] signInWithGoogle — redirectUrl:', redirectUrl);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        if (__DEV__) console.error('[AuthContext] signInWithGoogle OAuth error:', error.message);
        throw new Error('Sign in with Google is currently unavailable. Please use email and password.');
      }

      if (data?.url) {
        if (__DEV__) console.log('[AuthContext] signInWithGoogle — opening browser session');
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (__DEV__) console.log('[AuthContext] signInWithGoogle — browser result type:', result.type);

        if (result.type === 'success') {
          const url = new URL(result.url);
          const hashParams = new URLSearchParams(url.hash.substring(1));
          const accessToken = url.searchParams.get('access_token') || hashParams.get('access_token');
          const refreshToken = url.searchParams.get('refresh_token') || hashParams.get('refresh_token');

          // Also check for PKCE code flow
          const code = url.searchParams.get('code');

          if (accessToken && refreshToken) {
            if (__DEV__) console.log('[AuthContext] signInWithGoogle — setting session from tokens');
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) {
              if (__DEV__) console.error('[AuthContext] signInWithGoogle setSession error:', sessionError.message);
              throw new Error('Sign in with Google is currently unavailable. Please use email and password.');
            }
          } else if (code) {
            if (__DEV__) console.log('[AuthContext] signInWithGoogle — exchanging code for session');
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              if (__DEV__) console.error('[AuthContext] signInWithGoogle exchangeCode error:', exchangeError.message);
              throw new Error('Sign in with Google is currently unavailable. Please use email and password.');
            }
          } else {
            if (__DEV__) console.warn('[AuthContext] signInWithGoogle — no tokens or code found in callback URL');
            throw new Error('Sign in with Google is currently unavailable. Please use email and password.');
          }
        } else if (result.type === 'cancel' || result.type === 'dismiss') {
          throw new Error('Authentication cancelled');
        }
      }
    } catch (e: any) {
      if (e.message === 'Authentication cancelled') throw e;
      if (__DEV__) console.error('[AuthContext] signInWithGoogle error:', e.message);
      throw new Error('Sign in with Google is currently unavailable. Please use email and password.');
    }

    await fetchUser();
  };

  const signInWithApple = async () => {
    if (__DEV__) console.log('[AuthContext] signInWithApple called');
    if (Platform.OS === 'android') {
      throw new Error('Sign in with Apple is not available on Android.');
    }
    if (Platform.OS === 'ios') {
      try {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!credential.identityToken) {
          throw new Error('No identity token received from Apple');
        }
        if (__DEV__) console.log('[AuthContext] signInWithApple — got identity token, calling signInWithIdToken');
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) throw new Error(error.message || 'Apple sign in failed');
        await fetchUser();
      } catch (e: any) {
        // ERR_CANCELED means user dismissed the Apple sheet — treat as cancellation
        if (e.code === 'ERR_CANCELED' || e.message === 'Authentication cancelled') {
          throw new Error('Authentication cancelled');
        }
        if (__DEV__) console.error('[AuthContext] signInWithApple error:', e.message);
        throw e;
      }
    } else {
      // Web / Android — use OAuth redirect
      if (Platform.OS === 'web') {
        try {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'apple',
            options: { redirectTo: `${window.location.origin}/auth-callback` },
          });
          if (error) throw new Error(error.message || 'Apple sign in failed');
        } catch (e: any) {
          if (__DEV__) console.error('[AuthContext] signInWithApple web error:', e);
          throw e;
        }
        return;
      }

      const redirectUrl = makeRedirectUri({ scheme: 'vantageairecruitment', path: 'auth-callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      });
      if (error) throw new Error(error.message || 'Apple sign in failed');

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success') {
          const url = new URL(result.url);
          const hashParams = new URLSearchParams(url.hash.substring(1));
          const accessToken = url.searchParams.get('access_token') || hashParams.get('access_token');
          const refreshToken = url.searchParams.get('refresh_token') || hashParams.get('refresh_token');
          const code = url.searchParams.get('code');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          } else if (code) {
            await supabase.auth.exchangeCodeForSession(code);
          }
        } else if (result.type === 'cancel' || result.type === 'dismiss') {
          throw new Error('Authentication cancelled');
        }
      }
      await fetchUser();
    }
  };

  const signOut = async () => {
    if (__DEV__) console.log('[AuthContext] signOut called');
    try {
      const { error } = await supabase.auth.signOut();
      if (error && __DEV__) console.error('[AuthContext] signOut error:', error.message);
    } catch (error) {
      if (__DEV__) console.error('[AuthContext] signOut exception:', error);
    } finally {
      setUser(null);
      if (__DEV__) console.log('[AuthContext] signOut complete — user cleared');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithApple,
        signInWithGoogle,
        signOut,
        fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
