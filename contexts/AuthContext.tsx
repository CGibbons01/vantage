import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
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
  // Prevent concurrent fetchUser calls from stomping each other
  const fetchingRef = useRef(false);

  useEffect(() => {
    // Initial session check on mount — with a 3-second timeout safety net
    fetchUser();

    if (Platform.OS !== "web") {
      // Re-fetch after OAuth deep-link callback so the session is picked up
      const subscription = Linking.addEventListener("url", (event) => {
        const url = event.url;
        if (url.startsWith("vantageairecruitment://auth-callback")) {
          console.log("[AuthContext] Deep-link auth callback received — re-fetching session");
          setTimeout(() => fetchUser(), 800);
        }
      });

      // Refresh session every 5 minutes (silent — does NOT set loading=true)
      const intervalId = setInterval(() => {
        silentRefresh();
      }, 5 * 60 * 1000);

      return () => {
        subscription.remove();
        clearInterval(intervalId);
      };
    }
  }, []);

  // Silent refresh: updates user state without triggering the loading spinner
  const silentRefresh = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const session = await authClient.getSession();
      if (session?.data?.user) {
        setUser(session.data.user as User);
        if (session.data.session?.token) {
          await setBearerToken(session.data.session.token);
        }
      }
      // Don't clear user on silent refresh failure — keep existing session
    } catch {
      // Ignore silent refresh errors
    } finally {
      fetchingRef.current = false;
    }
  };

  const fetchUser = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);

    // 3-second timeout — if getSession hangs, treat as logged out
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));

    try {
      console.log("[AuthContext] fetchUser — calling getSession");
      const session = await Promise.race([
        authClient.getSession(),
        timeoutPromise,
      ]);

      if (session?.data?.user) {
        console.log("[AuthContext] fetchUser — session found, user:", session.data.user.email);
        setUser(session.data.user as User);
        if (session.data.session?.token) {
          await setBearerToken(session.data.session.token);
        }
      } else {
        console.log("[AuthContext] fetchUser — no session, user is null");
        setUser(null);
        await clearAuthTokens();
      }
    } catch (error) {
      console.error("[AuthContext] fetchUser error:", error);
      setUser(null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    console.log("[AuthContext] signInWithEmail called for:", email);
    const { data, error } = await authClient.signIn.email({ email, password });
    console.log("[AuthContext] signIn.email response — data:", data, "error:", error);
    if (error) {
      throw new Error(error.message || "Sign in failed. Please check your credentials.");
    }
    await fetchUser();
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    console.log("[AuthContext] signUpWithEmail called for:", email);
    const { data, error } = await authClient.signUp.email({ email, password, name });
    console.log("[AuthContext] signUp.email response — data:", data, "error:", error);
    if (error) {
      throw new Error(error.message || "Sign up failed. Please try again.");
    }
    // Auto sign-in after signup so the session is established immediately
    console.log("[AuthContext] signUpWithEmail — auto signing in after signup");
    const { data: signInData, error: signInError } = await authClient.signIn.email({ email, password });
    console.log("[AuthContext] auto signIn after signup — data:", signInData, "error:", signInError);
    if (signInError) {
      console.warn("[AuthContext] auto sign-in after signup failed:", signInError.message);
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
      await fetchUser();
    }
  };

  const signInWithGoogle = () => signInWithSocial("google");

  const signInWithApple = async () => {
    if (Platform.OS === "ios") {
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
      await signInWithSocial("apple");
    }
  };

  const signOut = async () => {
    console.log("[AuthContext] signOut called");
    try {
      await authClient.signOut();
    } catch (error) {
      console.error("[AuthContext] signOut API error:", error);
    } finally {
      setUser(null);
      await clearAuthTokens();
      console.log("[AuthContext] signOut complete — user cleared");
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
