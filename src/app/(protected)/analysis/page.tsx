"use client";

import { 
  BrainCircuit,
  TrendingUp,
  LineChart,
  BarChart3
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function AnalysisPage() {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">AI Analysis</h1>
        <p className="text-white/50 text-sm">Deep market analysis powered by machine learning.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-sm font-medium">Bullish Signals</span>
            </div>
            <p className="text-2xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-red-400 rotate-180" />
              <span className="text-sm font-medium">Bearish Signals</span>
            </div>
            <p className="text-2xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <LineChart className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-medium">Patterns Found</span>
            </div>
            <p className="text-2xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-medium">Reports</span>
            </div>
            <p className="text-2xl font-bold">0</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
        <BrainCircuit className="w-12 h-12 text-white/20 mb-4" />
        <h2 className="text-xl font-semibold text-white/60">No Analysis Data</h2>
        <p className="text-white/40 text-sm">Connect your broker to start AI-powered market analysis.</p>
      </div>
    </div>
  );
}
