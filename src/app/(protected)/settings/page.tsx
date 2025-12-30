"use client";

import { useState } from "react";
import { 
  User, 
  Key, 
  ShieldCheck, 
  History, 
  BarChart3,
  LogOut,
  Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Section Components
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";
import { ApiKeysForm } from "./ApiKeysForm";
import { RiskSettingsForm } from "./RiskSettingsForm";
import { TradingHistory } from "./TradingHistory";
import { AIAnalysisReports } from "./AIAnalysisReports";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex flex-col h-full bg-[#030303]">
      <div className="flex-1 p-4 md:p-8 pt-6 space-y-6 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
            <p className="text-white/50 text-sm">Manage your account, API keys, and risk preferences.</p>
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
          <div className="relative">
            <TabsList className="w-full justify-start h-auto p-1 bg-white/5 border border-white/10 overflow-x-auto no-scrollbar flex-nowrap shrink-0 rounded-xl">
              <TabsTrigger 
                value="account" 
                className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all"
              >
                <User className="w-4 h-4" />
                <span className="whitespace-nowrap">Account</span>
              </TabsTrigger>
              <TabsTrigger 
                value="api-keys" 
                className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all"
              >
                <Key className="w-4 h-4" />
                <span className="whitespace-nowrap">API Keys</span>
              </TabsTrigger>
              <TabsTrigger 
                value="risk" 
                className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all"
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="whitespace-nowrap">Risk Management</span>
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all"
              >
                <History className="w-4 h-4" />
                <span className="whitespace-nowrap">Trading History</span>
              </TabsTrigger>
              <TabsTrigger 
                value="analysis" 
                className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="whitespace-nowrap">AI Analysis</span>
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
                    <CardTitle className="text-white text-lg">Plan Details</CardTitle>
                    <CardDescription className="text-white/40">Manage your subscription and billing.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white">Current Plan: <span className="text-blue-400">Pro Trader</span></p>
                      <p className="text-xs text-white/40">Next billing date: Jan 30, 2026</p>
                    </div>
                    <Button variant="outline" className="border-white/10 text-white hover:bg-white/5">
                      Manage Subscription
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="api-keys" className="mt-0">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Broker API Keys</CardTitle>
                  <CardDescription className="text-white/40">Connect your Zerodha account to enable AI trading.</CardDescription>
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
                  <CardDescription className="text-white/40">Review your past trades executed by the AI.</CardDescription>
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
