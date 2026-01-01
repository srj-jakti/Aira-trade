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
      toast.success(`Execution automation ${enabled ? "enabled" : "disabled"}`);
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
    <div className="p-3 md:p-6 space-y-4 max-w-[1600px] mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-br from-white/10 to-transparent p-4 md:p-5 rounded-2xl border border-white/10 shadow-2xl">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Zap className={`size-5 md:size-6 transition-colors ${isAiTradingEnabled ? "text-primary fill-primary" : "text-white/20"}`} />
              Analysis Dashboard
            </h1>
            <p className="text-white/40 text-xs mt-0.5 font-medium">Real-time terminal monitoring and execution control</p>
          </div>
          <div className="flex items-center gap-4 bg-black/40 p-1.5 pl-4 rounded-full border border-white/5 w-fit">
            <Label htmlFor="ai-trading" className="text-xs font-semibold text-white/60 uppercase tracking-wider">
              Automation
            </Label>
            <div className="flex items-center gap-3 bg-white/5 rounded-full p-1 px-3 border border-white/5">
              <Switch 
                id="ai-trading" 
                checked={isAiTradingEnabled}
                onCheckedChange={handleToggleAi}
                className="scale-90"
              />
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                isAiTradingEnabled ? "bg-primary/20 text-primary" : "bg-white/5 text-white/20"
              )}>
                {isAiTradingEnabled ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
          </div>
        </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6">
        {[
          { label: "Equity Balance", value: `₹${isConnected ? balance.total : "0.00"}`, sub: `Margin: ₹${isConnected ? balance.available : "0.00"}`, icon: Wallet, color: "text-blue-400" },
          { label: "Net P&L", value: `₹${isConnected ? pl.total : "0.00"}`, sub: `Day: ₹${isConnected ? pl.day : "0.00"}`, icon: TrendingUp, color: pl.isPositive ? "text-green-400" : "text-red-400" },
          { label: "Open Positions", value: isConnected ? positionsSummary.active : 0, sub: `${isConnected ? positionsSummary.total : 0} Total Trades`, icon: Briefcase, color: "text-purple-400" }
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors group cursor-default">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-white/40 uppercase tracking-widest">{stat.label}</CardTitle>
                <stat.icon className={cn("size-4 opacity-50 group-hover:opacity-100 transition-opacity", stat.color)} />
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl md:text-3xl font-bold tracking-tighter", stat.color === "text-white" ? "text-white" : stat.color)}>
                  {stat.value}
                </div>
                <div className="text-xs text-white/30 font-medium mt-1">
                  {stat.sub}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Positions - Takes 2/3 on desktop */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white/5 border-white/10 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between bg-white/[0.02] border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Activity className="size-4 text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-white">Active Positions</CardTitle>
                  <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Real-time portfolio</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-white/5 text-white/60 border-white/10">
                {isConnected ? activePositions.length : 0} OPEN
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-white/[0.01]">
                  <TableRow className="border-white/5">
                    <TableHead className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Instrument</TableHead>
                    <TableHead className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Type</TableHead>
                    <TableHead className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Qty</TableHead>
                    <TableHead className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Avg. Price</TableHead>
                    <TableHead className="text-[10px] font-bold text-white/30 uppercase tracking-widest text-right">M2M P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!isConnected || activePositions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-white/20 text-sm font-medium">
                        No active positions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    activePositions.map((pos: any) => (
                      <TableRow key={pos.id} className="border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer">
                        <TableCell className="font-bold text-white">{pos.symbol}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[9px] font-black px-1.5 py-0",
                            pos.type === "BUY" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                          )}>
                            {pos.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white/70 font-mono text-xs">{pos.qty}</TableCell>
                        <TableCell className="text-white/70 font-mono text-xs">₹{pos.avgPrice}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span className={cn("font-bold text-sm", pos.pl.startsWith("+") ? "text-green-400" : "text-red-400")}>
                              {pos.pl}
                            </span>
                            <span className="text-[10px] text-white/30 font-medium">{pos.plPercent}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders - Takes 1/3 on desktop */}
        <div className="space-y-6">
          <Card className="bg-white/5 border-white/10 h-full overflow-hidden">
            <CardHeader className="bg-white/[0.02] border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <History className="size-4 text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-white">Recent Logs</CardTitle>
                  <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Execution History</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/5">
                {!isConnected || recentOrders.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-white/20 text-sm font-medium">
                    No recent orders
                  </div>
                ) : (
                  recentOrders.map((order: any) => (
                    <div key={order.id} className="p-4 hover:bg-white/[0.02] transition-colors flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{order.symbol}</span>
                          <span className={cn(
                            "text-[9px] font-black",
                            order.type === "BUY" ? "text-green-400" : "text-red-400"
                          )}>{order.type}</span>
                        </div>
                        <span className="text-[10px] text-white/30 font-mono">{order.time}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono text-white/70">₹{order.price}</div>
                        <div className={cn(
                          "text-[9px] font-bold mt-1",
                          order.status === "COMPLETE" ? "text-green-400" : "text-white/20"
                        )}>{order.status}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </div>
  );
}
