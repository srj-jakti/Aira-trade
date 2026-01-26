"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Wallet, 
  TrendingUp, 
  Briefcase,
  Activity,
  History,
  Zap,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Wifi,
  WifiOff
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
import { getDashboardStatus, toggleAiTrading, togglePaperTrading } from "./actions";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrices } from "@/hooks/useMarketData";

const SIGNAL_STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  PENDING: { icon: Clock, color: "text-yellow-600", label: "Pending" },
  PENDING_EXECUTION: { icon: Loader2, color: "text-blue-600", label: "Queued" },
  EXECUTING: { icon: Loader2, color: "text-blue-600", label: "Executing" },
  EXECUTED: { icon: CheckCircle2, color: "text-green-600", label: "Executed" },
  FILLED: { icon: CheckCircle2, color: "text-green-500", label: "Filled" },
  REJECTED: { icon: XCircle, color: "text-red-600", label: "Rejected" },
  CANCELLED: { icon: XCircle, color: "text-gray-400", label: "Cancelled" },
  EXPIRED: { icon: Clock, color: "text-gray-500", label: "Expired" },
  FAILED: { icon: AlertCircle, color: "text-red-500", label: "Failed" },
};

export default function Dashboard() {
  const [isAiTradingEnabled, setIsAiTradingEnabled] = useState(false);
  const [isPaperTradingEnabled, setIsPaperTradingEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [loading, setLoading] = useState(true);
  const [tradingEngine, setTradingEngine] = useState<{
    status: string;
    lastHeartbeat?: string;
    activeUsers: number;
    errorMessage?: string;
  }>({ status: "stopped", activeUsers: 0 });
  const [userTradingStatus, setUserTradingStatus] = useState<{
    lastEvaluation?: string;
    nextEvaluation?: string;
    evaluationError?: string;
    consecutiveFailures: number;
    strategyType: string;
  }>({ consecutiveFailures: 0, strategyType: "intraday" });
  const [recentSignals, setRecentSignals] = useState<Array<{
    id: string;
    signal_status: string;
    status_reason?: string;
    tradingsymbol: string;
    direction: string;
    created_at: string;
  }>>([]);

  const [balance, setBalance] = useState({ total: "0.00", available: "0.00" });
  const [pl, setPl] = useState({ total: "0.00", day: "0.00", isPositive: true });
  const [positionsSummary, setPositionsSummary] = useState({ active: 0, total: 0 });
  const [activePositions, setActivePositions] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState([]);

  const positionTokens = useMemo(() => 
    activePositions.map((p: any) => p.instrument_token).filter((t: any) => typeof t === 'number'),
    [activePositions]
  );

  const { prices: livePrices, isConnected: isLiveConnected, getPrice } = usePrices(
    positionTokens,
    positionTokens.length > 0
  );

  useEffect(() => {
    async function loadStatus() {
      const status = await getDashboardStatus();
      if (status) {
          setConnectionStatus(status.connectionStatus);
          setIsAiTradingEnabled(status.autoTradingEnabled);
          setIsPaperTradingEnabled(status.paperTradingEnabled);
          setTradingEngine(status.tradingEngine);
          setUserTradingStatus(status.userTradingStatus);
          setRecentSignals(status.recentSignals);
          setBalance(status.balance);
          setPl(status.pl);
          setActivePositions(status.activePositions);
          setRecentOrders(status.recentOrders);
          setPositionsSummary({
            active: status.activePositions.length,
            total: status.recentOrders.filter((o: any) => o.status === "FILLED").length
          });
        }
      setLoading(false);
    }
    loadStatus();

    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleAi = async (enabled: boolean) => {
    setIsAiTradingEnabled(enabled);
    const result = await toggleAiTrading(enabled);
    if (result.error) {
      toast.error(result.error);
      setIsAiTradingEnabled(!enabled);
    } else {
      toast.success(`AI Auto-Trading ${enabled ? "enabled" : "disabled"}`);
    }
  };

  const handleTogglePaper = async (enabled: boolean) => {
    setIsPaperTradingEnabled(enabled);
    const result = await togglePaperTrading(enabled);
    if (result.error) {
      toast.error(result.error);
      setIsPaperTradingEnabled(!enabled);
    } else {
      toast.success(`Paper Trading ${enabled ? "enabled" : "disabled"}`);
    }
  };

  const isConnected = connectionStatus === "connected";

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
        </div>
      );
    }

    return (
      <div className="p-2 md:p-4 space-y-2 md:space-y-3 max-w-[1600px] mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-gradient-to-br from-muted/50 to-transparent p-2 md:p-3 rounded-2xl border border-border shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
                <Zap className={cn("size-5 transition-colors", isAiTradingEnabled ? "text-primary fill-primary" : "text-muted-foreground/40")} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg md:text-xl font-bold text-foreground tracking-tight leading-none">
                    AI Trading Dashboard
                  </h1>
                  <Badge variant={isPaperTradingEnabled ? "secondary" : "default"} className={cn(
                    "text-[9px] font-black px-2 py-0.5",
                    isPaperTradingEnabled ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : "bg-green-500/10 text-green-500 border-green-500/20"
                  )}>
                    {isPaperTradingEnabled ? "PAPER MODE" : "LIVE MODE"}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 bg-muted/30 p-1 px-2 rounded-2xl border border-border w-fit">
              <div className="flex items-center gap-2 bg-background/50 rounded-xl p-1 px-3 border border-border/50">
                <Label htmlFor="paper-trading" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer">
                  Paper Mode
                </Label>
                <Switch 
                  id="paper-trading" 
                  checked={isPaperTradingEnabled}
                  onCheckedChange={handleTogglePaper}
                  className="scale-75 data-[state=checked]:bg-yellow-500"
                />
              </div>
              
              <div className="flex items-center gap-2 bg-background/50 rounded-xl p-1 px-3 border border-border/50">
                <Label htmlFor="ai-trading" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer">
                  Auto-Trading
                </Label>
                <Switch 
                  id="ai-trading" 
                  checked={isAiTradingEnabled}
                  onCheckedChange={handleToggleAi}
                  className="scale-75"
                />
              </div>
            </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "Equity Balance", value: `₹${isConnected ? balance.total : "0.00"}`, sub: `Margin: ₹${isConnected ? balance.available : "0.00"}`, icon: Wallet, color: "text-blue-500" },
            { label: "Net P&L", value: `₹${isConnected ? pl.total : "0.00"}`, sub: `Day: ₹${isConnected ? pl.day : "0.00"}`, icon: TrendingUp, color: pl.isPositive ? "text-green-500" : "text-red-500" },
            { label: "Open Positions", value: isConnected ? positionsSummary.active : 0, sub: `${isConnected ? positionsSummary.total : 0} Total Trades`, icon: Briefcase, color: "text-purple-500" }
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(i === 2 && "col-span-2 md:col-span-1")}
            >
              <Card className="bg-card border-border hover:bg-accent/50 transition-all hover:border-primary/20 group cursor-default">
                <CardHeader className="flex flex-row items-center justify-between pb-1">
                  <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</CardTitle>
                  <stat.icon className={cn("size-3.5 opacity-50 group-hover:opacity-100 transition-opacity", stat.color)} />
                </CardHeader>
                <CardContent>
                  <div className={cn("text-xl md:text-2xl font-black tracking-tighter leading-none", stat.color)}>
                    {stat.value}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 font-medium mt-1 uppercase tracking-tight">
                    {stat.sub}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
          <div className="lg:col-span-2">
            <Card className="bg-card border-border overflow-hidden h-full">
                <CardHeader className="flex flex-row items-center justify-between bg-muted/30 border-b border-border py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="size-7 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                      <Activity className="size-3.5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground">Active Positions</CardTitle>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isLiveConnected ? (
                      <div className="flex items-center gap-1 text-green-500">
                        <Wifi className="size-3" />
                        <span className="text-[9px] uppercase font-bold">Live</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <WifiOff className="size-3" />
                      </div>
                    )}
                    <Badge variant="secondary" className="bg-muted text-muted-foreground border-border text-[9px] font-bold">
                      {isConnected ? activePositions.length : 0} OPEN
                    </Badge>
                  </div>
                </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Instrument</TableHead>
                      <TableHead className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Type</TableHead>
                      <TableHead className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Qty</TableHead>
                      <TableHead className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Avg/LTP</TableHead>
                      <TableHead className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-right">M2M P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!isConnected || activePositions.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground/40 text-xs font-medium italic">
                          No active positions found
                        </TableCell>
                      </TableRow>
                      ) : (
                        activePositions.map((pos: any) => {
                          const livePrice = pos.instrument_token ? getPrice(pos.instrument_token) : null;
                          const currentPrice = livePrice || parseFloat(pos.avgPrice) || 0;
                          const avgPrice = parseFloat(pos.avgPrice) || 0;
                          const qty = parseInt(pos.qty) || 0;
                          const isLong = pos.type === "BUY";
                          const unrealizedPnl = livePrice 
                            ? (isLong ? (livePrice - avgPrice) : (avgPrice - livePrice)) * qty 
                            : null;
                          const originalPl = pos.pl?.replace(/[₹+,]/g, '') || '0';
                          const displayPnl = unrealizedPnl !== null ? unrealizedPnl : parseFloat(originalPl);
                          
                          return (
                            <TableRow key={pos.id} className="border-border hover:bg-accent/30 transition-colors cursor-pointer">
                              <TableCell className="font-bold text-foreground text-xs">{pos.symbol}</TableCell>
                              <TableCell>
                                <Badge className={cn(
                                  "text-[8px] font-black px-1.5 py-0 border-none",
                                  pos.type === "BUY" ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                                )}>
                                  {pos.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground font-mono text-[11px]">{pos.qty}</TableCell>
                              <TableCell className="text-[11px] font-mono">
                                <div className="text-muted-foreground/60 text-[9px]">₹{avgPrice.toFixed(2)}</div>
                                <div className={cn(
                                  "font-bold",
                                  livePrice ? (displayPnl >= 0 ? "text-green-500" : "text-red-500") : "text-muted-foreground"
                                )}>
                                  ₹{currentPrice.toFixed(2)}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end">
                                  <span className={cn("font-bold text-xs", displayPnl >= 0 ? "text-green-500" : "text-red-500")}>
                                    {displayPnl >= 0 ? '+' : ''}₹{displayPnl.toFixed(2)}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground/40 font-medium">{pos.plPercent}</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="bg-card border-border h-full overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border py-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                    <History className="size-3.5 text-purple-500" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground">Recent AI Signals</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {recentSignals.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-muted-foreground/40 text-xs font-medium italic">
                      No recent signals
                    </div>
                  ) : (
                    recentSignals.map((signal) => {
                      const statusConfig = SIGNAL_STATUS_CONFIG[signal.signal_status] || SIGNAL_STATUS_CONFIG.PENDING;
                      const StatusIcon = statusConfig.icon;
                      return (
                        <div key={signal.id} className="p-3 hover:bg-accent/30 transition-colors flex items-center justify-between">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground tracking-tight">{signal.tradingsymbol}</span>
                              <span className={cn(
                                "text-[8px] font-black uppercase",
                                signal.direction === "BUY" ? "text-green-500" : "text-red-500"
                              )}>{signal.direction}</span>
                            </div>
                            <span className="text-[9px] text-muted-foreground/40 font-mono">{formatTime(signal.created_at)}</span>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <StatusIcon className={cn("size-3.5", statusConfig.color, signal.signal_status === "EXECUTING" && "animate-spin")} />
                            <div className="flex flex-col items-end">
                              <span className={cn("text-[10px] font-bold", statusConfig.color)}>
                                {statusConfig.label}
                              </span>
                              {signal.status_reason && (
                                <span className="text-[8px] text-muted-foreground/30 max-w-[100px] truncate">
                                  {signal.status_reason}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }
