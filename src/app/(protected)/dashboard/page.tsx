"use client";

import { useState, useEffect } from "react";
import { 
  Wallet, 
  TrendingUp, 
  Briefcase,
  Activity,
  History,
  Zap,
  Power
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getDashboardStatus, toggleAiTrading } from "./actions";
import { toast } from "sonner";

export default function Dashboard() {
  const [isAiTradingEnabled, setIsAiTradingEnabled] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [loading, setLoading] = useState(true);

  // Real data state (initially empty)
  const [balance, setBalance] = useState({ total: "0.00", available: "0.00" });
  const [pl, setPl] = useState({ total: "0.00", day: "0.00", isPositive: true });
  const [positionsSummary, setPositionsSummary] = useState({ active: 0, total: 0 });
  const [activePositions, setActivePositions] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    async function loadStatus() {
      const status = await getDashboardStatus();
      if (status) {
        setConnectionStatus(status.connectionStatus);
        setIsAiTradingEnabled(status.autoTradingEnabled);
      }
      setLoading(false);
    }
    loadStatus();
  }, []);

  const handleToggleAi = async (enabled: boolean) => {
    setIsAiTradingEnabled(enabled);
    const result = await toggleAiTrading(enabled);
    if (result.error) {
      toast.error(result.error);
      setIsAiTradingEnabled(!enabled);
    } else {
      toast.success(`AI Trading ${enabled ? "enabled" : "disabled"}`);
    }
  };

  const isConnected = connectionStatus === "connected";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* AI Trading Toggle Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 p-4 md:p-6 rounded-2xl border border-white/10">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <Zap className={`w-5 h-5 md:w-6 h-6 ${isAiTradingEnabled ? "text-yellow-400 fill-yellow-400" : "text-white/20"}`} />
            AI Trading Dashboard
          </h1>
          <p className="text-white/50 text-xs md:text-sm mt-1">Real-time monitoring and execution control</p>
        </div>
        <div className="flex items-center gap-4 bg-black/20 p-3 rounded-xl border border-white/5 w-fit">
          <div className="flex items-center space-x-3">
            <Label htmlFor="ai-trading" className="text-sm font-medium text-white/70">
              AI Auto-Trading
            </Label>
            <Switch 
              id="ai-trading" 
              checked={isAiTradingEnabled}
              onCheckedChange={handleToggleAi}
            />
            <Badge variant={isAiTradingEnabled ? "default" : "secondary"} className={isAiTradingEnabled ? "bg-green-500/20 text-green-400 border-green-500/20" : "bg-white/5 text-white/40"}>
              {isAiTradingEnabled ? "ON" : "OFF"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats Row - Responsive side-by-side on mobile */}
      <div className="grid grid-cols-3 gap-2 md:gap-6">
        <Card className="bg-white/5 border-white/10 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-3 md:p-6 pb-2">
            <CardTitle className="text-[10px] md:text-sm font-medium text-white/60">Balance</CardTitle>
            <Wallet className="w-3 h-3 md:w-4 md:h-4 text-blue-400" />
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="text-sm md:text-2xl font-bold text-white truncate">₹{isConnected ? balance.total : "0.00"}</div>
            <div className="hidden md:flex items-center gap-2 mt-2 text-xs">
              <span className="text-white/40 text-nowrap">Margin:</span>
              <span className="text-green-400 font-medium">₹{isConnected ? balance.available : "0.00"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-3 md:p-6 pb-2">
            <CardTitle className="text-[10px] md:text-sm font-medium text-white/60">P*L</CardTitle>
            <TrendingUp className={`w-3 h-3 md:w-4 md:h-4 ${pl.isPositive ? "text-green-400" : "text-red-400"}`} />
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className={`text-sm md:text-2xl font-bold truncate ${pl.isPositive ? "text-green-400" : "text-red-400"}`}>
              ₹{isConnected ? pl.total : "0.00"}
            </div>
            <div className="hidden md:flex items-center gap-2 mt-2 text-xs">
              <span className="text-white/40 text-nowrap">Day:</span>
              <span className={`${pl.isPositive ? "text-green-400/70" : "text-red-400/70"} font-medium`}>
                ₹{isConnected ? pl.day : "0.00"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-3 md:p-6 pb-2">
            <CardTitle className="text-[10px] md:text-sm font-medium text-white/60">Positions</CardTitle>
            <Briefcase className="w-3 h-3 md:w-4 md:h-4 text-purple-400" />
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="text-sm md:text-2xl font-bold text-white truncate">{isConnected ? positionsSummary.active : 0} Active</div>
            <div className="hidden md:flex items-center gap-2 mt-2 text-xs text-white/40">
              <span>{isConnected ? positionsSummary.total : 0} Total</span>
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
              {isConnected ? activePositions.length : 0} Open
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
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
                  {!isConnected || activePositions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-white/20">
                        No active positions
                      </TableCell>
                    </TableRow>
                  ) : (
                    activePositions.map((pos: any) => (
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-purple-400" />
              <CardTitle className="text-lg font-semibold text-white">Recent Orders</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
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
                  {!isConnected || recentOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-white/20">
                        No recent orders
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentOrders.map((order: any) => (
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
