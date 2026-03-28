import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_URL = "https://fm4g4jwswxk2yhw9dzncq8pqhpg8zwnt.app.specular.dev";

export const BEARER_TOKEN_KEY = "vantageairecruitment_bearer_token";

// ─── Synchronous storage adapter ─────────────────────────────────────────────
// expo-secure-store is async, but @better-auth/expo's storageAdapter calls
// getItem/setItem synchronously (no await). We bridge this with an in-memory
// cache that is pre-populated from SecureStore before the auth client is used.
// Writes go to both the in-memory cache (instant) and SecureStore (persisted).

const memoryCache = new Map<string, string>();
let storageReady = false;

// Keys managed by the expo plugin (cookie blob + session cache)
const STORAGE_KEYS = [
  "vantageairecruitment_cookie",
  "vantageairecruitment_session_data",
];

/**
 * Pre-load all known SecureStore keys into the in-memory cache.
 * Must be awaited before authClient.getSession() is called on startup.
 */
export async function initAuthStorage(): Promise<void> {
  if (storageReady) return;
  if (Platform.OS === "web") {
    storageReady = true;
    return;
  }
  console.log("[AuthStorage] Pre-loading SecureStore keys into memory cache");
  await Promise.all(
    STORAGE_KEYS.map(async (key) => {
      try {
        const value = await SecureStore.getItemAsync(key);
        if (value !== null && value !== undefined) {
          memoryCache.set(key, value);
          console.log(`[AuthStorage] Loaded key: ${key} (${value.length} chars)`);
        }
      } catch (e) {
        console.warn(`[AuthStorage] Failed to load key ${key}:`, e);
      }
    })
  );
  storageReady = true;
  console.log("[AuthStorage] Storage ready — cached keys:", [...memoryCache.keys()]);
}

/**
 * Synchronous storage adapter for @better-auth/expo.
 * Reads from in-memory cache (populated by initAuthStorage on startup).
 * Writes go to both cache and SecureStore (fire-and-forget persist).
 */
const syncSecureStorage = {
  getItem: (key: string): string | null => {
    const value = memoryCache.get(key) ?? null;
    console.log(`[AuthStorage] getItem("${key}") → ${value ? `${value.length} chars` : "null"}`);
    return value;
  },
  setItem: (key: string, value: string): void => {
    console.log(`[AuthStorage] setItem("${key}") — ${value.length} chars`);
    memoryCache.set(key, value);
    // Persist to SecureStore asynchronously
    SecureStore.setItemAsync(key, value).catch((e) =>
      console.warn(`[AuthStorage] SecureStore.setItemAsync failed for ${key}:`, e)
    );
  },
};

// ─── Auth client ──────────────────────────────────────────────────────────────

const plugins =
  Platform.OS !== "web"
    ? [
        expoClient({
          scheme: "vantageairecruitment",
          storagePrefix: "vantageairecruitment",
          storage: syncSecureStorage,
        }),
      ]
    : [];

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins,
  ...(Platform.OS === "web" && {
    fetchOptions: {
      credentials: "include",
      auth: {
        type: "Bearer" as const,
        token: () => localStorage.getItem(BEARER_TOKEN_KEY) || "",
      },
    },
  }),
});

export async function setBearerToken(token: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(BEARER_TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token);
  }
}

export async function clearAuthTokens() {
  if (Platform.OS === "web") {
    localStorage.removeItem(BEARER_TOKEN_KEY);
  } else {
    // Clear both the bearer token and the expo plugin's cookie/session keys
    await Promise.all([
      SecureStore.deleteItemAsync(BEARER_TOKEN_KEY).catch(() => {}),
      ...STORAGE_KEYS.map((k) => SecureStore.deleteItemAsync(k).catch(() => {})),
    ]);
    STORAGE_KEYS.forEach((k) => memoryCache.delete(k));
    memoryCache.delete(BEARER_TOKEN_KEY);
  }
}

export { API_URL };
