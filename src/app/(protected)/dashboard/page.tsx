"use client";

import { motion } from "framer-motion";
import { 
  TrendingUp, 
  Zap,
  RefreshCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Intelligence Dashboard</h1>
          <p className="text-white/50 text-sm">Real-time AI trading monitoring & execution for Indian Markets.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10 text-white">
            <RefreshCcw className="w-4 h-4 mr-2" />
            Sync Data
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white border-none">
            <Zap className="w-4 h-4 mr-2 fill-current" />
            AI Mode: Active
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
          <TrendingUp className="w-12 h-12 text-white/20 mb-4" />
          <h2 className="text-xl font-semibold text-white/60">No Active Data</h2>
          <p className="text-white/40 text-sm">Connect your broker to start monitoring Indian market assets.</p>
        </div>
      </div>
    </div>
  );
}
