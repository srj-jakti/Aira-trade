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
    subtitle: "Analysis Only",
    price: 999,
    icon: Zap,
    color: "green",
    features: [
      { text: "Strategy Factory", included: true },
      { text: "AI Market Scanner", included: true },
      { text: "Trend Intelligence", included: true },
      { text: "Automated Execution", included: false },
    ],
    sebiLabel: "Research and analysis only.",
  },
  {
    id: "pro",
    name: "PRO",
    subtitle: "User-Automation",
    price: 1499,
    icon: Shield,
    color: "blue",
    popular: true,
    features: [
      { text: "Everything in BASIC", included: true },
      { text: "AI Automation Engine", included: true },
      { text: "Broker Connection", included: true },
      { text: "Execution Guard", included: true },
    ],
    sebiLabel: "User-defined logic automation.",
  },
  {
    id: "elite",
    name: "ELITE",
    subtitle: "Advanced Tools",
    price: 2499,
    icon: Crown,
    color: "purple",
    features: [
      { text: "Everything in PRO", included: true },
      { text: "Invite-Only Publishing", included: true },
      { text: "Auto Broker Login", included: true },
      { text: "Priority Analysis", included: true },
    ],
    sebiLabel: "Full power automation.",
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
    <div className="p-3 md:p-6 space-y-4 max-w-[1200px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.03] backdrop-blur-md p-4 md:p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-400/10 text-blue-400">
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">System Settings</h1>
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Account & Risk Controls</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 border-purple-500/20 bg-purple-500/5 text-purple-400 hover:bg-purple-500/10 text-[10px] font-black uppercase tracking-widest"
              onClick={() => router.push("/admin")}
            >
              Admin Panel
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 text-red-400/60 hover:text-red-400 hover:bg-red-400/5 text-[10px] font-black uppercase tracking-widest gap-2"
            onClick={handleLogout}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
            Sign Out
          </Button>
        </div>
      </div>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="bg-white/5 border border-white/5 p-1 h-11 w-full md:w-fit overflow-x-auto no-scrollbar justify-start">
          <TabsTrigger value="account" className="gap-2 text-[10px] font-black uppercase tracking-tighter data-[state=active]:bg-white/10">
            <User className="h-3.5 w-3.5" />
            Account
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-2 text-[10px] font-black uppercase tracking-tighter data-[state=active]:bg-white/10">
            <Key className="h-3.5 w-3.5" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="risk" className="gap-2 text-[10px] font-black uppercase tracking-tighter data-[state=active]:bg-white/10">
            <ShieldCheck className="h-3.5 w-3.5" />
            Risk
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 text-[10px] font-black uppercase tracking-tighter data-[state=active]:bg-white/10">
            <History className="h-3.5 w-3.5" />
            History
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-2 text-[10px] font-black uppercase tracking-tighter data-[state=active]:bg-white/10">
            <BarChart3 className="h-3.5 w-3.5" />
            Analysis
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="account" className="space-y-4 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
                <CardHeader className="p-4 md:p-5 border-b border-white/5">
                  <CardTitle className="text-sm font-bold text-white uppercase tracking-tight">Profile Information</CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                  <ProfileForm />
                </CardContent>
              </Card>

              <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
                <CardHeader className="p-4 md:p-5 border-b border-white/5">
                  <CardTitle className="text-sm font-bold text-white uppercase tracking-tight">Security</CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                  <PasswordForm />
                </CardContent>
              </Card>

              <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden md:col-span-2">
                <CardHeader className="p-4 md:p-5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-400" />
                    <CardTitle className="text-sm font-bold text-white uppercase tracking-tight">Subscription Plan</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6 space-y-6">
                  {loadingSubscription ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-white/20" />
                    </div>
                  ) : subscription?.status === "active" ? (
                    <div className="p-5 bg-green-400/5 border border-green-400/10 rounded-2xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          {currentPlan && (
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center shadow-lg",
                              currentPlan.color === "green" && "bg-green-400/10 text-green-400",
                              currentPlan.color === "blue" && "bg-blue-400/10 text-blue-400",
                              currentPlan.color === "purple" && "bg-purple-400/10 text-purple-400"
                            )}>
                              <currentPlan.icon className="w-6 h-6" />
                            </div>
                          )}
                          <div>
                            <p className="font-black text-white uppercase tracking-tight">{currentPlan?.name || subscription.plan_name} PLAN</p>
                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{currentPlan?.subtitle}</p>
                          </div>
                        </div>
                        <Badge className="bg-green-400 text-black border-none text-[10px] font-black h-5 px-2">ACTIVE</Badge>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                          Renewal: <span className="text-white/60">{subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <Link href="/pricing">
                          <Button variant="outline" size="sm" className="h-8 border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/5">Change Plan</Button>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 bg-yellow-400/5 border border-yellow-400/10 rounded-2xl flex items-center gap-4">
                      <Info className="w-5 h-5 text-yellow-400" />
                      <div>
                        <p className="text-xs font-black text-white uppercase tracking-tight">No Active Subscription</p>
                        <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest">Unlock premium features by choosing a plan.</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {SUBSCRIPTION_PLANS.map((plan) => (
                      <div
                        key={plan.id}
                        className={cn(
                          "relative p-5 rounded-2xl border transition-all duration-300",
                          subscription?.plan_id === plan.id
                            ? "bg-blue-400/5 border-blue-400/30 ring-1 ring-blue-400/20"
                            : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
                        )}
                      >
                        {plan.popular && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-blue-500 rounded-full text-[8px] font-black uppercase tracking-widest text-white shadow-lg">
                            Most Popular
                          </div>
                        )}
                        
                        <div className="flex items-center gap-3 mb-4">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            plan.color === "green" && "bg-green-400/10 text-green-400",
                            plan.color === "blue" && "bg-blue-400/10 text-blue-400",
                            plan.color === "purple" && "bg-purple-400/10 text-purple-400"
                          )}>
                            <plan.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-black text-white text-[11px] uppercase tracking-tight">{plan.name}</h4>
                            <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">{plan.subtitle}</p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <span className="text-2xl font-black text-white tracking-tighter">₹{plan.price}</span>
                          <span className="text-white/20 text-[10px] font-bold uppercase tracking-widest ml-1">/ mo</span>
                        </div>

                        <ul className="space-y-2 mb-6">
                          {plan.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-2">
                              {feature.included ? (
                                <Check className="w-3 h-3 text-green-400" />
                              ) : (
                                <X className="w-3 h-3 text-white/10" />
                              )}
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-tight",
                                feature.included ? "text-white/60" : "text-white/20"
                              )}>
                                {feature.text}
                              </span>
                            </li>
                          ))}
                        </ul>

                        <div className="p-2 bg-white/5 rounded-lg mb-4">
                          <p className="text-[8px] text-white/30 italic leading-tight text-center uppercase tracking-tighter font-medium">{plan.sebiLabel}</p>
                        </div>

                        {subscription?.plan_id === plan.id ? (
                          <div className="w-full text-center py-2 text-[9px] font-black text-blue-400 uppercase tracking-widest bg-blue-400/10 rounded-xl">
                            Active Plan
                          </div>
                        ) : (
                          <Link href="/pricing" className="block">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full border-white/5 bg-white/5 text-[9px] font-black uppercase tracking-widest h-9 rounded-xl hover:bg-white/10 hover:text-white"
                            >
                              {subscription?.status === "active" ? "Switch" : "Choose Plan"}
                            </Button>
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="api-keys" className="mt-0">
            <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
              <CardHeader className="p-4 md:p-5 border-b border-white/5">
                <CardTitle className="text-sm font-bold text-white uppercase tracking-tight">Broker Connectivity</CardTitle>
                <CardDescription className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Link your trading account for automated insights</CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <ApiKeysForm />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risk" className="mt-0">
            <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
              <CardHeader className="p-4 md:p-5 border-b border-white/5">
                <CardTitle className="text-sm font-bold text-white uppercase tracking-tight">Risk Parameters</CardTitle>
                <CardDescription className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Global guardrails for analysis and automation</CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <RiskSettingsForm />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
              <CardHeader className="p-4 md:p-5 border-b border-white/5">
                <CardTitle className="text-sm font-bold text-white uppercase tracking-tight">Automation Log</CardTitle>
                <CardDescription className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Historical record of all system-guided actions</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <TradingHistory />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="mt-0">
            <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
              <CardHeader className="p-4 md:p-5 border-b border-white/5">
                <CardTitle className="text-sm font-bold text-white uppercase tracking-tight">Performance Intelligence</CardTitle>
                <CardDescription className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Deep dive into AI-guided strategy performance</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <AIAnalysisReports />
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
