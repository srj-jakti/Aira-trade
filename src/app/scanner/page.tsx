"use client";

import { motion } from "framer-motion";
import { Radar, ArrowUpRight, ArrowDownRight, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const scanResults = [
  { pair: "BTC/USDT", price: "$46,820", change: "+4.2%", volume: "$2.4B", volatility: "Medium", score: 8.5 },
  { pair: "ETH/USDT", price: "$2,450", change: "+1.8%", volume: "$1.1B", volatility: "Low", score: 7.2 },
  { pair: "SOL/USDT", price: "$98.40", change: "-2.4%", volume: "$850M", volatility: "High", score: 4.5 },
  { pair: "AVAX/USDT", price: "$34.20", change: "+12.5%", volume: "$420M", volatility: "High", score: 9.1 },
  { pair: "DOT/USDT", price: "$7.20", change: "-0.5%", volume: "$120M", volatility: "Low", score: 5.8 },
  { pair: "LINK/USDT", price: "$18.50", change: "+5.2%", volume: "$310M", volatility: "Medium", score: 8.2 },
];

export default function ScannerPage() {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market Scanner</h1>
          <p className="text-white/50 text-sm">AI-powered multi-pair opportunity scanner.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input className="pl-10 bg-white/5 border-white/10 w-[200px] md:w-[300px]" placeholder="Search pairs..." />
          </div>
          <Button variant="outline" size="icon" className="bg-white/5 border-white/10">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-white/40">Pair</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-white/40">Price</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-white/40">24h Change</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-white/40">Volume</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-white/40">Volatility</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-white/40">AI Score</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-white/40">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {scanResults.map((item, i) => (
                  <motion.tr 
                    key={item.pair}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="px-6 py-4 font-bold">{item.pair}</td>
                    <td className="px-6 py-4 font-mono">{item.price}</td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center font-medium ${item.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                        {item.change.startsWith('+') ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                        {item.change}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/60">{item.volume}</td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={cn(
                        "text-[10px] border-none",
                        item.volatility === 'High' ? 'bg-red-500/20 text-red-400' : 
                        item.volatility === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
                      )}>
                        {item.volatility}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500" 
                            style={{ width: `${item.score * 10}%` }} 
                          />
                        </div>
                        <span className="text-sm font-bold">{item.score}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Button size="sm" variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600/10 border-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white">
                        Deploy Bot
                      </Button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}