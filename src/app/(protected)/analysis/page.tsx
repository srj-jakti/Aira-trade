"use client";

import { Search, BrainCircuit, LineChart, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AnalysisPage() {
  return (
    <div className="p-2 md:p-4 space-y-4 max-w-[1600px] mx-auto">
      {/* Search Section */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <Input 
          placeholder="Search instrument (e.g. NIFTY 50, RELIANCE)..." 
          className="pl-10 bg-white/5 border-white/10 h-10 md:h-12 text-white placeholder:text-white/20"
        />
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart Area */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-white/5 border-white/10 overflow-hidden">
            <CardHeader className="p-3 md:p-4 border-b border-white/10">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <LineChart className="w-4 h-4 text-blue-400" />
                Live Market Chart
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="aspect-[16/9] md:aspect-video bg-black/40 flex items-center justify-center text-white/20 text-sm">
                Connect Zerodha to view live market data
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analysis Section */}
        <div className="lg:col-span-1 space-y-4">
          {/* AI Analysis */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="p-3 md:p-4 border-b border-white/10">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-purple-400" />
                AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 min-h-[150px] flex items-center justify-center text-center">
              <p className="text-white/30 text-xs md:text-sm">
                No active analysis. Select an instrument to begin.
              </p>
            </CardContent>
          </Card>

          {/* Strategy Analysis */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="p-3 md:p-4 border-b border-white/10">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="w-4 h-4 text-green-400" />
                Strategy Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 min-h-[150px] flex items-center justify-center text-center">
              <p className="text-white/30 text-xs md:text-sm">
                No active strategies for this instrument.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
