"use client";

import { motion } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Zap,
  RefreshCcw
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const data = [
  { time: "00:00", value: 42000 },
  { time: "04:00", value: 43500 },
  { time: "08:00", value: 42800 },
  { time: "12:00", value: 44200 },
  { time: "16:00", value: 45800 },
  { time: "20:00", value: 45200 },
  { time: "23:59", value: 46800 },
];

const stats = [
  { label: "Total Balance", value: "$46,820.50", change: "+12.5%", positive: true, icon: DollarSign },
  { label: "Today's Profit", value: "+$1,240.20", change: "+4.2%", positive: true, icon: TrendingUp },
  { label: "Win Rate", value: "72.4%", change: "+1.8%", positive: true, icon: Percent },
  { label: "Active Trades", value: "4", change: "Running", positive: true, icon: Activity },
];

const recentActions = [
  { id: 1, pair: "BTC/USDT", action: "BUY", price: "$45,200", time: "2 mins ago", status: "Executed" },
  { id: 2, pair: "ETH/USDT", action: "SELL", price: "$2,450", time: "15 mins ago", status: "Executed" },
  { id: 3, pair: "SOL/USDT", action: "BUY", price: "$98.40", time: "45 mins ago", status: "Executed" },
];

export default function Dashboard() {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Intelligence Dashboard</h1>
          <p className="text-white/50 text-sm">Real-time AI trading monitoring & execution.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10">
            <RefreshCcw className="w-4 h-4 mr-2" />
            Sync Data
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
            <Zap className="w-4 h-4 mr-2 fill-current" />
            AI Mode: Active
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="bg-white/5 border-white/10 backdrop-blur-sm overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                      <Icon className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className={cn(
                      "flex items-center text-[10px] md:text-xs font-medium",
                      stat.positive ? "text-green-400" : "text-red-400"
                    )}>
                      {stat.positive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                      {stat.change}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-white/50 font-medium">{stat.label}</p>
                    <p className="text-xl md:text-2xl font-bold tracking-tighter">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Performance</CardTitle>
            <div className="flex gap-1">
              {['1H', '1D', '1W', '1M'].map((p) => (
                <Button key={p} variant="ghost" size="sm" className={cn(
                  "h-7 px-2 text-[10px]",
                  p === '1D' ? "bg-white/10 text-white" : "text-white/40"
                )}>{p}</Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* AI Actions */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              Recent AI Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActions.map((action) => (
              <div key={action.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{action.pair}</span>
                    <Badge variant="outline" className={cn(
                      "text-[10px] h-4 px-1 leading-none border-none",
                      action.action === 'BUY' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    )}>
                      {action.action}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-white/40">{action.time}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{action.price}</p>
                  <p className="text-[10px] text-green-400">Success</p>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="w-full text-xs text-white/40 hover:text-white">
              View All History
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}