"use client";

import { useState } from "react";
import { 
  Activity, 
  Bot, 
  Lock, 
  Globe, 
  UserCheck,
  Zap,
  Info
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function StrategyPage() {
  return (
    <div className="flex flex-col h-full bg-[#030303]">
      <div className="flex-1 p-4 md:p-8 pt-6 space-y-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Strategies</h1>
            <p className="text-white/50 text-sm">Manage, create and discover trading strategies.</p>
          </div>
        </div>

        <Tabs defaultValue="active" className="space-y-6">
          <div className="relative">
            <TabsList className="flex h-11 items-center justify-start gap-1 rounded-xl border border-white/10 bg-white/5 p-1 overflow-x-auto no-scrollbar w-full md:w-max">
              <TabsTrigger 
                value="active" 
                className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-xs md:text-sm whitespace-nowrap"
              >
                <Activity className="w-4 h-4 shrink-0" />
                <span>Active</span>
              </TabsTrigger>
              <TabsTrigger 
                value="create" 
                className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-xs md:text-sm whitespace-nowrap"
              >
                <Bot className="w-4 h-4 shrink-0" />
                <span>Create AI</span>
              </TabsTrigger>
              <TabsTrigger 
                value="private" 
                className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-xs md:text-sm whitespace-nowrap"
              >
                <Lock className="w-4 h-4 shrink-0" />
                <span>Private</span>
              </TabsTrigger>
              <TabsTrigger 
                value="public" 
                className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-xs md:text-sm whitespace-nowrap"
              >
                <Globe className="w-4 h-4 shrink-0" />
                <span>Public</span>
              </TabsTrigger>
              <TabsTrigger 
                value="invite-only" 
                className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-xs md:text-sm whitespace-nowrap"
              >
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>Invite Only</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="mt-6">
            <TabsContent value="active" className="space-y-6 mt-0">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Active Strategies</CardTitle>
                  <CardDescription className="text-white/40">Strategies currently running and allowed for AI auto-trading.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-white/5 rounded-xl">
                  <Activity className="w-12 h-12 text-white/10 mb-4" />
                  <p className="text-white/40">No active strategies found</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="create" className="space-y-6 mt-0">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Create with AI</CardTitle>
                  <CardDescription className="text-white/40">Use our AI assistant to build custom trading strategies.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-white/5 rounded-xl">
                  <Bot className="w-12 h-12 text-white/10 mb-4" />
                  <p className="text-white/40">AI strategy builder interface coming soon</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="private" className="space-y-6 mt-0">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Private Strategies</CardTitle>
                  <CardDescription className="text-white/40">Your personal strategies saved to your account.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-white/5 rounded-xl">
                  <Lock className="w-12 h-12 text-white/10 mb-4" />
                  <p className="text-white/40">No private strategies saved</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="public" className="space-y-6 mt-0">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Public Marketplace</CardTitle>
                  <CardDescription className="text-white/40">Discover strategies shared by the community and approved by admins.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-white/5 rounded-xl">
                  <Globe className="w-12 h-12 text-white/10 mb-4" />
                  <p className="text-white/40">Public strategies will appear here</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invite-only" className="space-y-6 mt-0">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Invite Only</CardTitle>
                  <CardDescription className="text-white/40">Exclusive strategies accessible only through invitation or admin approval.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-white/5 rounded-xl">
                  <UserCheck className="w-12 h-12 text-white/10 mb-4" />
                  <p className="text-white/40">Check your invitations here</p>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
