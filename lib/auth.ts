import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

const API_URL = "https://fm4g4jwswxk2yhw9dzncq8pqhpg8zwnt.app.specular.dev";

export const BEARER_TOKEN_KEY = "vantageairecruitment_bearer_token";

const plugins =
  Platform.OS !== "web"
    ? [
        expoClient({
          scheme: "vantageairecruitment",
          storagePrefix: "vantageairecruitment",
          storage: SecureStore,
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
    await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY);
  }
}

export { API_URL };
