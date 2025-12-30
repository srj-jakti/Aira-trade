"use client";

import { motion } from "framer-motion";
import { BrainCircuit, Sparkles, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AnalysisPage() {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">AI Analysis</h1>
        <p className="text-white/50 text-sm">Deep learning insights and market sentiment analysis for Indian Markets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white/5 border-white/10 backdrop-blur-sm overflow-hidden relative min-h-[400px] flex flex-col items-center justify-center">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <BrainCircuit className="w-32 h-32 text-blue-500" />
          </div>
          <Sparkles className="w-12 h-12 text-white/20 mb-4" />
          <h2 className="text-xl font-semibold text-white/60">Waiting for Market Data</h2>
          <p className="text-white/40 text-sm text-center max-w-md px-4">Deep analysis will be available once market data feeds are active and connected to the AI engine.</p>
        </Card>

        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-white/10">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-white">Chat with AiRA</p>
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
