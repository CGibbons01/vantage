import { useEffect, useState } from "react";
import { useRouter, usePathname } from "expo-router";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { isOnboardingComplete } from "@/utils/onboardingStorage";

export function useSubscriptionGuard() {
  const { isSubscribed, loading } = useSubscription();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    isOnboardingComplete()
      .then(setOnboardingDone)
      .catch(() => setOnboardingDone(true));
  }, [pathname]);

  useEffect(() => {
    if (loading || onboardingDone === null || !onboardingDone) return;
    if (!user) return;
    if (!isSubscribed) {
      router.replace("/paywall");
    }
  }, [isSubscribed, loading, onboardingDone, user, router]);
}
