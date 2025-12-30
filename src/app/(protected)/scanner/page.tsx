"use client";

import { 
  Radar,
  Search,
  Filter,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function ScannerPage() {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Market Scanner</h1>
          <p className="text-white/50 text-sm">Scan Indian markets for trading opportunities.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input 
              placeholder="Search stocks..." 
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 w-64"
            />
          </div>
          <Button variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10 text-white">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-sm font-medium">Top Gainers</span>
            </div>
            <p className="text-2xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-red-400 rotate-180" />
              <span className="text-sm font-medium">Top Losers</span>
            </div>
            <p className="text-2xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Radar className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-medium">Active Scans</span>
            </div>
            <p className="text-2xl font-bold">0</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
        <Radar className="w-12 h-12 text-white/20 mb-4" />
        <h2 className="text-xl font-semibold text-white/60">No Scan Results</h2>
        <p className="text-white/40 text-sm">Configure scanner filters to find trading opportunities.</p>
      </div>
    </div>
  );
}
