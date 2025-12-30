"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Wallet, 
  TrendingUp, 
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  History,
  Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const [isAiTradingEnabled, setIsAiTradingEnabled] = useState(false);

  // Mock data - in a real app, this would come from an API connecting to Kite
  const balanceData = {
    totalBalance: "₹2,45,670.00",
    usedMargin: "₹1,12,000.00",
    availableMargin: "₹1,33,670.00"
  };

  const plData = {
    totalPL: "+₹4,230.50",
    dayPL: "+₹1,120.20",
    isPositive: true
  };

  const positionsSummary = {
    totalPositions: 4,
    activePositions: 2,
    completedToday: 2
  };

  const activePositions = [
    { id: 1, symbol: "RELIANCE", type: "BUY", qty: 50, avgPrice: "2450.00", ltp: "2465.30", pl: "+₹765.00", plPercent: "+0.62%" },
    { id: 2, symbol: "HDFCBANK", type: "SELL", qty: 100, avgPrice: "1620.00", ltp: "1615.40", pl: "+₹460.00", plPercent: "+0.28%" },
  ];

  const recentOrders = [
    { id: 1, time: "11:24:05", symbol: "INFY", type: "BUY", qty: 25, price: "1420.00", status: "COMPLETE" },
    { id: 2, time: "10:15:30", symbol: "TCS", type: "SELL", qty: 10, price: "3450.00", status: "COMPLETE" },
    { id: 3, time: "09:45:12", symbol: "SBIN", type: "BUY", qty: 200, price: "580.00", status: "CANCELLED" },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* AI Trading Toggle Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 p-6 rounded-2xl border border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className={`w-6 h-6 ${isAiTradingEnabled ? "text-yellow-400 fill-yellow-400" : "text-white/20"}`} />
            Trading Dashboard
          </h1>
          <p className="text-white/50 text-sm mt-1">Real-time monitoring and execution control</p>
        </div>
        <div className="flex items-center gap-4 bg-black/20 p-3 rounded-xl border border-white/5">
          <div className="flex items-center space-x-3">
            <Label htmlFor="ai-trading" className="text-sm font-medium text-white/70">
              AI Auto-Trading
            </Label>
            <Switch 
              id="ai-trading" 
              checked={isAiTradingEnabled}
              onCheckedChange={setIsAiTradingEnabled}
            />
            <Badge variant={isAiTradingEnabled ? "default" : "secondary"} className={isAiTradingEnabled ? "bg-green-500/20 text-green-400 border-green-500/20" : "bg-white/5 text-white/40"}>
              {isAiTradingEnabled ? "ACTIVE" : "INACTIVE"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/5 border-white/10 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/60">Connected Balance</CardTitle>
            <Wallet className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{balanceData.totalBalance}</div>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="text-white/40 text-nowrap">Available Margin:</span>
              <span className="text-green-400 font-medium">{balanceData.availableMargin}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/60">Total P&L</CardTitle>
            <TrendingUp className={`w-4 h-4 ${plData.isPositive ? "text-green-400" : "text-red-400"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${plData.isPositive ? "text-green-400" : "text-red-400"}`}>
              {plData.totalPL}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="text-white/40 text-nowrap">Day P&L:</span>
              <span className={`${plData.isPositive ? "text-green-400/70" : "text-red-400/70"} font-medium`}>
                {plData.dayPL}
              </span>
              {plData.isPositive ? <ArrowUpRight className="w-3 h-3 text-green-400" /> : <ArrowDownRight className="w-3 h-3 text-red-400" />}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/60">Position Summary</CardTitle>
            <Briefcase className="w-4 h-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{positionsSummary.activePositions} Active</div>
            <div className="flex items-center gap-2 mt-2 text-xs text-white/40">
              <span>{positionsSummary.totalPositions} Total Positions Today</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6">
        {/* Active Positions */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <CardTitle className="text-lg font-semibold text-white">Active Positions</CardTitle>
            </div>
            <Badge variant="outline" className="text-white/40 border-white/10">
              {activePositions.length} Open
            </Badge>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader className="border-white/10">
                <TableRow className="hover:bg-transparent border-white/10">
                  <TableHead className="text-white/40">Symbol</TableHead>
                  <TableHead className="text-white/40">Type</TableHead>
                  <TableHead className="text-white/40">Qty</TableHead>
                  <TableHead className="text-white/40">Avg. Price</TableHead>
                  <TableHead className="text-white/40">LTP</TableHead>
                  <TableHead className="text-white/40 text-right">P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activePositions.map((pos) => (
                  <TableRow key={pos.id} className="border-white/5 hover:bg-white/[0.02]">
                    <TableCell className="font-medium text-white">{pos.symbol}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={pos.type === "BUY" ? "text-green-400 border-green-400/20" : "text-red-400 border-red-400/20"}>
                        {pos.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white/70">{pos.qty}</TableCell>
                    <TableCell className="text-white/70">{pos.avgPrice}</TableCell>
                    <TableCell className="text-white/70 font-mono">{pos.ltp}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className={pos.pl.startsWith("+") ? "text-green-400" : "text-red-400"}>{pos.pl}</span>
                        <span className="text-[10px] text-white/30">{pos.plPercent}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-purple-400" />
              <CardTitle className="text-lg font-semibold text-white">Recent Orders</CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="text-white/40 hover:text-white hover:bg-white/5">
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader className="border-white/10">
                <TableRow className="hover:bg-transparent border-white/10">
                  <TableHead className="text-white/40">Time</TableHead>
                  <TableHead className="text-white/40">Symbol</TableHead>
                  <TableHead className="text-white/40">Type</TableHead>
                  <TableHead className="text-white/40">Qty</TableHead>
                  <TableHead className="text-white/40">Price</TableHead>
                  <TableHead className="text-white/40 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id} className="border-white/5 hover:bg-white/[0.02]">
                    <TableCell className="text-white/40 text-xs">{order.time}</TableCell>
                    <TableCell className="font-medium text-white">{order.symbol}</TableCell>
                    <TableCell>
                      <span className={order.type === "BUY" ? "text-green-400" : "text-red-400"}>{order.type}</span>
                    </TableCell>
                    <TableCell className="text-white/70">{order.qty}</TableCell>
                    <TableCell className="text-white/70 font-mono">{order.price}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={
                        order.status === "COMPLETE" ? "text-green-400 border-green-400/20" : 
                        order.status === "CANCELLED" ? "text-white/20 border-white/10" : 
                        "text-yellow-400 border-yellow-400/20"
                      }>
                        {order.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
