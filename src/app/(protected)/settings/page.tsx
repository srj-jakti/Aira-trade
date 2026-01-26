"use client";

import { useState, useEffect } from "react";
import { 
  User, 
  Key, 
  ShieldCheck, 
  History, 
  BarChart3,
  LogOut,
  Loader2,
  Settings2,
  CreditCard,
  Zap,
  Shield,
  Crown,
  Check,
  X,
  ArrowRight,
  Info
} from "lucide-react";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";
import { ApiKeysForm } from "./ApiKeysForm";
import { RiskSettingsForm } from "./RiskSettingsForm";
import { TradingHistory } from "./TradingHistory";
import { AIAnalysisReports } from "./AIAnalysisReports";

const SUBSCRIPTION_PLANS = [
  {
    id: "basic",
    name: "BASIC",
    subtitle: "Platform Access",
    price: 599,
    icon: Zap,
    color: "green",
    features: [
      { text: "Strategy Creation Module", included: true },
      { text: "Strategy Library Access", included: true },
      { text: "AI Analysis Page", included: true },
      { text: "Market Scanner", included: true },
      { text: "Automated Execution", included: false },
      { text: "Broker Connection", included: false },
    ],
    sebiLabel: "For research, analysis, and strategy development only.",
  },
  {
    id: "pro",
    name: "PRO",
    subtitle: "User-Controlled Automation",
    price: 1499,
    icon: Shield,
    color: "blue",
    popular: true,
    features: [
      { text: "Everything in BASIC", included: true },
      { text: "AI Automation Engine", included: true },
      { text: "Manual Broker Login", included: true },
      { text: "Strategy-based Execution", included: true },
      { text: "Invite-Only Strategies", included: false },
      { text: "Auto Broker Login", included: false },
    ],
    sebiLabel: "Execution automation based on user-defined logic.",
  },
  {
    id: "elite",
    name: "ELITE",
    subtitle: "Advanced Automation",
    price: 3499,
    icon: Crown,
    color: "purple",
    features: [
      { text: "Everything in PRO", included: true },
      { text: "Invite-Only Strategy Publishing", included: true },
      { text: "Auto Broker Login (Optional)", included: true },
      { text: "Continuous Automation", included: true },
      { text: "Advanced Controls", included: true },
      { text: "Priority Support", included: true },
    ],
    sebiLabel: "Advanced execution automation. User retains full control.",
  },
  {
    id: "admin",
    name: "ADMIN",
    subtitle: "Full Access",
    price: 0,
    icon: Crown,
    color: "red",
    features: [
      { text: "All ELITE Features", included: true },
      { text: "Admin Panel Access", included: true },
      { text: "User Management", included: true },
      { text: "System Configuration", included: true },
      { text: "Full Platform Control", included: true },
      { text: "Priority Support", included: true },
    ],
    sebiLabel: "Admin access with all features enabled.",
  },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkAdmin() {
      try {
        const res = await fetch("/api/admin/check");
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.isAdmin);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
      }
    }
    checkAdmin();
  }, []);

  useEffect(() => {
    async function fetchSubscription() {
      try {
        const res = await fetch("/api/subscription");
        if (res.ok) {
          const data = await res.json();
          setSubscription(data.subscription);
        }
      } catch (error) {
        console.error("Error fetching subscription:", error);
      } finally {
        setLoadingSubscription(false);
      }
    }
    fetchSubscription();
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const currentPlan = subscription?.plan_id 
    ? SUBSCRIPTION_PLANS.find(p => p.id === subscription.plan_id) 
    : null;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-4 md:p-8 pt-6 space-y-6 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
                <p className="text-muted-foreground text-sm">Manage your account, API keys, and risk preferences.</p>
              </div>
            {isAdmin && (
              <Button 
                variant="outline" 
                size="sm" 
                className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
                onClick={() => router.push("/admin")}
              >
                <Settings2 className="w-4 h-4 mr-2" />
                Admin Panel
              </Button>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-400 hover:text-red-300 hover:bg-red-400/10 hidden md:flex"
            onClick={handleLogout}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
            Sign Out
          </Button>
        </div>

            <Tabs defaultValue="account" className="space-y-6">
              <div className="px-0">
                  <TabsList className="flex h-auto sm:h-12 items-center justify-between gap-0.5 rounded-xl border border-border bg-muted/50 p-1 w-full overflow-x-auto scrollbar-hide">
                    <TabsTrigger 
                      value="account" 
                      className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                    >
                      <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="truncate w-full text-center sm:text-left">Account</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="api-keys" 
                      className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                    >
                      <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="truncate w-full text-center sm:text-left">APIs</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="risk" 
                      className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="truncate w-full text-center sm:text-left">Risk</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="history" 
                      className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                    >
                      <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="truncate w-full text-center sm:text-left">History</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="analysis" 
                      className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                    >
                      <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="truncate w-full text-center sm:text-left">AI</span>
                    </TabsTrigger>
                  </TabsList>
              </div>

            <div className="mt-6">
              <TabsContent value="account" className="space-y-6 mt-0">
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground text-lg">Profile Information</CardTitle>
                      <CardDescription className="text-muted-foreground">Update your personal details.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ProfileForm />
                    </CardContent>
                  </Card>
  
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground text-lg">Change Password</CardTitle>
                      <CardDescription className="text-muted-foreground">Ensure your account is using a long, random password.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PasswordForm />
                    </CardContent>
                  </Card>
  
                  <Card className="bg-card border-border md:col-span-2">
                      <CardHeader>
                        <CardTitle className="text-foreground text-lg flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-blue-400" />
                          Plan Details
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">Manage your subscription and billing.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                      {loadingSubscription ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/30" />
                            </div>
                          ) : subscription?.status === "active" ? (
                            <div className={cn(
                              "p-4 border rounded-xl",
                              subscription.is_admin_grant 
                                ? "bg-purple-500/10 border-purple-500/20" 
                                : "bg-green-500/10 border-green-500/20"
                            )}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {currentPlan && (
                                    <div className={cn(
                                      "w-10 h-10 rounded-lg flex items-center justify-center",
                                      currentPlan.color === "green" && "bg-green-500/20",
                                      currentPlan.color === "blue" && "bg-blue-500/20",
                                      currentPlan.color === "purple" && "bg-purple-500/20",
                                      currentPlan.color === "red" && "bg-red-500/20"
                                    )}>
                                      <currentPlan.icon className={cn(
                                        "w-5 h-5",
                                        currentPlan.color === "green" && "text-green-500",
                                        currentPlan.color === "blue" && "text-blue-500",
                                        currentPlan.color === "purple" && "text-purple-500",
                                        currentPlan.color === "red" && "text-red-500"
                                      )} />
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-semibold text-foreground">{currentPlan?.name || subscription.plan_name} Plan</p>
                                    <p className="text-xs text-muted-foreground">{currentPlan?.subtitle}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {subscription.is_admin_grant && (
                                    <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30">Admin Granted</Badge>
                                  )}
                                  <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Active</Badge>
                                </div>
                              </div>
                              <div className={cn(
                                "mt-4 pt-4 border-t flex items-center justify-between",
                                subscription.is_admin_grant ? "border-purple-500/20" : "border-green-500/20"
                              )}>
                                <div className="text-sm text-muted-foreground">
                                  {subscription.current_period_end ? (
                                    <>
                                      <span>{subscription.is_admin_grant ? "Expires: " : "Next billing: "}</span>
                                      <span className="text-foreground font-medium">
                                        {new Date(subscription.current_period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-green-600 font-medium">Lifetime Access</span>
                                  )}
                                </div>
                                {!subscription.is_admin_grant && (
                                  <Link href="/pricing">
                                    <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-muted">
                                      Change Plan
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </div>
                          ) : (
                          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                            <div className="flex items-center gap-3">
                              <Info className="w-5 h-5 text-amber-500" />
                              <div>
                                <p className="font-medium text-amber-600">No Active Subscription</p>
                                <p className="text-xs text-amber-600/60">Subscribe to unlock all platform features</p>
                              </div>
                            </div>
                          </div>
                        )}
  
                          <div>
                            <h3 className="text-sm font-medium text-muted-foreground mb-4">Available Plans</h3>
                            <div className="grid md:grid-cols-3 gap-4">
                              {SUBSCRIPTION_PLANS.filter(p => p.id !== "admin").map((plan) => (
                              <div
                                key={plan.id}
                                className={cn(
                                  "relative p-4 rounded-xl border transition-all",
                                  subscription?.plan_id === plan.id
                                    ? "bg-blue-500/5 border-blue-500/30 shadow-sm"
                                    : "bg-card border-border hover:border-border/80"
                                )}
                              >
                                {plan.popular && (
                                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white border-none text-xs">
                                    Popular
                                  </Badge>
                                )}
                                
                                <div className="flex items-center gap-2 mb-3">
                                  <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center",
                                    plan.color === "green" && "bg-green-500/10",
                                    plan.color === "blue" && "bg-blue-500/10",
                                    plan.color === "purple" && "bg-purple-500/10"
                                  )}>
                                    <plan.icon className={cn(
                                      "w-4 h-4",
                                      plan.color === "green" && "text-green-600",
                                      plan.color === "blue" && "text-blue-600",
                                      plan.color === "purple" && "text-purple-600"
                                    )} />
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-foreground text-sm">{plan.name}</h4>
                                    <p className="text-xs text-muted-foreground">{plan.subtitle}</p>
                                  </div>
                                </div>
  
                                <div className="mb-3">
                                  <span className="text-2xl font-bold text-foreground">₹{plan.price.toLocaleString("en-IN")}</span>
                                  <span className="text-muted-foreground text-sm">/month</span>
                                </div>
  
                                <div className="space-y-2 mb-4">
                                  {plan.features.slice(0, 4).map((feature, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                      {feature.included ? (
                                        <Check className="w-3 h-3 text-green-600" />
                                      ) : (
                                        <X className="w-3 h-3 text-muted-foreground/30" />
                                      )}
                                      <span className={cn(
                                        "text-xs",
                                        feature.included ? "text-foreground/80" : "text-muted-foreground/40"
                                      )}>
                                        {feature.text}
                                      </span>
                                    </div>
                                  ))}
                                </div>
  
                                <div className="p-2 bg-muted rounded-lg mb-3">
                                  <p className="text-[10px] text-muted-foreground italic">{plan.sebiLabel}</p>
                                </div>
  
                                {subscription?.plan_id === plan.id ? (
                                  <Badge className="w-full justify-center bg-blue-500/10 text-blue-600 border-blue-500/20">
                                    Current Plan
                                  </Badge>
                                ) : (
                                  <Link href="/pricing" className="block">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="w-full border-border text-foreground hover:bg-muted"
                                    >
                                      {subscription?.status === "active" ? "Switch" : "Subscribe"}
                                      <ArrowRight className="w-3 h-3 ml-1" />
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
  
                        <div className="p-3 bg-muted border border-border rounded-lg">
                          <p className="text-[10px] text-muted-foreground text-center">
                            AiRA is a software platform providing analytical and automation tools only. 
                            It does not provide investment advice or trading recommendations.{" "}
                            <Link href="/legal/terms" className="text-blue-500 hover:underline">Terms</Link> ·{" "}
                            <Link href="/legal/risk-disclosure" className="text-blue-500 hover:underline">Risk Disclosure</Link>
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                </div>
              </TabsContent>
  
              <TabsContent value="api-keys" className="mt-0">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground text-lg">Broker API Keys</CardTitle>
                    <CardDescription className="text-muted-foreground">Connect your Zerodha account to enable execution automation.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ApiKeysForm />
                  </CardContent>
                </Card>
              </TabsContent>
  
                <TabsContent value="risk" className="mt-0">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground text-lg">Risk Settings</CardTitle>
                      <CardDescription className="text-muted-foreground">Configure your trading limits and allowed segments.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <RiskSettingsForm />
                    </CardContent>
                  </Card>
                </TabsContent>
  
  
              <TabsContent value="history" className="mt-0">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground text-lg">Trading History</CardTitle>
                    <CardDescription className="text-muted-foreground">Review your past actions executed via automation.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TradingHistory />
                  </CardContent>
                </Card>
              </TabsContent>
  
              <TabsContent value="analysis" className="mt-0">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground text-lg">AI Performance Reports</CardTitle>
                    <CardDescription className="text-muted-foreground">Deep dive into your trading performance and AI improvements.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AIAnalysisReports />
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
        </Tabs>

        {/* Mobile Sign Out */}
        <div className="pt-8 pb-4 md:hidden">
          <Button 
            variant="ghost" 
            className="w-full text-red-400 hover:text-red-300 hover:bg-red-400/10 justify-start"
            onClick={handleLogout}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
            Sign Out from Account
          </Button>
        </div>
      </div>
    </div>
  );
}
