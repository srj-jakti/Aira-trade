"use client";

import { motion } from "framer-motion";
import { Zap, Plus, Play, Pause, Trash2, Edit2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

const strategies = [
  { 
    id: 1, 
    name: "Neural Trend Follower", 
    desc: "Uses LSTM models to predict price trends and follow them.",
    status: "active",
    profit: "+24.5%",
    risk: "Medium"
  },
  { 
    id: 2, 
    name: "HFT Scalper V4", 
    desc: "High-frequency scalping based on order book imbalance.",
    status: "paused",
    profit: "+12.2%",
    risk: "High"
  },
  { 
    id: 3, 
    name: "Arbitrage AI", 
    desc: "Cross-exchange arbitrage detection and execution.",
    status: "active",
    profit: "+8.9%",
    risk: "Low"
  },
];

export default function StrategyPage() {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Strategies</h1>
          <p className="text-white/50 text-sm">Deploy and manage your automated trading bots.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Create Strategy
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {strategies.map((strat, i) => (
          <motion.div
            key={strat.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="bg-white/5 border-white/10 h-full flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Zap className="w-5 h-5 text-blue-500" />
                  </div>
                  <Badge variant="outline" className={strat.risk === 'High' ? 'text-red-400 border-red-400/20 bg-red-400/10' : 'text-green-400 border-green-400/20 bg-green-400/10'}>
                    {strat.risk} Risk
                  </Badge>
                </div>
                <CardTitle className="text-xl">{strat.name}</CardTitle>
                <CardDescription className="text-white/50">{strat.desc}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-6">
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div>
                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Total Profit</p>
                    <p className="text-xl font-bold text-green-400">{strat.profit}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium capitalize">{strat.status}</span>
                      <Switch checked={strat.status === 'active'} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1 bg-white/5 border-white/10">
                    <Edit2 className="w-3 h-3 mr-2" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="bg-white/5 border-white/10 text-red-400 hover:text-red-400 hover:bg-red-400/10">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        
        {/* Custom Strategy Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: strategies.length * 0.1 }}
        >
          <Card className="bg-white/5 border-white/10 border-dashed h-full flex items-center justify-center p-8 group cursor-pointer hover:bg-white/[0.07] transition-colors">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-white/40" />
              </div>
              <div>
                <p className="font-bold text-white/60">New Strategy</p>
                <p className="text-xs text-white/40">Custom AI configuration</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-red-500">Risk Warning</p>
          <p className="text-xs text-red-500/80">Trading involves significant risk. Ensure you have properly backtested all strategies before deploying them with live capital.</p>
        </div>
      </div>
    </div>
  );
}