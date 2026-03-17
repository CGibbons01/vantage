import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { authClient, setBearerToken, clearAuthTokens } from "@/lib/auth";

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

function openOAuthPopup(provider: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popupUrl = `${window.location.origin}/auth-popup?provider=${provider}`;
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      popupUrl,
      "oauth-popup",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup) {
      reject(new Error("Failed to open popup. Please allow popups."));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "oauth-success" && event.data?.token) {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        resolve(event.data.token);
      } else if (event.data?.type === "oauth-error") {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        reject(new Error(event.data.error || "OAuth failed"));
      }
    };

    window.addEventListener("message", handleMessage);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        reject(new Error("Authentication cancelled"));
      }
    }, 500);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();

    if (Platform.OS !== "web") {
      // On native, the expoClient plugin handles the deep link internally and
      // stores the session token. We wait 800ms after the deep link fires so
      // the plugin has time to complete the token exchange before we call
      // getSession() — otherwise we read an empty session and stay logged out.
      const subscription = Linking.addEventListener("url", (event) => {
        const url = event.url;
        if (url.startsWith("vantageairecruitment://auth-callback")) {
          setTimeout(() => fetchUser(), 800);
        }
      });

      const intervalId = setInterval(() => {
        fetchUser();
      }, 5 * 60 * 1000);

      return () => {
        subscription.remove();
        clearInterval(intervalId);
      };
    }
  }, []);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const session = await authClient.getSession();
      if (session?.data?.user) {
        setUser(session.data.user as User);
        if (session.data.session?.token) {
          await setBearerToken(session.data.session.token);
        }
      } else {
        setUser(null);
        await clearAuthTokens();
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    console.log('[AuthContext] signInWithEmail called for:', email);
    const { data, error } = await authClient.signIn.email({ email, password });
    console.log('[AuthContext] signIn.email response — data:', data, 'error:', error);
    if (error) {
      throw new Error(error.message || 'Sign in failed. Please check your credentials.');
    }
    await fetchUser();
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    console.log('[AuthContext] signUpWithEmail called for:', email);
    const { data, error } = await authClient.signUp.email({ email, password, name });
    console.log('[AuthContext] signUp.email response — data:', data, 'error:', error);
    if (error) {
      throw new Error(error.message || 'Sign up failed. Please try again.');
    }
    // Immediately sign in after signup so the session is established right away.
    // Better Auth does not always auto-create a session on signup.
    console.log('[AuthContext] signUpWithEmail — auto signing in after signup');
    const { data: signInData, error: signInError } = await authClient.signIn.email({ email, password });
    console.log('[AuthContext] auto signIn after signup — data:', signInData, 'error:', signInError);
    if (signInError) {
      // Signup succeeded but auto-login failed — still fetch session in case it was set
      console.warn('[AuthContext] auto sign-in after signup failed:', signInError.message);
    }
    await fetchUser();
  };

  const signInWithSocial = async (provider: string) => {
    if (Platform.OS === "web") {
      const token = await openOAuthPopup(provider);
      await setBearerToken(token);
      await fetchUser();
    } else {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: "vantageairecruitment://auth-callback",
      });
      if (error) {
        throw new Error(error.message || "Social sign in failed");
      }
      // expoClient resolves the promise only after the in-app browser closes
      // and the session is stored — safe to fetch immediately here.
      await fetchUser();
    }
  };

  const signInWithGoogle = () => signInWithSocial("google");

  const signInWithApple = async () => {
    if (Platform.OS === "ios") {
      // Native Apple Sign In on iOS — shows the system Face ID / password modal
      const AppleAuthentication = require("expo-apple-authentication");
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error("No identity token received from Apple");
      }
      const { error } = await authClient.signIn.social({
        provider: "apple",
        idToken: credential.identityToken,
      });
      if (error) {
        throw new Error(error.message || "Apple sign in failed");
      }
      await fetchUser();
    } else {
      // Web / Android: OAuth redirect flow
      await signInWithSocial("apple");
    }
  };

  const signOut = async () => {
    try {
      await authClient.signOut();
    } catch (error) {
      console.error("Sign out failed (API):", error);
    } finally {
      setUser(null);
      await clearAuthTokens();
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
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
