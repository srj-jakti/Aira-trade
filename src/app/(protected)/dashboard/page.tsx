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
    <div className="p-3 md:p-6 space-y-3 md:space-y-4 max-w-[1600px] mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-br from-white/10 to-transparent p-3 md:p-4 rounded-2xl border border-white/10 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
              <Zap className={`size-5 transition-colors ${isAiTradingEnabled ? "text-primary fill-primary" : "text-white/20"}`} />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-white tracking-tight leading-none">
                Terminal Dashboard
              </h1>
              <p className="text-white/40 text-[10px] md:text-xs mt-1 font-medium">Real-time terminal monitoring and execution control</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-black/40 p-1 pl-3 rounded-full border border-white/5 w-fit">
            <Label htmlFor="ai-trading" className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              Automation
            </Label>
            <div className="flex items-center gap-2 bg-white/5 rounded-full p-0.5 px-2 border border-white/5">
              <Switch 
                id="ai-trading" 
                checked={isAiTradingEnabled}
                onCheckedChange={handleToggleAi}
                className="scale-75"
              />
              <span className={cn(
                "text-[9px] font-black px-1.5 py-0.5 rounded-full",
                isAiTradingEnabled ? "bg-primary/20 text-primary" : "bg-white/5 text-white/20"
              )}>
                {isAiTradingEnabled ? "ACTIVE" : "OFF"}
              </span>
            </div>
          </div>
        </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
            className={cn(i === 2 && "col-span-2 md:col-span-1")}
          >
            <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-all hover:border-white/20 group cursor-default">
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{stat.label}</CardTitle>
                <stat.icon className={cn("size-3.5 opacity-50 group-hover:opacity-100 transition-opacity", stat.color)} />
              </CardHeader>
              <CardContent>
                <div className={cn("text-xl md:text-2xl font-black tracking-tighter leading-none", stat.color)}>
                  {stat.value}
                </div>
                <div className="text-[10px] text-white/20 font-medium mt-1 uppercase tracking-tight">
                  {stat.sub}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Active Positions - Takes 2/3 on desktop */}
        <div className="lg:col-span-2">
          <Card className="bg-white/5 border-white/10 overflow-hidden h-full">
            <CardHeader className="flex flex-row items-center justify-between bg-white/[0.02] border-b border-white/5 py-3">
              <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <Activity className="size-3.5 text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-white">Active Positions</CardTitle>
                </div>
              </div>
              <Badge variant="secondary" className="bg-white/5 text-white/60 border-white/10 text-[9px] font-bold">
                {isConnected ? activePositions.length : 0} OPEN
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-white/[0.01]">
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Instrument</TableHead>
                    <TableHead className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Type</TableHead>
                    <TableHead className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Qty</TableHead>
                    <TableHead className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Avg. Price</TableHead>
                    <TableHead className="text-[9px] font-bold text-white/20 uppercase tracking-widest text-right">M2M P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!isConnected || activePositions.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="h-32 text-center text-white/20 text-xs font-medium italic">
                        No active positions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    activePositions.map((pos: any) => (
                      <TableRow key={pos.id} className="border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer">
                        <TableCell className="font-bold text-white text-xs">{pos.symbol}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[8px] font-black px-1.5 py-0 border-none",
                            pos.type === "BUY" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                          )}>
                            {pos.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white/60 font-mono text-[11px]">{pos.qty}</TableCell>
                        <TableCell className="text-white/60 font-mono text-[11px]">₹{pos.avgPrice}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span className={cn("font-bold text-xs", pos.pl.startsWith("+") ? "text-green-400" : "text-red-400")}>
                              {pos.pl}
                            </span>
                            <span className="text-[9px] text-white/20 font-medium">{pos.plPercent}</span>
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
        <div>
          <Card className="bg-white/5 border-white/10 h-full overflow-hidden">
            <CardHeader className="bg-white/[0.02] border-b border-white/5 py-3">
              <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                  <History className="size-3.5 text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-white">Recent Logs</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/5">
                {!isConnected || recentOrders.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-white/20 text-xs font-medium italic">
                    No recent activity
                  </div>
                ) : (
                  recentOrders.map((order: any) => (
                    <div key={order.id} className="p-3 hover:bg-white/[0.02] transition-colors flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white tracking-tight">{order.symbol}</span>
                          <span className={cn(
                            "text-[8px] font-black uppercase",
                            order.type === "BUY" ? "text-green-400" : "text-red-400"
                          )}>{order.type}</span>
                        </div>
                        <span className="text-[9px] text-white/20 font-mono">{order.time}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono text-white/60">₹{order.price}</div>
                        <div className={cn(
                          "text-[8px] font-bold mt-0.5 px-1 rounded-sm bg-white/5 inline-block",
                          order.status === "COMPLETE" ? "text-green-400/60" : "text-white/20"
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
  );
}
