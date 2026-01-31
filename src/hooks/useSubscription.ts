"use client";

import { useState, useEffect, useCallback } from "react";

export interface SubscriptionPlan {
  id: string;
  name: string;
  subtitle: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: {
    strategyCreation: boolean;
    strategyLibrary: boolean;
    aiAnalysis: boolean;
    marketScanner: boolean;
    automatedExecution: boolean;
    brokerConnection: boolean;
    inviteOnlyStrategies: boolean;
    backgroundAutomation: boolean;
    autoBrokerLogin: boolean;
  };
  sebiLabel: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  plan_name: string;
  status: string;
  billing_period: string;
  amount: number;
  currency: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Record<string, SubscriptionPlan>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/subscription");
      const data = await response.json();

      if (data.success) {
        setSubscription(data.subscription);
        setPlans(data.plans);
      } else {
        setError(data.error);
      }
    } catch (_err) {
      setError("Failed to fetch subscription");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const hasFeature = useCallback((feature: keyof SubscriptionPlan["features"]) => {
    if (!subscription || subscription.status !== "active") {
      return false;
    }

    const plan = plans[subscription.plan_id];
    if (!plan) {
      return false;
    }

    return plan.features[feature];
  }, [subscription, plans]);

  const isSubscribed = useCallback(() => {
    return subscription?.status === "active";
  }, [subscription]);

  const getPlanName = useCallback(() => {
    if (!subscription) return null;
    return plans[subscription.plan_id]?.name || subscription.plan_name;
  }, [subscription, plans]);

  const canAccessAutomation = useCallback(() => {
    return hasFeature("automatedExecution");
  }, [hasFeature]);

  const canAccessBrokerConnection = useCallback(() => {
    return hasFeature("brokerConnection");
  }, [hasFeature]);

  const canPublishInviteStrategies = useCallback(() => {
    return hasFeature("inviteOnlyStrategies");
  }, [hasFeature]);

  const canUseAutoLogin = useCallback(() => {
    return hasFeature("autoBrokerLogin");
  }, [hasFeature]);

  return {
    subscription,
    plans,
    loading,
    error,
    hasFeature,
    isSubscribed,
    getPlanName,
    canAccessAutomation,
    canAccessBrokerConnection,
    canPublishInviteStrategies,
    canUseAutoLogin,
    refresh: fetchSubscription,
  };
}
