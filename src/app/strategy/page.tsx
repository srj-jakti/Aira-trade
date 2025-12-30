"use client";

import { motion } from "framer-motion";
import { Zap, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StrategyPage() {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">AI Strategies</h1>
          <p className="text-white/50 text-sm">Deploy and manage your automated trading bots for Indian Markets.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white border-none">
          <Plus className="w-4 h-4 mr-2" />
          Create Strategy
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-white/10 rounded-2xl bg-white/[0.02] p-8">
          <Zap className="w-12 h-12 text-white/20 mb-4" />
          <h2 className="text-xl font-semibold text-white/60">No Strategies Found</h2>
          <p className="text-white/40 text-sm text-center max-w-md">You haven't created any AI strategies yet. Click 'Create Strategy' to build your first automated trading bot.</p>
        </div>
      </div>

      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-red-500">Risk Warning</p>
          <p className="text-xs text-red-500/80">Trading involves significant risk. Ensure you have properly backtested all strategies before deploying them with live capital in Indian markets (NSE/BSE).</p>
        </div>
      </div>
    </div>
  );
}
