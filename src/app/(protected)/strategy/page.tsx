"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Search, 
  Filter, 
  TrendingUp, 
  Zap, 
  Settings, 
  ChevronRight, 
  Activity,
  BarChart3,
  BrainCircuit,
  Shield,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Strategy {
  id: string | number;
  name: string;
  description: string;
  status: string;
  is_active: boolean;
  performance?: string;
  created_at: string;
}

export default function StrategyPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchStrategies() {
      try {
        const response = await fetch("/api/strategies/public");
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        setStrategies(data.strategies || []);
      } catch (error) {
        toast.error("Could not load strategies");
      } finally {
        setLoading(false);
      }
    }
    fetchStrategies();
  }, []);

  const filteredStrategies = strategies.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0B] text-white selection:bg-blue-500/30">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0B]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <BrainCircuit className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
              Trading Strategies
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="hidden sm:flex border-white/10 hover:bg-white/5 h-9">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-500 text-white h-9 shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all">
              <Plus className="w-4 h-4 mr-2" />
              Create Strategy
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Search Bar */}
        <div className="relative mb-8 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-blue-400 transition-colors" />
          <input 
            type="text" 
            placeholder="Search by name, indicator, or rule..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 transition-all text-sm"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-white/40 text-sm animate-pulse">Analyzing market patterns...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredStrategies.length > 0 ? (
                filteredStrategies.map((strategy, index) => (
                  <motion.div
                    key={strategy.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    className="group relative bg-[#121214] border border-white/5 rounded-2xl p-6 hover:border-blue-500/30 hover:bg-[#161618] transition-all cursor-pointer overflow-hidden"
                  >
                    {/* Glow effect */}
                    <div className="absolute -inset-px bg-gradient-to-br from-blue-500/0 via-blue-500/0 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-2.5 bg-white/5 rounded-xl group-hover:bg-blue-500/10 group-hover:text-blue-400 transition-colors">
                          <Zap className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-2">
                          {strategy.is_active && (
                            <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                          )}
                          <span className="text-[10px] uppercase tracking-wider font-bold text-white/30 px-2 py-1 bg-white/5 rounded-md">
                            {strategy.status || "Draft"}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-400 transition-colors">
                        {strategy.name}
                      </h3>
                      <p className="text-sm text-white/50 line-clamp-2 mb-6 min-h-[40px]">
                        {strategy.description}
                      </p>

                      <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-xs text-white/60">
                            {strategy.performance || "0.00%"}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-1 text-blue-400 font-medium">
                          <span className="text-xs">Manage</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full py-20 flex flex-col items-center text-center bg-white/5 rounded-3xl border border-dashed border-white/10"
                >
                  <TrendingUp className="w-12 h-12 text-white/10 mb-4" />
                  <h3 className="text-lg font-medium mb-1">No strategies found</h3>
                  <p className="text-white/40 text-sm max-w-xs mx-auto mb-6">
                    {searchQuery ? `No results match "${searchQuery}"` : "You haven't created any strategies yet."}
                  </p>
                  <Button className="bg-white text-black hover:bg-white/90">
                    Create your first strategy
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
