/**
 * RevenueCat Subscription Context
 *
 * Provides subscription management for Expo + React Native apps.
 * Reads API keys from app.json (expo.extra) automatically.
 *
 * Supports:
 * - Native iOS/Android via RevenueCat SDK
 * - Web preview via RevenueCat REST API (read-only pricing display)
 * - Expo Go via test store keys
 *
 * Rate-limit protection (RC error 7638 / HTTP 429):
 * - 60-second cache: returns cached CustomerInfo if fetched within last 60s
 * - In-flight deduplication: concurrent calls share the same promise
 * - Debounce: rapid successive calls are collapsed into one (300ms window)
 * - Exponential backoff on 429: waits 2s → 4s → 8s before retrying
 * - AppState foreground checks are cache-gated (won't call RC if cache is fresh)
 * - User-identity changes use a 2s debounce to avoid burst on auth state flux
 *
 * SETUP:
 * 1. Wrap your app with <SubscriptionProvider> inside <AuthProvider>
 * 2. Run: pnpm install react-native-purchases && npx expo prebuild
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import Purchases, {
  PurchasesOfferings,
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
} from "react-native-purchases";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

// Import auth hook for user syncing (validated at setup time)
import { useAuth } from "./AuthContext";

// Read API keys from app.json (expo.extra)
const extra = Constants.expoConfig?.extra || {};
const IOS_API_KEY = extra.revenueCatApiKeyIos || "";
const ANDROID_API_KEY = extra.revenueCatApiKeyAndroid || "";
const TEST_IOS_API_KEY = extra.revenueCatTestApiKeyIos || "";
const TEST_ANDROID_API_KEY = extra.revenueCatTestApiKeyAndroid || "";
const ENTITLEMENT_ID = extra.revenueCatEntitlementId || "premium";

// Check if running on web
const isWeb = Platform.OS === "web";
// Use nativelyProjectId (unique UUID) for scoping; fall back to slug for backward compatibility
const _PROJECT_SCOPE =
  Constants.expoConfig?.extra?.nativelyProjectId ||
  Constants.expoConfig?.slug ||
  "app";
const MOCK_PURCHASE_KEY = `rc_mock_purchased_${_PROJECT_SCOPE}`;
// Scoped native dev mock key — persists simulated subscription in Expo Go via expo-secure-store
const MOCK_NATIVE_KEY = `rc_dev_native_${_PROJECT_SCOPE}`;
// Scoped native cache key — persists real subscription state for fast restore on bundle reload
const NATIVE_PURCHASE_KEY = `rc_subscribed_${_PROJECT_SCOPE}`;

// Cache TTL: return cached CustomerInfo if fetched within this window
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
// Debounce window: collapse rapid successive checkSubscription calls
const DEBOUNCE_MS = 300;
// Exponential backoff delays for 429 retries: 2s, 4s, 8s
const BACKOFF_DELAYS_MS = [2000, 4000, 8000];

interface SubscriptionContextType {
  /** Whether the user has an active subscription */
  isSubscribed: boolean;
  /** All offerings from RevenueCat */
  offerings: PurchasesOfferings | null;
  /** The current/default offering */
  currentOffering: PurchasesOffering | null;
  /** Available packages in the current offering */
  packages: PurchasesPackage[];
  /** Loading state during initialization */
  loading: boolean;
  /** Whether running on web (purchases not available) */
  isWeb: boolean;
  /** Purchase a package - returns true if successful */
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  /** Restore previous purchases - returns true if subscription found */
  restorePurchases: () => Promise<boolean>;
  /** Manually re-check subscription status (bypasses cache) */
  checkSubscription: () => Promise<void>;
  /** Mock a successful purchase on web (preview only) - sets isSubscribed to true */
  mockWebPurchase: () => void;
  /** Dev-only: simulate a purchase in Expo Go — persists across reloads via expo-secure-store */
  mockNativePurchase: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  // Get user from auth context for subscription syncing across devices
  // Safe: handles different auth context shapes (Better Auth, Supabase, etc.)
  const auth = useAuth() as Record<string, unknown> | null;
  const session = auth?.session as Record<string, unknown> | undefined;
  const user = (auth?.user ?? session?.user ?? null) as { id?: string } | null;
  const authLoading = (auth?.loading ?? false) as boolean;

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [currentOffering, setCurrentOffering] =
    useState<PurchasesOffering | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  // ── Rate-limit protection refs ──────────────────────────────────────────────
  // Timestamp of the last successful getCustomerInfo() call
  const lastFetchedAt = useRef<number>(0);
  // In-flight deduplication: if a check is already running, reuse its promise
  const inflightCheck = useRef<Promise<void> | null>(null);
  // Debounce timer: collapses rapid successive calls into one
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Exponential backoff: how many consecutive 429s we've seen
  const retryCount = useRef<number>(0);
  // Backoff retry timer handle (so we can cancel on unmount)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounce timer for user-identity changes
  const userSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ────────────────────────────────────────────────────────────────────────────

  // Fetch offerings via REST API for web platform
  const fetchOfferingsViaRest = async () => {
    // Mock package with real prices from RevenueCat dashboard
    const mockPackage = {
      identifier: "$rc_monthly",
      product: {
        title: "Premium",
        priceString: "$15/month",
        description: "Unlock all premium features",
      },
    };

    setPackages([mockPackage] as PurchasesPackage[]);
    if (__DEV__) console.log("[RevenueCat] Web preview: showing real prices from dashboard");
  };

  /**
   * Core getCustomerInfo() call with:
   * - 60s cache (skip if fresh)
   * - In-flight deduplication (concurrent calls share one promise)
   * - Exponential backoff on 429 (2s → 4s → 8s)
   *
   * @param force - bypass the cache and always call RC
   */
  const _doCheckSubscription = useCallback(
    async (force = false): Promise<void> => {
      if (isWeb) return;

      // ── Cache gate ──────────────────────────────────────────────────────────
      const now = Date.now();
      if (!force && now - lastFetchedAt.current < CACHE_TTL_MS) {
        if (__DEV__) console.log(
          "[RevenueCat] checkSubscription: cache hit — skipping API call " +
            `(${Math.round((CACHE_TTL_MS - (now - lastFetchedAt.current)) / 1000)}s remaining)`
        );
        return;
      }

      // ── In-flight deduplication ─────────────────────────────────────────────
      if (inflightCheck.current) {
        if (__DEV__) console.log(
          "[RevenueCat] checkSubscription: request already in-flight — reusing promise"
        );
        return inflightCheck.current;
      }

      const doFetch = async (): Promise<void> => {
        try {
          if (__DEV__) console.log(
            "[RevenueCat] checkSubscription: calling getCustomerInfo()"
          );
          const customerInfo = await Purchases.getCustomerInfo();

          // Success — reset backoff counter and update cache timestamp
          retryCount.current = 0;
          lastFetchedAt.current = Date.now();

          const hasEntitlement =
            typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !==
            "undefined";

          // In __DEV__: RC test store purchases don't survive configure(), so only update
          // state positively — mock/test purchase state persists via SecureStore cache.
          if (hasEntitlement || !__DEV__) {
            setIsSubscribed(hasEntitlement);
          }
          if (hasEntitlement) {
            await SecureStore.setItemAsync(NATIVE_PURCHASE_KEY, "true").catch(
              () => {}
            );
          } else if (!__DEV__) {
            await SecureStore.setItemAsync(
              NATIVE_PURCHASE_KEY,
              "false"
            ).catch(() => {});
          }
        } catch (error: any) {
          // ── 429 / rate-limit: exponential backoff ───────────────────────────
          const statusCode =
            error?.userInfo?.statusCode ??
            error?.statusCode ??
            error?.code;
          const isRateLimited =
            statusCode === 429 ||
            // RC SDK surfaces error 7638 for "another request in progress"
            error?.userInfo?.code === 7638 ||
            error?.code === 7638;

          if (isRateLimited) {
            const attempt = retryCount.current;
            const delay =
              BACKOFF_DELAYS_MS[Math.min(attempt, BACKOFF_DELAYS_MS.length - 1)];
            retryCount.current = attempt + 1;

            if (__DEV__) console.warn(
              `[RevenueCat] Rate limited (429 / error 7638) — ` +
                `retry #${attempt + 1} in ${delay / 1000}s (keeping last known state)`
            );

            // Clear any existing retry timer before scheduling a new one
            if (retryTimer.current) clearTimeout(retryTimer.current);
            retryTimer.current = setTimeout(() => {
              retryTimer.current = null;
              // Force=true so the cache doesn't block the retry
              _doCheckSubscription(true);
            }, delay);
          } else {
            // Non-rate-limit error — reset backoff, log, keep last known state
            retryCount.current = 0;
            if (__DEV__) console.error("[RevenueCat] Failed to check subscription:", error);
          }
          // Never reset isSubscribed on error — avoids incorrectly showing paywall
        } finally {
          inflightCheck.current = null;
        }
      };

      inflightCheck.current = doFetch();
      return inflightCheck.current;
    },
    // isWeb is a module-level constant so it's safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /**
   * Public checkSubscription — debounced wrapper around _doCheckSubscription.
   * Collapses rapid successive calls (e.g. multiple renders, navigation events)
   * into a single API call after a 300ms quiet window.
   * Exposed in context as the "manual refresh" method (always force=true).
   */
  const checkSubscription = useCallback((): Promise<void> => {
    if (__DEV__) console.log("[RevenueCat] checkSubscription: requested (debouncing)");
    return new Promise((resolve) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        debounceTimer.current = null;
        // Public API always forces a fresh fetch (bypasses cache)
        await _doCheckSubscription(true);
        resolve();
      }, DEBOUNCE_MS);
    });
  }, [_doCheckSubscription]);

  // Initialize RevenueCat on mount — runs exactly once
  useEffect(() => {
    let customerInfoListener: { remove: () => void } | null = null;

    const initRevenueCat = async () => {
      try {
        // Web platform: SDK doesn't work, use REST API for basic info
        if (isWeb) {
          await fetchOfferingsViaRest();
          // Restore mock purchase state persisted from a previous session
          if (
            typeof window !== "undefined" &&
            localStorage.getItem(MOCK_PURCHASE_KEY) === "true"
          ) {
            setIsSubscribed(true);
          }
          setLoading(false);
          return;
        }

        // Check if the react-native-purchases native module is available.
        // It is NOT available in standard Expo Go — only in custom dev builds and production builds.
        // DO NOT change this check or replace with AsyncStorage-based workarounds.
        if (typeof Purchases?.configure !== "function") {
          if (__DEV__) console.warn(
            "[RevenueCat] react-native-purchases native module not available. " +
              "Purchases require a custom dev build or production build, not standard Expo Go."
          );
          // In DEV mode, restore any previously simulated subscription state from expo-secure-store.
          // This lets you test subscription-gated features in standard Expo Go across reloads.
          if (__DEV__) {
            const mockState = await SecureStore.getItemAsync(
              MOCK_NATIVE_KEY
            ).catch(() => null);
            if (mockState === "true") {
              setIsSubscribed(true);
            }
          }
          setLoading(false);
          return;
        }

        // Use DEBUG log level in development, INFO in production
        Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);

        // Get API key based on platform and environment
        // In development (__DEV__), use ANY available test key (test store works for all platforms)
        // This allows Expo Go to work on iOS even without a platform-specific test key
        const testKey = TEST_IOS_API_KEY || TEST_ANDROID_API_KEY;
        const productionKey =
          Platform.OS === "ios" ? IOS_API_KEY : ANDROID_API_KEY;
        const apiKey = __DEV__ && testKey ? testKey : productionKey;

        if (!apiKey) {
          if (__DEV__) console.warn(
            "[RevenueCat] API key not provided for this platform. " +
              "Please add revenueCatApiKeyIos/revenueCatApiKeyAndroid to app.json extra."
          );
          setLoading(false);
          return;
        }

        if (__DEV__) {
          console.log(
            "[RevenueCat] Initializing in DEV mode with key:",
            apiKey.substring(0, 10) + "..."
          );
          // Restore cached subscription state immediately to avoid paywall flash on bundle reload.
          // The customerInfoUpdateListener (fired by configure() below) is the authoritative
          // source and will immediately overwrite this with real RC Keychain data.
          const cached = await SecureStore.getItemAsync(
            NATIVE_PURCHASE_KEY
          ).catch(() => null);
          if (cached === "true") {
            setIsSubscribed(true);
          }
        }

        await Purchases.configure({ apiKey });
        setIsConfigured(true);

        // Listen for real-time subscription changes (e.g., purchase from another device).
        // This listener fires immediately after configure() with the cached local state,
        // so it counts as our initial check — we update the cache timestamp here to
        // prevent a redundant getCustomerInfo() call right after.
        customerInfoListener = Purchases.addCustomerInfoUpdateListener(
          (customerInfo) => {
            if (__DEV__) console.log(
              "[RevenueCat] customerInfoUpdateListener fired — updating state from listener"
            );
            // Update cache timestamp so the subsequent checkSubscription() call is skipped
            lastFetchedAt.current = Date.now();
            const hasEntitlement =
              typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !==
              "undefined";
            // In __DEV__: don't clear subscription state — RevenueCat test store purchases are
            // in-memory only and won't be known to RC after a configure() call on reload.
            if (hasEntitlement || !__DEV__) {
              setIsSubscribed(hasEntitlement);
            }
          }
        );

        // Fetch available products/packages (separate from customer info — no rate-limit concern)
        await fetchOfferings();

        // Initial subscription check — cache-gated so the listener above can short-circuit it
        await _doCheckSubscription(false);
      } catch (error) {
        if (__DEV__) console.error("[RevenueCat] Failed to initialize:", error);
      } finally {
        setLoading(false);
      }
    };

    initRevenueCat();

    // Cleanup on unmount
    return () => {
      if (customerInfoListener) customerInfoListener.remove();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (userSyncTimer.current) clearTimeout(userSyncTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync RevenueCat user ID with authenticated user.
  // Debounced by 2s to avoid burst calls during auth state flux (e.g. token refresh).
  // Only runs once isConfigured=true and authLoading=false.
  useEffect(() => {
    if (!isConfigured || isWeb) return;
    if (authLoading) return; // Don't act while auth is still resolving

    // Debounce: auth state can flip multiple times quickly (e.g. session restore)
    if (userSyncTimer.current) clearTimeout(userSyncTimer.current);
    userSyncTimer.current = setTimeout(async () => {
      userSyncTimer.current = null;
      try {
        if (user?.id) {
          if (__DEV__) console.log(
            "[RevenueCat] Syncing user ID:",
            user.id.substring(0, 8) + "..."
          );
          await Purchases.logIn(user.id);
        } else {
          if (__DEV__) console.log("[RevenueCat] No user — logging out to anonymous");
          await Purchases.logOut();
        }
        // After identity change, invalidate cache and do a fresh check
        // (user may have a different subscription on their account)
        lastFetchedAt.current = 0;
        await _doCheckSubscription(true);
      } catch (error) {
        if (__DEV__) console.error("[RevenueCat] Failed to update user:", error);
      }
    }, 2000);
  }, [user?.id, isConfigured, authLoading, _doCheckSubscription]);

  // Re-check subscription when app comes back to foreground.
  // Cache-gated: if the cache is still fresh (< 60s), the call is a no-op.
  // This prevents a burst of RC calls when the user rapidly switches apps.
  useEffect(() => {
    if (isWeb) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        if (__DEV__) console.log(
          "[RevenueCat] App foregrounded — checking subscription (cache-gated)"
        );
        // Use _doCheckSubscription directly (not the debounced public one) so
        // the cache TTL is the only gate — no extra 300ms delay on foreground.
        _doCheckSubscription(false);
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription.remove();
    // isConfigured intentionally omitted — we want this listener active even
    // before configure() finishes so we don't miss a foreground event during init
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_doCheckSubscription]);

  const fetchOfferings = async () => {
    if (isWeb) return;
    try {
      const fetchedOfferings = await Purchases.getOfferings();
      setOfferings(fetchedOfferings);

      if (fetchedOfferings.current) {
        setCurrentOffering(fetchedOfferings.current);
        setPackages(fetchedOfferings.current.availablePackages);
      }
    } catch (error) {
      if (__DEV__) console.error("[RevenueCat] Failed to fetch offerings:", error);
    }
  };

  const purchasePackage = async (pkg: PurchasesPackage): Promise<boolean> => {
    if (isWeb) {
      if (__DEV__) console.warn("[RevenueCat] Purchases not available on web");
      return false;
    }
    if (__DEV__) console.log(
      "[RevenueCat] purchasePackage: initiating purchase for",
      pkg.identifier
    );
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      // Invalidate cache so the next check fetches fresh state
      lastFetchedAt.current = 0;
      const hasEntitlement =
        typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined";
      setIsSubscribed(hasEntitlement);
      if (hasEntitlement) {
        await SecureStore.setItemAsync(NATIVE_PURCHASE_KEY, "true").catch(
          () => {}
        );
      }
      if (__DEV__) console.log(
        "[RevenueCat] purchasePackage: result — hasEntitlement:",
        hasEntitlement
      );
      return hasEntitlement;
    } catch (error: any) {
      // Don't treat user cancellation as an error
      if (!error.userCancelled) {
        if (__DEV__) console.error("[RevenueCat] Purchase failed:", error);
        throw error;
      }
      if (__DEV__) console.log("[RevenueCat] purchasePackage: user cancelled");
      return false;
    }
  };

  const restorePurchases = async (): Promise<boolean> => {
    if (isWeb) {
      if (__DEV__) console.warn("[RevenueCat] Restore not available on web");
      return false;
    }
    if (__DEV__) console.log("[RevenueCat] restorePurchases: initiating restore");
    try {
      const customerInfo = await Purchases.restorePurchases();
      // Invalidate cache after restore
      lastFetchedAt.current = 0;
      const hasEntitlement =
        typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined";
      setIsSubscribed(hasEntitlement);
      // In __DEV__: don't clear the cache on restore failure (test store purchases are ephemeral)
      if (hasEntitlement || !__DEV__) {
        await SecureStore.setItemAsync(
          NATIVE_PURCHASE_KEY,
          hasEntitlement ? "true" : "false"
        ).catch(() => {});
      }
      if (__DEV__) console.log(
        "[RevenueCat] restorePurchases: result — hasEntitlement:",
        hasEntitlement
      );
      return hasEntitlement;
    } catch (error) {
      if (__DEV__) console.error("[RevenueCat] Restore failed:", error);
      throw error;
    }
  };

  const mockWebPurchase = () => {
    if (!isWeb) return;
    if (typeof window !== "undefined") {
      localStorage.setItem(MOCK_PURCHASE_KEY, "true");
    }
    setIsSubscribed(true);
  };

  // Dev-only: simulate a purchase in standard Expo Go for testing subscription-gated features.
  // Persists to expo-secure-store so the state survives Expo Go reloads.
  const mockNativePurchase = async (): Promise<void> => {
    if (!__DEV__ || isWeb) return;
    await SecureStore.setItemAsync(MOCK_NATIVE_KEY, "true").catch(() => {});
    setIsSubscribed(true);
  };

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed,
        offerings,
        currentOffering,
        packages,
        loading,
        isWeb,
        purchasePackage,
        restorePurchases,
        checkSubscription,
        mockWebPurchase,
        mockNativePurchase,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

/**
 * Hook to access subscription state and methods.
 *
 * @example
 * const { isSubscribed, purchasePackage, packages, isWeb } = useSubscription();
 *
 * if (!isSubscribed) {
 *   return <Button onPress={() => router.push("/paywall")}>Upgrade</Button>;
 * }
 */
export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error(
      "useSubscription must be used within SubscriptionProvider"
    );
  }
  return context;
}
