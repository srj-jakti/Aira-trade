"use client";

import { motion } from "framer-motion";
import { BrainCircuit, TrendingUp, BarChart3, Globe, MessageSquare, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const analysisData = [
  { pair: "BTC/USDT", sentiment: 85, signal: "Strong Buy", logic: "Bullish divergence on 4H RSI + Whale accumulation detected." },
  { pair: "ETH/USDT", sentiment: 62, signal: "Buy", logic: "Consolidation above support. EIP upgrade hype building." },
  { pair: "SOL/USDT", sentiment: 45, signal: "Neutral", logic: "Network congestion concerns offsetting ecosystem growth." },
];

export default function AnalysisPage() {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Analysis</h1>
        <p className="text-white/50 text-sm">Deep learning insights and market sentiment analysis.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Sentiment Card */}
        <Card className="lg:col-span-2 bg-white/5 border-white/10 backdrop-blur-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <BrainCircuit className="w-32 h-32 text-blue-500" />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400" />
              Market Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <p className="text-xs text-white/40 uppercase font-bold">Global Sentiment</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold">78%</span>
                  <Badge className="bg-green-500/20 text-green-400 border-none mb-1">Greed</Badge>
                </div>
                <Progress value={78} className="h-2 bg-white/5" />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-white/40 uppercase font-bold">Volatility Index</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold">Low</span>
                  <Badge className="bg-blue-500/20 text-blue-400 border-none mb-1">Stable</Badge>
                </div>
                <Progress value={20} className="h-2 bg-white/5" />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-white/40 uppercase font-bold">AI Confidence</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold">92%</span>
                </div>
                <Progress value={92} className="h-2 bg-white/5" />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-lg border-b border-white/10 pb-2">AI Reasoning Logs</h3>
              <div className="space-y-4">
                {analysisData.map((item) => (
                  <div key={item.pair} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.08] transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold">{item.pair}</span>
                      <Badge className={item.signal.includes('Buy') ? 'bg-green-500 text-white' : 'bg-yellow-500 text-black'}>
                        {item.signal}
                      </Badge>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed">{item.logic}</p>
                    <div className="mt-4 flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-white/40">Sentiment Score</span>
                          <span className="font-mono">{item.sentiment}%</span>
                        </div>
                        <Progress value={item.sentiment} className="h-1 bg-white/5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar Cards */}
        <div className="space-y-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                Social Sentiment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/60">Twitter/X activity</span>
                <span className="text-xs font-bold text-green-400">+12%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/60">Reddit mentions</span>
                <span className="text-xs font-bold text-red-400">-4%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/60">News sentiment</span>
                <span className="text-xs font-bold text-green-400">Positive</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-white/10">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div className="space-y-1">
                <p className="font-bold">Chat with AiRA</p>
                <p className="text-xs text-white/50">Get personalized market analysis via chat.</p>
              </div>
              <button className="w-full py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-white/90 transition-colors">
                Launch Assistant
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}