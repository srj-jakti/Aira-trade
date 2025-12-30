"use client";

import { motion } from "framer-motion";
import { Radar, Search, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ScannerPage() {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Market Scanner</h1>
          <p className="text-white/50 text-sm">AI-powered multi-pair opportunity scanner for Indian Markets.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input className="pl-10 bg-white/5 border-white/10 w-[200px] md:w-[300px] text-white" placeholder="Search NSE/BSE symbols..." />
          </div>
          <Button variant="outline" size="icon" className="bg-white/5 border-white/10 text-white">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm overflow-hidden min-h-[400px] flex flex-col items-center justify-center p-8">
          <Radar className="w-12 h-12 text-white/20 mb-4 animate-pulse" />
          <h2 className="text-xl font-semibold text-white/60">No Active Scan</h2>
          <p className="text-white/40 text-sm text-center max-w-md">The AI scanner is idle. Connect to a real-time data provider to start scanning for high-probability setups in the Indian market.</p>
        </Card>
      </div>
    </div>
  );
}
