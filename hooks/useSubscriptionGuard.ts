import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { isOnboardingComplete } from "@/utils/onboardingStorage";

export function useSubscriptionGuard() {
  const { isSubscribed, loading } = useSubscription();
  const { user } = useAuth();
  const router = useRouter();
  // Check onboarding once on mount — not on every navigation event
  const onboardingDone = useRef<boolean | null>(null);
  const checkedOnce = useRef(false);

  useEffect(() => {
    if (checkedOnce.current) return;
    checkedOnce.current = true;
    isOnboardingComplete()
      .then((done) => {
        onboardingDone.current = done;
      })
      .catch(() => {
        onboardingDone.current = true;
      });
  }, []);

  useEffect(() => {
    if (loading) return;
    if (onboardingDone.current === null || !onboardingDone.current) return;
    if (!user) return;
    if (!isSubscribed) {
      console.log("[SubscriptionGuard] User not subscribed — redirecting to paywall");
      router.replace("/paywall");
    }
  }, [isSubscribed, loading, user, router]);
}
