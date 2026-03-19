/**
 * OneSignal Push Notification Context
 *
 * Provides push notification management for Expo + React Native apps.
 * Reads OneSignal App ID from app.json (expo.extra) automatically.
 *
 * Supports:
 * - Native iOS/Android via OneSignal SDK
 * - Permission management
 * - Notification event handling
 * - User ID linking for targeted notifications
 *
 * SETUP:
 * 1. Wrap your app with <NotificationProvider> inside <AuthProvider>
 * 2. Run: npx expo install onesignal-expo-plugin react-native-onesignal && npx expo prebuild
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Import auth hook for user targeting (validated at setup time)
import { useAuth } from "./AuthContext";

// Read App ID from app.json (expo.extra)
const extra = Constants.expoConfig?.extra || {};
const ONESIGNAL_APP_ID: string = extra.oneSignalAppId || "";

// Check if running on web
const isWeb = Platform.OS === "web";

// Lazily load OneSignal so a missing native module doesn't crash at import time.
// Returns null if the native module is unavailable (e.g. Expo Go, simulator without prebuild).
type OneSignalModule = typeof import("react-native-onesignal");
let _oneSignal: OneSignalModule | null = null;

function getOneSignal(): OneSignalModule | null {
  if (_oneSignal) return _oneSignal;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-onesignal") as OneSignalModule;
    // Verify the native module is actually registered before using it
    if (!mod?.OneSignal) {
      console.warn("[OneSignal] Module loaded but OneSignal export is missing.");
      return null;
    }
    _oneSignal = mod;
    return _oneSignal;
  } catch (err) {
    console.warn(
      "[OneSignal] Native module not available (Expo Go / missing prebuild). " +
        "Push notifications will be disabled.",
      err
    );
    return null;
  }
}

interface NotificationContextType {
  /** Whether the user has granted notification permission */
  hasPermission: boolean;
  /** Whether permission has been requested but not yet granted */
  permissionDenied: boolean;
  /** Loading state during initialization */
  loading: boolean;
  /** Whether running on web (notifications not available) */
  isWeb: boolean;
  /** Request notification permission from the user */
  requestPermission: () => Promise<boolean>;
  /** Set a tag for user segmentation */
  sendTag: (key: string, value: string) => void;
  /** Remove a tag */
  deleteTag: (key: string) => void;
  /** Last received notification data */
  lastNotification: Record<string, unknown> | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  // Get user from auth context for notification targeting
  // Safe: handles different auth context shapes (Better Auth, Supabase, etc.)
  const auth = useAuth() as Record<string, unknown> | null;
  const session = auth?.session as Record<string, unknown> | undefined;
  const user = (auth?.user ?? session?.user ?? null) as { id?: string } | null;

  const [hasPermission, setHasPermission] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastNotification, setLastNotification] = useState<Record<string, unknown> | null>(null);

  // Initialize OneSignal on mount
  useEffect(() => {
    if (isWeb) {
      setLoading(false);
      return;
    }

    if (!ONESIGNAL_APP_ID) {
      console.warn(
        "[OneSignal] App ID not provided. " +
          "Please add oneSignalAppId to app.json extra."
      );
      setLoading(false);
      return;
    }

    const os = getOneSignal();
    if (!os) {
      // Native module unavailable — fail gracefully
      setLoading(false);
      return;
    }

    try {
      const { OneSignal, NotificationWillDisplayEvent } = os;

      // Initialize OneSignal
      OneSignal.initialize(ONESIGNAL_APP_ID);

      if (__DEV__) {
        console.log(
          "[OneSignal] Initialized with App ID:",
          ONESIGNAL_APP_ID.substring(0, 8) + "..."
        );
      }

      // Check current permission status
      const permissionStatus = OneSignal.Notifications.hasPermission();
      setHasPermission(permissionStatus);

      // Listen for foreground notification events
      const foregroundHandler = (event: InstanceType<typeof NotificationWillDisplayEvent>) => {
        try {
          event.getNotification().display();
          const notification = event.getNotification();
          setLastNotification({
            title: notification.title,
            body: notification.body,
            additionalData: notification.additionalData,
          });
        } catch (err) {
          console.warn("[OneSignal] Error handling foreground notification:", err);
        }
      };
      OneSignal.Notifications.addEventListener("foregroundWillDisplay", foregroundHandler);

      // Listen for permission changes
      const permissionHandler = (granted: boolean) => {
        setHasPermission(granted);
        setPermissionDenied(!granted);
      };
      OneSignal.Notifications.addEventListener("permissionChange", permissionHandler);

      return () => {
        try {
          OneSignal.Notifications.removeEventListener("foregroundWillDisplay", foregroundHandler);
          OneSignal.Notifications.removeEventListener("permissionChange", permissionHandler);
        } catch (err) {
          console.warn("[OneSignal] Error removing event listeners:", err);
        }
      };
    } catch (error) {
      console.error("[OneSignal] Failed to initialize:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync OneSignal external user ID with authenticated user
  useEffect(() => {
    if (isWeb || !ONESIGNAL_APP_ID) return;

    const os = getOneSignal();
    if (!os) return;

    try {
      const { OneSignal } = os;
      if (user?.id) {
        OneSignal.login(user.id);
        if (__DEV__) {
          console.log("[OneSignal] Linked user ID:", user.id);
        }
      } else {
        OneSignal.logout();
      }
    } catch (error) {
      console.error("[OneSignal] Failed to update user:", error);
    }
  }, [user?.id]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isWeb) return false;
    console.log("[OneSignal] Requesting notification permission");

    const os = getOneSignal();
    if (!os) return false;

    try {
      const granted = await os.OneSignal.Notifications.requestPermission(true);
      setHasPermission(granted);
      setPermissionDenied(!granted);
      console.log("[OneSignal] Permission result:", granted);
      return granted;
    } catch (error) {
      console.error("[OneSignal] Permission request failed:", error);
      return false;
    }
  }, []);

  const sendTag = useCallback((key: string, value: string) => {
    if (isWeb) return;
    const os = getOneSignal();
    if (!os) return;
    try {
      os.OneSignal.User.addTag(key, value);
    } catch (error) {
      console.error("[OneSignal] Failed to send tag:", error);
    }
  }, []);

  const deleteTag = useCallback((key: string) => {
    if (isWeb) return;
    const os = getOneSignal();
    if (!os) return;
    try {
      os.OneSignal.User.removeTag(key);
    } catch (error) {
      console.error("[OneSignal] Failed to delete tag:", error);
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        hasPermission,
        permissionDenied,
        loading,
        isWeb,
        requestPermission,
        sendTag,
        deleteTag,
        lastNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Hook to access notification state and methods.
 *
 * @example
 * const { hasPermission, requestPermission } = useNotifications();
 *
 * if (!hasPermission) {
 *   return <Button onPress={requestPermission}>Enable Notifications</Button>;
 * }
 */
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within NotificationProvider"
    );
  }
  return context;
}
