"use client";

import { useState, useEffect } from "react";
import { 
  Wallet, 
  TrendingUp, 
  Briefcase,
  Activity,
  History,
  Zap,
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
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const [isAiTradingEnabled, setIsAiTradingEnabled] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [loading, setLoading] = useState(true);

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
    <div className="p-3 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.03] backdrop-blur-md p-4 md:p-6 rounded-2xl border border-white/10 shadow-2xl">
        <div>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-xl",
              isAiTradingEnabled ? "bg-yellow-400/10 text-yellow-400" : "bg-white/5 text-white/20"
            )}>
              <Zap className={cn("w-5 h-5", isAiTradingEnabled && "fill-current")} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
                Dashboard
              </h1>
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Market Analysis & Execution</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
          <div className="flex items-center space-x-4">
            <div className="flex flex-col">
              <Label htmlFor="ai-trading" className="text-xs font-bold text-white/70 uppercase tracking-tighter">
                Auto-Execution
              </Label>
              <span className="text-[10px] text-white/30 font-medium">Risk-managed automation</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch 
                id="ai-trading" 
                checked={isAiTradingEnabled}
                onCheckedChange={handleToggleAi}
                className="data-[state=checked]:bg-yellow-400"
              />
              <Badge variant={isAiTradingEnabled ? "default" : "secondary"} className={cn(
                "text-[10px] font-black h-5 px-2",
                isAiTradingEnabled ? "bg-yellow-400 text-black border-none" : "bg-white/10 text-white/40"
              )}>
                {isAiTradingEnabled ? "ACTIVE" : "PAUSED"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard 
          title="Account Balance" 
          value={`₹${isConnected ? balance.total : "0.00"}`}
          subValue={`Margin: ₹${isConnected ? balance.available : "0.00"}`}
          icon={Wallet}
          iconColor="text-blue-400"
        />
        <StatCard 
          title="Net P&L" 
          value={`₹${isConnected ? pl.total : "0.00"}`}
          subValue={`Today: ₹${isConnected ? pl.day : "0.00"}`}
          icon={TrendingUp}
          iconColor={pl.isPositive ? "text-green-400" : "text-red-400"}
          valueColor={pl.isPositive ? "text-green-400" : "text-red-400"}
        />
        <StatCard 
          title="Active Positions" 
          value={isConnected ? positionsSummary.active : 0}
          subValue={`${isConnected ? positionsSummary.total : 0} total trades`}
          icon={Briefcase}
          iconColor="text-purple-400"
        />
        <StatCard 
          title="System Health" 
          value={isConnected ? "Operational" : "Offline"}
          subValue={isConnected ? "All systems normal" : "Waiting for connection"}
          icon={Activity}
          iconColor={isConnected ? "text-green-400" : "text-white/20"}
          valueColor={isConnected ? "text-green-400" : "text-white/40"}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Active Positions Table */}
        <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-4 md:p-5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-400/10 text-blue-400">
                <Activity className="w-4 h-4" />
              </div>
              <CardTitle className="text-sm md:text-base font-bold text-white uppercase tracking-tight">Active Positions</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold h-5 text-white/40 border-white/10 bg-white/5 uppercase">
              {isConnected ? activePositions.length : 0} Positions
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-white/[0.02] border-white/5">
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4">Symbol</TableHead>
                    <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4">Side</TableHead>
                    <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4">Qty</TableHead>
                    <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4">LTP</TableHead>
                    <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4 text-right">P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!isConnected || activePositions.length === 0 ? (
                    <TableRow className="border-none hover:bg-transparent">
                      <TableCell colSpan={5} className="h-24 text-center">
                        <p className="text-white/20 text-xs font-medium">No active positions to display</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    activePositions.map((pos: any) => (
                      <TableRow key={pos.id} className="border-white/5 hover:bg-white/[0.03] transition-colors">
                        <TableCell className="font-bold text-white text-xs px-4 py-3">{pos.symbol}</TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge variant="outline" className={cn(
                            "text-[10px] font-black h-5 px-1.5 border-none",
                            pos.type === "BUY" ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
                          )}>
                            {pos.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white/70 text-xs font-mono px-4 py-3">{pos.qty}</TableCell>
                        <TableCell className="text-white/70 text-xs font-mono px-4 py-3">{pos.ltp}</TableCell>
                        <TableCell className="text-right px-4 py-3">
                          <div className="flex flex-col items-end">
                            <span className={cn(
                              "text-xs font-bold font-mono",
                              pos.pl.startsWith("+") ? "text-green-400" : "text-red-400"
                            )}>{pos.pl}</span>
                            <span className="text-[9px] text-white/30 font-medium">{pos.plPercent}</span>
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
        <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-4 md:p-5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-400/10 text-purple-400">
                <History className="w-4 h-4" />
              </div>
              <CardTitle className="text-sm md:text-base font-bold text-white uppercase tracking-tight">Trade History</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-white/[0.02] border-white/5">
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4">Time</TableHead>
                    <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4">Symbol</TableHead>
                    <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4">Side</TableHead>
                    <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4">Price</TableHead>
                    <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!isConnected || recentOrders.length === 0 ? (
                    <TableRow className="border-none hover:bg-transparent">
                      <TableCell colSpan={5} className="h-24 text-center">
                        <p className="text-white/20 text-xs font-medium">No recent orders found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentOrders.map((order: any) => (
                      <TableRow key={order.id} className="border-white/5 hover:bg-white/[0.03] transition-colors">
                        <TableCell className="text-white/40 text-[10px] font-medium px-4 py-3">{order.time}</TableCell>
                        <TableCell className="font-bold text-white text-xs px-4 py-3">{order.symbol}</TableCell>
                        <TableCell className="px-4 py-3">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-tight",
                            order.type === "BUY" ? "text-green-400" : "text-red-400"
                          )}>{order.type}</span>
                        </TableCell>
                        <TableCell className="text-white/70 text-xs font-mono px-4 py-3">{order.price}</TableCell>
                        <TableCell className="text-right px-4 py-3">
                          <Badge variant="outline" className={cn(
                            "text-[9px] font-bold h-4 px-1 border-none",
                            order.status === "COMPLETE" ? "bg-green-400/10 text-green-400" : 
                            order.status === "CANCELLED" ? "bg-white/5 text-white/30" : 
                            "bg-yellow-400/10 text-yellow-400"
                          )}>
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

function StatCard({ 
  title, 
  value, 
  subValue, 
  icon: Icon, 
  iconColor = "text-white/40", 
  valueColor = "text-white" 
}: { 
  title: string, 
  value: string | number, 
  subValue?: string, 
  icon: any, 
  iconColor?: string, 
  valueColor?: string 
}) {
  return (
    <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden group hover:bg-white/[0.04] transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between p-3 md:p-4 pb-1">
        <CardTitle className="text-[10px] md:text-xs font-bold text-white/40 uppercase tracking-widest">{title}</CardTitle>
        <div className={cn("p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors", iconColor)}>
          <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-4 pt-0">
        <div className={cn("text-lg md:text-2xl font-black tracking-tighter truncate", valueColor)}>
          {value}
        </div>
        {subValue && (
          <div className="text-[10px] md:text-xs font-medium text-white/30 mt-0.5 truncate uppercase tracking-tight">
            {subValue}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
