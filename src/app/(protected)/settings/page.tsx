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
import { ScannerSettingsForm } from "./ScannerSettingsForm";
import { TradingHistory } from "./TradingHistory";
import { AIAnalysisReports } from "./AIAnalysisReports";

const SUBSCRIPTION_PLANS = [
  {
    id: "basic",
    name: "BASIC",
    subtitle: "Platform Access",
    price: 999,
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
    price: 2499,
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
    <div className="flex flex-col h-full bg-[#030303]">
      <div className="flex-1 p-4 md:p-8 pt-6 space-y-6 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
              <p className="text-white/50 text-sm">Manage your account, API keys, and risk preferences.</p>
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
              <TabsList className="flex h-12 items-center justify-between gap-1 rounded-xl border border-white/10 bg-white/5 p-1 w-full overflow-hidden">
                <TabsTrigger 
                  value="account" 
                  className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-[10px] sm:text-xs md:text-sm flex-1"
                >
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>Account</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="api-keys" 
                  className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-[10px] sm:text-xs md:text-sm flex-1"
                >
                  <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="hidden xs:inline">APIs</span>
                  <span className="xs:hidden">APIs</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="risk" 
                  className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-[10px] sm:text-xs md:text-sm flex-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>Risk</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="history" 
                  className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-[10px] sm:text-xs md:text-sm flex-1"
                >
                  <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>History</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="analysis" 
                  className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-[10px] sm:text-xs md:text-sm flex-1"
                >
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>AI</span>
                </TabsTrigger>
              </TabsList>
            </div>

          <div className="mt-6">
            <TabsContent value="account" className="space-y-6 mt-0">
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Profile Information</CardTitle>
                    <CardDescription className="text-white/40">Update your personal details.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ProfileForm />
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Change Password</CardTitle>
                    <CardDescription className="text-white/40">Ensure your account is using a long, random password.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PasswordForm />
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 md:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-white text-lg flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-blue-400" />
                        Plan Details
                      </CardTitle>
                      <CardDescription className="text-white/40">Manage your subscription and billing.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {loadingSubscription ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-white/30" />
                        </div>
                      ) : subscription?.status === "active" ? (
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {currentPlan && (
                                <div className={cn(
                                  "w-10 h-10 rounded-lg flex items-center justify-center",
                                  currentPlan.color === "green" && "bg-green-500/20",
                                  currentPlan.color === "blue" && "bg-blue-500/20",
                                  currentPlan.color === "purple" && "bg-purple-500/20"
                                )}>
                                  <currentPlan.icon className={cn(
                                    "w-5 h-5",
                                    currentPlan.color === "green" && "text-green-400",
                                    currentPlan.color === "blue" && "text-blue-400",
                                    currentPlan.color === "purple" && "text-purple-400"
                                  )} />
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-white">{currentPlan?.name || subscription.plan_name} Plan</p>
                                <p className="text-xs text-white/50">{currentPlan?.subtitle}</p>
                              </div>
                            </div>
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                          </div>
                          <div className="mt-4 pt-4 border-t border-green-500/20 flex items-center justify-between">
                            <div className="text-sm text-white/60">
                              <span>Next billing: </span>
                              <span className="text-white">
                                {subscription.current_period_end 
                                  ? new Date(subscription.current_period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                                  : "N/A"
                                }
                              </span>
                            </div>
                            <Link href="/pricing">
                              <Button variant="outline" size="sm" className="border-white/10 text-white hover:bg-white/5">
                                Change Plan
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                          <div className="flex items-center gap-3">
                            <Info className="w-5 h-5 text-amber-400" />
                            <div>
                              <p className="font-medium text-amber-400">No Active Subscription</p>
                              <p className="text-xs text-amber-300/60">Subscribe to unlock all platform features</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div>
                        <h3 className="text-sm font-medium text-white/70 mb-4">Available Plans</h3>
                        <div className="grid md:grid-cols-3 gap-4">
                          {SUBSCRIPTION_PLANS.map((plan) => (
                            <div
                              key={plan.id}
                              className={cn(
                                "relative p-4 rounded-xl border transition-all",
                                subscription?.plan_id === plan.id
                                  ? "bg-blue-500/10 border-blue-500/30"
                                  : "bg-white/5 border-white/10 hover:border-white/20"
                              )}
                            >
                              {plan.popular && (
                                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-500 text-white border-none text-xs">
                                  Popular
                                </Badge>
                              )}
                              
                              <div className="flex items-center gap-2 mb-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center",
                                  plan.color === "green" && "bg-green-500/20",
                                  plan.color === "blue" && "bg-blue-500/20",
                                  plan.color === "purple" && "bg-purple-500/20"
                                )}>
                                  <plan.icon className={cn(
                                    "w-4 h-4",
                                    plan.color === "green" && "text-green-400",
                                    plan.color === "blue" && "text-blue-400",
                                    plan.color === "purple" && "text-purple-400"
                                  )} />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-white text-sm">{plan.name}</h4>
                                  <p className="text-xs text-white/40">{plan.subtitle}</p>
                                </div>
                              </div>

                              <div className="mb-3">
                                <span className="text-2xl font-bold text-white">₹{plan.price.toLocaleString("en-IN")}</span>
                                <span className="text-white/50 text-sm">/month</span>
                              </div>

                              <div className="space-y-2 mb-4">
                                {plan.features.slice(0, 4).map((feature, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    {feature.included ? (
                                      <Check className="w-3 h-3 text-green-400" />
                                    ) : (
                                      <X className="w-3 h-3 text-white/20" />
                                    )}
                                    <span className={cn(
                                      "text-xs",
                                      feature.included ? "text-white/70" : "text-white/30"
                                    )}>
                                      {feature.text}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <div className="p-2 bg-white/5 rounded-lg mb-3">
                                <p className="text-[10px] text-white/40 italic">{plan.sebiLabel}</p>
                              </div>

                              {subscription?.plan_id === plan.id ? (
                                <Badge className="w-full justify-center bg-blue-500/20 text-blue-400 border-blue-500/30">
                                  Current Plan
                                </Badge>
                              ) : (
                                <Link href="/pricing" className="block">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full border-white/10 text-white hover:bg-white/5"
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

                      <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                        <p className="text-[10px] text-white/40 text-center">
                          AiRA is a software platform providing analytical and automation tools only. 
                          It does not provide investment advice or trading recommendations.{" "}
                          <Link href="/legal/terms" className="text-blue-400 hover:underline">Terms</Link> ·{" "}
                          <Link href="/legal/risk-disclosure" className="text-blue-400 hover:underline">Risk Disclosure</Link>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
              </div>
            </TabsContent>

            <TabsContent value="api-keys" className="mt-0">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Broker API Keys</CardTitle>
                  <CardDescription className="text-white/40">Connect your Zerodha account to enable execution automation.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ApiKeysForm />
                </CardContent>
              </Card>
            </TabsContent>

              <TabsContent value="risk" className="mt-0">
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Risk Settings</CardTitle>
                    <CardDescription className="text-white/40">Configure your trading limits and allowed segments.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RiskSettingsForm />
                  </CardContent>
                </Card>
              </TabsContent>


            <TabsContent value="history" className="mt-0">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Trading History</CardTitle>
                  <CardDescription className="text-white/40">Review your past actions executed via automation.</CardDescription>
                </CardHeader>
                <CardContent>
                  <TradingHistory />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analysis" className="mt-0">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-lg">AI Performance Reports</CardTitle>
                  <CardDescription className="text-white/40">Deep dive into your trading performance and AI improvements.</CardDescription>
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
