"use client";

import { useState, useEffect } from "react";
import { 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from "recharts";
import { Loader2, BrainCircuit, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function AIAnalysisReports() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-white/20" />
      </div>
    );
  }

  const chartData = [
    { name: 'Mon', accuracy: 65, profit: 1200 },
    { name: 'Tue', accuracy: 72, profit: -400 },
    { name: 'Wed', accuracy: 68, profit: 2100 },
    { name: 'Thu', accuracy: 85, profit: 3400 },
    { name: 'Fri', accuracy: 80, profit: 1800 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40 font-medium">AI Accuracy</p>
              <BrainCircuit className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-1">78.4%</p>
            <p className="text-[10px] text-green-500 mt-1">+2.1% from last week</p>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40 font-medium">Profit Factor</p>
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-1">1.82</p>
            <p className="text-[10px] text-white/20 mt-1">Healthy ratio {">"} 1.5</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40 font-medium">Risk Score</p>
              <AlertCircle className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-1">Low</p>
            <p className="text-[10px] text-blue-400/60 mt-1">Optimized for stability</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-white px-1">Performance Improvement Trend</h4>
        <div className="h-[200px] w-full bg-white/5 rounded-xl border border-white/10 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis 
                dataKey="name" 
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
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Line 
                type="monotone" 
                dataKey="accuracy" 
                stroke="#a855f7" 
                strokeWidth={2} 
                dot={{ fill: '#a855f7', r: 3 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-xl">
        <h4 className="text-sm font-bold text-purple-400 mb-2 flex items-center gap-2">
          <BrainCircuit className="w-4 h-4" />
          AI Improvement Insights
        </h4>
        <ul className="space-y-2">
          <li className="text-xs text-white/60 flex gap-2">
            <span className="text-purple-400">•</span>
            AI has identified a 15% better win rate during the European session overlap.
          </li>
          <li className="text-xs text-white/60 flex gap-2">
            <span className="text-purple-400">•</span>
            Suggesting reduced exposure in Commodity segment due to high volatility detected.
          </li>
        </ul>
      </div>
    </div>
  );
}
