"use client";

import { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSubscription, SubscriptionPlan } from "@/hooks/useSubscription";
import Link from "next/link";

interface FeatureGateProps {
  feature: keyof SubscriptionPlan["features"];
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

const FEATURE_REQUIREMENTS: Record<string, { plan: string; description: string }> = {
  strategyCreation: { plan: "BASIC", description: "Create and test trading strategies" },
  strategyLibrary: { plan: "BASIC", description: "Access strategy library" },
  aiAnalysis: { plan: "BASIC", description: "AI-powered market analysis" },
  marketScanner: { plan: "BASIC", description: "Market scanner tool" },
  automatedExecution: { plan: "PRO", description: "Automated trade execution" },
  brokerConnection: { plan: "PRO", description: "Connect your broker account" },
  inviteOnlyStrategies: { plan: "ELITE", description: "Create invite-only strategies" },
  backgroundAutomation: { plan: "ELITE", description: "Background automation" },
  autoBrokerLogin: { plan: "ELITE", description: "Auto broker login" },
};

export function FeatureGate({ 
  feature, 
  children, 
  fallback,
  showUpgradePrompt = true 
}: FeatureGateProps) {
  const { hasFeature, loading, isSubscribed, getPlanName } = useSubscription();

  if (loading) {
    return <div className="animate-pulse bg-muted/50 rounded-lg h-32" />;
  }

  const hasAccess = hasFeature(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  const requirement = FEATURE_REQUIREMENTS[feature];

  return (
    <Card className="bg-muted/50 border-yellow-500/20">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-yellow-400" />
        </div>
        <h3 className="text-foreground text-lg font-semibold mb-2">
          {requirement?.plan || "PRO"} Plan Required
        </h3>
        <p className="text-muted-foreground text-sm mb-4 max-w-md">
          {requirement?.description || "This feature"} requires a {requirement?.plan || "PRO"} subscription or higher.
          {isSubscribed() && getPlanName() && (
            <span className="block mt-2">
              Your current plan: <span className="text-foreground font-medium">{getPlanName()}</span>
            </span>
          )}
        </p>
        <Link href="/pricing">
          <Button className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600">
            Upgrade Now
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function useFeatureAccess() {
  const { hasFeature, isSubscribed, getPlanName, subscription, loading } = useSubscription();
  
  return {
    loading,
    isSubscribed: isSubscribed(),
    planName: getPlanName(),
    subscription,
    canCreateStrategies: hasFeature("strategyCreation"),
    canUseScanner: hasFeature("marketScanner"),
    canUseAIAnalysis: hasFeature("aiAnalysis"),
    canAccessAutomation: hasFeature("automatedExecution"),
    canConnectBroker: hasFeature("brokerConnection"),
    canCreateInviteOnlyStrategies: hasFeature("inviteOnlyStrategies"),
    canUseBackgroundAutomation: hasFeature("backgroundAutomation"),
    canUseAutoLogin: hasFeature("autoBrokerLogin"),
  };
}
