"use client";

import { motion } from "framer-motion";
import { 
  Zap,
  AlertCircle,
  Clock,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function StrategyPage() {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Trading Strategies</h1>
          <p className="text-white/50 text-sm">Configure and manage your AI trading strategies.</p>
        </div>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white border-none">
          <Zap className="w-4 h-4 mr-2" />
          Create Strategy
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-medium">Active Strategies</span>
            </div>
            <p className="text-2xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <p className="text-2xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-sm font-medium">Alerts</span>
            </div>
            <p className="text-2xl font-bold">0</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
        <Zap className="w-12 h-12 text-white/20 mb-4" />
        <h2 className="text-xl font-semibold text-white/60">No Strategies Yet</h2>
        <p className="text-white/40 text-sm">Create your first trading strategy to get started.</p>
      </div>
    </div>
  );
}
