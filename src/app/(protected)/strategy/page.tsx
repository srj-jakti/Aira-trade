"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Bot,
  Lock,
  Globe,
  UserCheck,
  Zap,
  Loader2,
  ArrowRight,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Shield,
  Clock,
  Save,
  Play,
  Sparkles,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TradingTool } from "@/lib/trading-tools";

interface StrategyLogic {
  conditions: string[];
  indicators?: string[];
  parameters?: Record<string, number | string>;
  description?: string;
}

interface StructuredStrategy {
  name: string;
  description: string;
  strategy_type?: "SWING" | "INTRADAY" | "SCALPING" | "OPTIONS";
  buy_entry_logic: StrategyLogic;
  buy_stop_loss: StrategyLogic;
  buy_target: StrategyLogic;
  buy_trailing_sl: StrategyLogic;
  sell_entry_logic: StrategyLogic;
  sell_stop_loss: StrategyLogic;
  sell_target: StrategyLogic;
  sell_trailing_sl: StrategyLogic;
  hold_logic: StrategyLogic;
}

interface BacktestResult {
  capital_used: number;
  total_trades: number;
  buy_count: number;
  sell_count: number;
  hold_count: number;
  net_pnl: number;
  net_pnl_percentage: number;
  win_rate: number;
  loss_rate: number;
  max_drawdown: number;
  max_drawdown_percentage: number;
  trade_log: TradeEntry[];
  aiInsights?: AIInsights;
}

interface AIInsights {
  suggestions: string[];
  optimizedParams?: {
    stop_loss_pct?: number;
    target_pct?: number;
    trailing_stop?: boolean;
    additional_filter?: string;
  };
  expectedImprovement: number;
}

interface TradeEntry {
  id: string;
  type: "BUY" | "SELL";
  entry_time: string;
  entry_price: number;
  exit_time?: string;
  exit_price?: number;
  quantity: number;
  pnl?: number;
  pnl_percentage?: number;
  exit_reason?: string;
}

interface Strategy {
  id: number;
  name: string;
  description: string;
  visibility: string;
  is_active: boolean;
  is_paper_trading?: boolean;
  selected_instruments?: number[];
  selected_timeframes: string[];
  created_at: string;
  admin_approved?: boolean;
  creator?: string;
  stats?: {
    win_rate: number;
    net_pnl_percentage: number;
    total_trades: number;
  };
}

interface Signal {
  id: number;
  strategy_id: number;
  instrument_token: number;
  type: "BUY" | "SELL";
  price: number;
  timestamp: string;
}

interface PaperTrade {
  id: number;
  strategy_id: number;
  instrument_token: number;
  type: "BUY" | "SELL";
  entry_price: number;
  entry_time: string;
  exit_price?: number;
  exit_time?: string;
  status: "OPEN" | "CLOSED";
  pnl?: number;
  pnl_percentage?: number;
  exit_reason?: string;
}

const TIMEFRAMES = [
  { value: "5m", label: "5 Min", coverage: "100 Days" },
  { value: "15m", label: "15 Min", coverage: "200 Days" },
  { value: "1h", label: "1 Hour", coverage: "400 Days" },
  { value: "day", label: "Daily", coverage: "5 Years" },
];

export default function StrategyPage() {
  const [activeTab, setActiveTab] = useState("create");
  const [editingStrategy, setEditingStrategy] = useState<any>(null);

  const handleEdit = (strategy: any) => {
    setEditingStrategy(strategy);
    setActiveTab("create");
  };

  const handleCancelEdit = () => {
    setEditingStrategy(null);
    setActiveTab("private");
  };

  return (
    <div className="flex flex-col min-h-screen bg-background overflow-y-auto">
      <div className="flex-1 p-4 md:p-8 pt-6 space-y-6 max-w-7xl mx-auto w-full pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Strategies
            </h1>
            <p className="text-foreground/50 text-sm">
              Create, backtest, and manage AI-powered analysis strategies.
            </p>
          </div>
        </div>

              <Tabs value={activeTab} onValueChange={(v) => {
                setActiveTab(v);
                if (v !== "create") setEditingStrategy(null);
              }} className="space-y-6">
                <div className="px-0">
                  <TabsList className="flex h-auto sm:h-12 items-center justify-between gap-0.5 rounded-xl border border-border bg-muted/50 p-1 w-full overflow-x-auto scrollbar-hide">
                    <TabsTrigger
                      value="active"
                      className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                    >
                      <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="truncate w-full text-center sm:text-left">Active</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="create"
                      className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                    >
                      <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="truncate w-full text-center sm:text-left">
                        {editingStrategy ? "Edit" : "Create"}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="private"
                      className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                    >
                      <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="truncate w-full text-center sm:text-left">Private</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="public"
                      className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                    >
                      <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="truncate w-full text-center sm:text-left">Public</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="invite-only"
                      className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                    >
                      <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="truncate w-full text-center sm:text-left">Invites</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

          <div className="mt-6">
            <TabsContent value="active" className="space-y-6 mt-0">
              <ActiveStrategiesTab />
            </TabsContent>

            <TabsContent value="create" className="space-y-6 mt-0">
              <CreateStrategyTab initialData={editingStrategy} onCancel={handleCancelEdit} />
            </TabsContent>

            <TabsContent value="private" className="space-y-6 mt-0">
              <PrivateStrategiesTab onEdit={handleEdit} />
            </TabsContent>

            <TabsContent value="public" className="space-y-6 mt-0">
              <PublicStrategiesTab />
            </TabsContent>

            <TabsContent value="invite-only" className="space-y-6 mt-0">
              <InviteOnlyTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

function ActiveStrategiesTab() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [paperTrades, setPaperTrades] = useState<PaperTrade[]>([]);
  const [activeView, setActiveView] = useState<"overview" | "signals" | "trades">("overview");

  useEffect(() => {
    fetchActiveStrategies();
  }, []);

  useEffect(() => {
    if (selectedStrategyId) {
      fetchStrategyData(selectedStrategyId);
    }
  }, [selectedStrategyId]);

  const fetchActiveStrategies = async () => {
    try {
      const res = await fetch("/api/strategies");
      if (res.ok) {
        const data = await res.json();
        const activeOnes = (data.strategies || []).filter((s: Strategy) => s.is_active);
        setStrategies(activeOnes);
        if (activeOnes.length > 0 && !selectedStrategyId) {
          setSelectedStrategyId(activeOnes[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStrategyData = async (id: number) => {
    try {
      const [sigRes, tradeRes] = await Promise.all([
        fetch(`/api/ai/signals?strategyId=${id}&limit=10`),
        fetch(`/api/trading/history?strategyId=${id}&limit=10`)
      ]);
      if (sigRes.ok) {
        const data = await sigRes.json();
        setSignals(data.signals || []);
      }
      if (tradeRes.ok) {
        const data = await tradeRes.json();
        setPaperTrades(data.trades || []);
      }
    } catch (err) {
      console.error("Error fetching strategy data:", err);
    }
  };

  const toggleActive = async (id: number, active: boolean) => {
    const res = await fetch(`/api/strategies/${id}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      fetchActiveStrategies();
    }
  };

  if (loading) {
    return (
      <Card className="bg-muted/50 border-border">
        <CardContent className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const selectedStrategy = strategies.find(s => s.id === selectedStrategyId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <Card className="bg-muted/50 border-border lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-foreground text-sm">Active List</CardTitle>
        </CardHeader>
        <CardContent className="p-2 space-y-1">
          {strategies.length === 0 ? (
            <p className="text-foreground/20 text-xs p-4 text-center">No active strategies</p>
          ) : (
            strategies.map((strategy) => (
              <button
                key={strategy.id}
                onClick={() => setSelectedStrategyId(strategy.id)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  selectedStrategyId === strategy.id ? "bg-white/10" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-sm font-medium truncate">{strategy.name}</span>
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] px-1 h-4 border-border text-muted-foreground">
                    {strategy.selected_timeframes[0]}
                  </Badge>
                  {strategy.is_paper_trading && (
                    <Badge variant="outline" className="text-[10px] px-1 h-4 border-cyan-500/30 text-cyan-400">
                      Paper
                    </Badge>
                  )}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/50 border-border lg:col-span-3">
        {selectedStrategy ? (
          <>
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-foreground text-lg">{selectedStrategy.name}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Monitoring {selectedStrategy.selected_instruments?.length || 0} instruments
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end mr-4">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</span>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground text-xs">Active</span>
                      <Switch
                        checked={selectedStrategy.is_active}
                        onCheckedChange={(checked) => toggleActive(selectedStrategy.id, checked)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setActiveView("overview")}
                  className={activeView === "overview" ? "bg-white/10 text-foreground" : "text-muted-foreground"}
                >
                  Overview
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setActiveView("signals")}
                  className={activeView === "signals" ? "bg-white/10 text-foreground" : "text-muted-foreground"}
                >
                  Live Signals
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setActiveView("trades")}
                  className={activeView === "trades" ? "bg-white/10 text-foreground" : "text-muted-foreground"}
                >
                  Paper Trades
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {activeView === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-muted/50 border border-border rounded-xl">
                      <p className="text-muted-foreground text-xs mb-1">Total Signals</p>
                      <p className="text-foreground text-xl font-bold">{signals.length}</p>
                    </div>
                    <div className="p-4 bg-muted/50 border border-border rounded-xl">
                      <p className="text-muted-foreground text-xs mb-1">Win Rate</p>
                      <p className="text-green-400 text-xl font-bold">
                        {selectedStrategy.stats?.win_rate?.toFixed(1) || "0.0"}%
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 border border-border rounded-xl">
                      <p className="text-muted-foreground text-xs mb-1">Total P&L</p>
                      <p className={`text-xl font-bold ${
                        (selectedStrategy.stats?.net_pnl_percentage || 0) >= 0 ? "text-green-400" : "text-red-400"
                      }`}>
                        {selectedStrategy.stats?.net_pnl_percentage?.toFixed(2) || "0.00"}%
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 border border-border rounded-xl">
                    <h4 className="text-foreground text-sm font-medium mb-3">Strategy Description</h4>
                    <p className="text-foreground/60 text-sm leading-relaxed">
                      {selectedStrategy.description}
                    </p>
                  </div>
                </div>
              )}

              {activeView === "signals" && (
                <div className="space-y-4">
                  {signals.length === 0 ? (
                    <div className="text-center py-12">
                      <Zap className="w-12 h-12 text-foreground/10 mx-auto mb-4" />
                      <p className="text-muted-foreground">Waiting for live signals...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-muted-foreground text-xs">
                          <tr className="border-b border-border">
                            <th className="text-left py-3">Time</th>
                            <th className="text-left py-3">Type</th>
                            <th className="text-left py-3">Price</th>
                            <th className="text-right py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="text-foreground/80">
                          {signals.map((signal) => (
                            <tr key={signal.id} className="border-b border-border hover:bg-muted/50">
                              <td className="py-3 text-muted-foreground">
                                {new Date(signal.timestamp).toLocaleTimeString()}
                              </td>
                              <td className="py-3">
                                <Badge variant="outline" className={
                                  signal.type === "BUY" ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"
                                }>
                                  {signal.type}
                                </Badge>
                              </td>
                              <td className="py-3">₹{signal.price.toFixed(2)}</td>
                              <td className="py-3 text-right">
                                <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">Recorded</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeView === "trades" && (
                <div className="space-y-4">
                  {paperTrades.length === 0 ? (
                    <div className="text-center py-12">
                      <Target className="w-12 h-12 text-foreground/10 mx-auto mb-4" />
                      <p className="text-muted-foreground">No paper trades recorded yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-muted-foreground text-xs">
                          <tr className="border-b border-border">
                            <th className="text-left py-3">Type</th>
                            <th className="text-left py-3">Entry</th>
                            <th className="text-left py-3">Exit</th>
                            <th className="text-right py-3">P&L</th>
                          </tr>
                        </thead>
                        <tbody className="text-foreground/80">
                          {paperTrades.map((trade) => (
                            <tr key={trade.id} className="border-b border-border hover:bg-muted/50">
                              <td className="py-3">
                                <Badge variant="outline" className={
                                  trade.type === "BUY" ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"
                                }>
                                  {trade.type}
                                </Badge>
                              </td>
                              <td className="py-3">
                                <div>₹{trade.entry_price.toFixed(2)}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {new Date(trade.entry_time).toLocaleDateString()}
                                </div>
                              </td>
                              <td className="py-3">
                                {trade.status === "OPEN" ? (
                                  <Badge className="bg-cyan-500">OPEN</Badge>
                                ) : (
                                  <>
                                    <div>₹{trade.exit_price?.toFixed(2)}</div>
                                    <div className="text-[10px] text-muted-foreground">{trade.exit_reason}</div>
                                  </>
                                )}
                              </td>
                              <td className={`py-3 text-right font-medium ${
                                (trade.pnl || 0) >= 0 ? "text-green-400" : "text-red-400"
                              }`}>
                                {trade.status === "CLOSED" ? (
                                  <>
                                    <div>{(trade.pnl || 0) >= 0 ? "+" : ""}₹{trade.pnl?.toFixed(2)}</div>
                                    <div className="text-[10px]">{trade.pnl_percentage?.toFixed(2)}%</div>
                                  </>
                                ) : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <Activity className="w-12 h-12 text-foreground/10 mb-4" />
            <p className="text-muted-foreground text-center">
              Select a strategy from the left to view live performance
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

function CreateStrategyTab({
  initialData,
  onCancel
}: {
  initialData?: any;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState<"input" | "review" | "backtest" | "improve" | "save">("input");
  const [rawInput, setRawInput] = useState("");
  const [formatting, setFormatting] = useState(false);
  const [aiAnalysisEnabled, setAiAnalysisEnabled] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [strategy, setStrategy] = useState<StructuredStrategy | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<{ plan_id: string } | null>(null);

  useEffect(() => {
    fetch("/api/subscription")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.subscription) {
          setSubscriptionData({ plan_id: data.subscription.plan_id || "basic" });
        }
      })
      .catch(() => {});
  }, []);

  const canUseInviteOnly = subscriptionData?.plan_id === "elite" || subscriptionData?.plan_id === "admin";

    const updateStrategyParam = (path: string, field: string, value: any) => {
      setStrategy((prev) => {
        if (!prev) return prev;
        const newStrategy = { ...prev };
        const keys = path.split(".");
        let current: any = newStrategy;
        for (let i = 0; i < keys.length; i++) {
          if (!current[keys[i]]) current[keys[i]] = {};
          if (i === keys.length - 1) {
            if (!current[keys[i]].parameters) current[keys[i]].parameters = {};
            current[keys[i]].parameters[field] = value;
          } else {
            current = current[keys[i]];
          }
        }

        // Sync with executable_strategy
        if (newStrategy.executable_strategy) {
          const exec = newStrategy.executable_strategy;
          if (path === "buy_stop_loss" && field === "percentage") {
            if (!exec.buyExit) exec.buyExit = {};
            if (!exec.buyExit.stopLoss) exec.buyExit.stopLoss = { type: "PERCENTAGE" };
            exec.buyExit.stopLoss.value = value;
          }
          if (path === "buy_target" && field === "percentage") {
            if (!exec.buyExit) exec.buyExit = {};
            if (!exec.buyExit.target) exec.buyExit.target = { type: "PERCENTAGE" };
            exec.buyExit.target.value = value;
          }
          if (path === "buy_trailing_sl") {
            if (!exec.buyExit) exec.buyExit = {};
            if (!exec.buyExit.trailingSL) exec.buyExit.trailingSL = { enabled: true };
            if (field === "activation_percent") exec.buyExit.trailingSL.activationPercent = value;
            if (field === "trail_percent") exec.buyExit.trailingSL.trailPercent = value;
            if (field === "enabled") exec.buyExit.trailingSL.enabled = value;
          }
          if (path === "sell_stop_loss" && field === "percentage") {
            if (!exec.sellExit) exec.sellExit = {};
            if (!exec.sellExit.stopLoss) exec.sellExit.stopLoss = { type: "PERCENTAGE" };
            exec.sellExit.stopLoss.value = value;
          }
          if (path === "sell_target" && field === "percentage") {
            if (!exec.sellExit) exec.sellExit = {};
            if (!exec.sellExit.target) exec.sellExit.target = { type: "PERCENTAGE" };
            exec.sellExit.target.value = value;
          }
          if (path === "sell_trailing_sl") {
            if (!exec.sellExit) exec.sellExit = {};
            if (!exec.sellExit.trailingSL) exec.sellExit.trailingSL = { enabled: true };
            if (field === "activation_percent") exec.sellExit.trailingSL.activationPercent = value;
            if (field === "trail_percent") exec.sellExit.trailingSL.trailPercent = value;
            if (field === "enabled") exec.sellExit.trailingSL.enabled = value;
          }
        }

        return { ...newStrategy };
      });
    };

  const [backtestResults, setBacktestResults] = useState<Record<string, BacktestResult>>({});
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>([]);
    const [selectedInstruments, setSelectedInstruments] = useState<Array<{instrument_token: number; tradingsymbol: string}>>([
      { instrument_token: 256265, tradingsymbol: "NIFTY 50" }
    ]);
    const [instrumentSearch, setInstrumentSearch] = useState("");
    const [instruments, setInstruments] = useState<Array<{instrument_token: number; tradingsymbol: string; name: string}>>([]);
    const [backtesting, setBacktesting] = useState(false);
    const [improving, setImproving] = useState(false);
    const [improvementNotes, setImprovementNotes] = useState("");
    const [improvementCount, setImprovementCount] = useState(0);
    const [saving, setSaving] = useState(false);
    const [isPaperTrading, setIsPaperTrading] = useState(false);
    const [visibility, setVisibility] = useState<"private" | "public" | "invite_only">("private");
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [fromDate, setFromDate] = useState(() => {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      return d.toISOString().split("T")[0];
    });
    const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [selectedTf, setSelectedTf] = useState("15m");
    const [showToolbox, setShowToolbox] = useState(false);
    const [referenceInstrument, setReferenceInstrument] = useState("");
  const [refInstrumentSearch, setRefInstrumentSearch] = useState("");
  const [refInstruments, setRefInstruments] = useState<Array<{instrument_token: number; tradingsymbol: string; name: string}>>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);

  useEffect(() => {
    fetchDrafts();
  }, []);

  const fetchDrafts = async () => {
    try {
      const res = await fetch("/api/strategies/drafts");
      if (res.ok) {
        const data = await res.json();
        setDrafts(data.drafts || []);
      }
    } catch (err) {
      console.error("Error fetching drafts:", err);
    }
  };

  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      const res = await fetch("/api/strategies/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: currentDraftId,
          rawInput,
          strategyData: strategy,
          selectedInstruments: selectedInstruments.map(i => i.instrument_token),
          selectedTimeframes,
          backtestResults,
          step,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentDraftId(data.draft.id);
        fetchDrafts();
        alert("Draft saved successfully!");
      }
    } catch (err) {
      alert("Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  const loadDraft = async (draft: any) => {
    setCurrentDraftId(draft.id);
    setRawInput(draft.raw_input || "");
    setStrategy(draft.strategy_data || null);
    setSelectedTimeframes(draft.selected_timeframes || []);
    setBacktestResults(draft.backtest_results || {});
    setStep(draft.step || "input");
    
    if (draft.selected_instruments && draft.selected_instruments.length > 0) {
      await fetchInstrumentsForTokens(draft.selected_instruments);
    }
    
    setShowDrafts(false);
  };

  const deleteDraft = async (draftId: number) => {
    try {
      const res = await fetch(`/api/strategies/drafts?id=${draftId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchDrafts();
        if (currentDraftId === draftId) {
          setCurrentDraftId(null);
        }
      }
    } catch (err) {
      alert("Failed to delete draft");
    }
  };

  useEffect(() => {
    if (initialData) {
      setRawInput(initialData.raw_input || "");
      setStrategy(initialData.strategy_logic || null);
      setSelectedTimeframes(initialData.selected_timeframes || []);
      setIsPaperTrading(initialData.is_paper_trading || false);
      setVisibility(initialData.visibility || "private");
      
      if (initialData.selected_instruments && initialData.selected_instruments.length > 0) {
        fetchInstrumentsForTokens(initialData.selected_instruments);
      }
      
      setStep("review");
    } else {
      resetForm();
    }
  }, [initialData]);

  const fetchInstrumentsForTokens = async (tokens: number[]) => {
    try {
      const results = await Promise.all(
        tokens.map(async (token) => {
          const res = await fetch(`/api/market-data/instruments?search=${token}&limit=1`);
          if (res.ok) {
            const data = await res.json();
            return data.instruments?.[0];
          }
          return null;
        })
      );
      const valid = results.filter(Boolean) as Array<{instrument_token: number; tradingsymbol: string}>;
      setSelectedInstruments(valid.map(i => ({ 
        instrument_token: i.instrument_token, 
        tradingsymbol: i.tradingsymbol 
      })));
    } catch (err) {
      console.error("Error fetching instruments for tokens:", err);
    }
  };

  const searchInstruments = useCallback(async (query: string) => {
    if (query.length < 2) {
      setInstruments([]);
      return;
    }
    const res = await fetch(`/api/market-data/instruments?search=${encodeURIComponent(query)}&limit=10`);
    if (res.ok) {
      const data = await res.json();
      setInstruments(data.instruments || []);
    }
  }, []);

  const searchRefInstruments = useCallback(async (query: string) => {
    if (query.length < 2) {
      setRefInstruments([]);
      return;
    }
    const res = await fetch(`/api/market-data/instruments?search=${encodeURIComponent(query)}&limit=10`);
    if (res.ok) {
      const data = await res.json();
      setRefInstruments(data.instruments || []);
    }
  }, []);

  const handleInsertTool = (tool: TradingTool) => {
    const toolText = `Use ${tool.name} (${tool.shortName})`;
    setRawInput((prev) => {
      if (prev.trim()) {
        return prev + "\n" + toolText;
      }
      return toolText;
    });
  };

  const addInstrument = (inst: {instrument_token: number; tradingsymbol: string; name: string}) => {
    if (selectedInstruments.length >= 2) {
      alert("Maximum 2 instruments allowed per backtest");
      return;
    }
    if (selectedInstruments.some(i => i.instrument_token === inst.instrument_token)) {
      return;
    }
    setSelectedInstruments(prev => [...prev, { instrument_token: inst.instrument_token, tradingsymbol: inst.tradingsymbol }]);
    setInstrumentSearch("");
    setInstruments([]);
  };

  const removeInstrument = (token: number) => {
    setSelectedInstruments(prev => prev.filter(i => i.instrument_token !== token));
  };

    const formatStrategy = async () => {
      if (!rawInput.trim()) return;
      setFormatting(true);
      try {
        const res = await fetch("/api/strategies/format", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            rawInput, 
            aiAnalysisEnabled,
            mode: "traditional",
            currentStrategy: strategy
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setStrategy(data.strategy);
          // Keep rawInput as is for chatbox experience
        } else {
          alert("Failed to format strategy. Please try again.");
        }
      } catch {
        alert("Error formatting strategy");
      } finally {
        setFormatting(false);
      }
    };

    const runBacktest = async (timeframe: string) => {
      if (!strategy || selectedInstruments.length === 0) return;
      setBacktesting(true);
      try {
        const res = await fetch("/api/strategies/preview/backtest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            strategy,
            instrumentTokens: selectedInstruments.map(i => i.instrument_token),
            timeframe,
            capital: 100000,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
            zerodhaConfigId: "b9b6056a-29ca-4327-9d6c-3fbb7b80f223",
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const resultWithInsights = {
            ...data.result,
            aiInsights: data.aiInsights || null
          };
          setBacktestResults((prev) => ({ ...prev, [timeframe]: resultWithInsights }));
          if (step === "input") setStep("backtest");
        } else {
          const error = await res.json();
          alert(error.error || "Backtest failed");
        }
      } catch {
        alert("Error running backtest");
      } finally {
        setBacktesting(false);
      }
    };

    const improveStrategy = async () => {
      const currentResult = backtestResults[selectedTf];
      if (!strategy || !currentResult) {
        alert("Please run a backtest for the selected timeframe first");
        return;
      }
      setImproving(true);
      try {
        const res = await fetch("/api/strategies/preview/improve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ strategy, backtestResults: currentResult }),
        });

      if (res.ok) {
        const data = await res.json();
        setStrategy(data.improved);
        // Ensure notes is a string to prevent React crash
        const notes = typeof data.notes === 'string' 
          ? data.notes 
          : typeof data.notes === 'object' 
            ? JSON.stringify(data.notes) 
            : String(data.notes || "");
        setImprovementNotes(notes);
        setImprovementCount((c) => c + 1);
        setBacktestResults({});
        setStep("improve");
      } else {
        const error = await res.json().catch(() => ({ error: "Failed to improve strategy" }));
        alert(error.error || "Error improving strategy");
      }
    } catch (err) {
      console.error("Improve strategy error:", err);
      alert("Error improving strategy. Please check console.");
    } finally {
      setImproving(false);
    }
  };

  const saveStrategy = async () => {
    if (!strategy || selectedTimeframes.length === 0) return;
    setSaving(true);
    try {
      const url = initialData ? `/api/strategies/${initialData.id}` : "/api/strategies";
      const method = initialData ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy,
          rawInput,
          selectedTimeframes,
          selectedInstruments: selectedInstruments.map(i => i.instrument_token),
          isPaperTrading,
          visibility,
        }),
      });
      if (res.ok) {
        setShowSaveDialog(false);
        resetForm();
        if (onCancel) onCancel();
        alert(initialData ? "Strategy updated successfully!" : (visibility === "private" 
          ? "Strategy saved successfully!" 
          : "Strategy saved and submitted for approval!"));
      }
    } catch {
      alert("Error saving strategy");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setStep("input");
    setRawInput("");
    setStrategy(null);
    setBacktestResults({});
    setSelectedTimeframes([]);
    setSelectedInstruments([]);
    setImprovementNotes("");
    setImprovementCount(0);
    setFromDate("");
    setToDate("");
    setReferenceInstrument("");
    setCurrentDraftId(null);
    if (onCancel && initialData) onCancel();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {currentDraftId && (
            <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
              Draft #{currentDraftId}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {drafts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDrafts(!showDrafts)}
              className="border-border text-foreground/60"
            >
              <Clock className="w-4 h-4 mr-2" />
              Drafts ({drafts.length})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={saveDraft}
            disabled={savingDraft || (!rawInput.trim() && !strategy)}
            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
          >
            {savingDraft ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Draft
          </Button>
        </div>
      </div>

      {showDrafts && drafts.length > 0 && (
        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              Your Drafts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="flex items-center justify-between p-3 bg-muted/50 border border-border rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-foreground text-sm font-medium">{draft.name || "Untitled"}</p>
                  <p className="text-muted-foreground text-xs">
                    Step: {draft.step} • {new Date(draft.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadDraft(draft)}
                    className="text-cyan-400 hover:bg-cyan-500/10"
                  >
                    Continue
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteDraft(draft.id)}
                    className="text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-0.5 mb-6 bg-muted/50 p-1 rounded-xl border border-border overflow-x-auto scrollbar-hide">
        {["input", "backtest", "improve", "save"].map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div
              className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[9px] sm:text-sm font-medium transition-colors shrink-0 ${
                step === s
                  ? "bg-cyan-500 text-foreground shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                  : ["input", "backtest", "improve", "save"].indexOf(step) > i
                  ? "bg-green-500 text-foreground"
                  : "bg-white/10 text-muted-foreground"
              }`}
            >
              {["input", "backtest", "improve", "save"].indexOf(step) > i ? (
                <Check className="w-3 h-3 sm:w-4 sm:h-4" />
              ) : (
                i + 1
              )}
            </div>
            {i < 3 && (
              <div
                className={`flex-1 h-0.5 mx-0.5 sm:mx-2 ${
                  ["input", "backtest", "improve", "save"].indexOf(step) > i
                    ? "bg-green-500"
                    : "bg-white/10"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {step === "input" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card className="bg-muted/50 border-border h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5 text-cyan-400" />
                    Traditional Setup
                  </CardTitle>
                </div>
                <CardDescription className="text-muted-foreground">
                  Specify indicators and crossover logic for your strategy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Example: Buy when RSI(14) crosses above 30 and Price is above EMA(200)..."
                      value={rawInput}
                      onChange={(e) => setRawInput(e.target.value)}
                      className="min-h-[250px] bg-muted/50 border-border text-foreground placeholder:text-foreground/30 resize-none font-mono text-sm"
                    />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted/50 border border-border rounded-xl">
                        <div className="flex items-center gap-3">
                          <Sparkles className="w-4 h-4 text-cyan-400" />
                          <div>
                            <Label className="text-foreground text-sm">Deep AI Analysis</Label>
                            <p className="text-muted-foreground text-[10px]">Optimize logic for higher accuracy</p>
                          </div>
                        </div>
                        <Switch checked={aiAnalysisEnabled} onCheckedChange={setAiAnalysisEnabled} />
                      </div>

                      <div className="p-3 bg-muted/50 border border-border rounded-xl">
                        <Label className="text-foreground/60 text-[10px] uppercase tracking-wider mb-2 block">Reference Instrument (Optional)</Label>
                        <div className="relative">
                          {referenceInstrument ? (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                                {referenceInstrument}
                              </Badge>
                              <button onClick={() => setReferenceInstrument("")} className="text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <Input
                                placeholder="Search index (e.g., NIFTY 50)..."
                                value={refInstrumentSearch}
                                onChange={(e) => {
                                  setRefInstrumentSearch(e.target.value);
                                  searchRefInstruments(e.target.value);
                                }}
                                className="bg-muted/50 border-border text-foreground h-8 text-xs"
                              />
                                {refInstruments.length > 0 && (
                                  <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-32 overflow-y-auto">
                                    {refInstruments.map((inst) => (
                                      <button
                                        key={inst.instrument_token}
                                        className="w-full text-left px-3 py-1.5 hover:bg-muted text-foreground text-xs"
                                        onClick={() => {
                                          setReferenceInstrument(inst.tradingsymbol);
                                          setRefInstrumentSearch("");
                                          setRefInstruments([]);
                                        }}
                                      >
                                        {inst.tradingsymbol}
                                      </button>
                                    ))}
                                  </div>
                                )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button
                          onClick={formatStrategy}
                          disabled={!rawInput.trim() || formatting || generating}
                          className="w-full bg-cyan-500 hover:bg-cyan-600 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                        >
                          {formatting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                          {strategy ? "Refine Strategy" : "Format Logic"}
                        </Button>
                    </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-muted/50 border-border h-full flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-foreground text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  Strategy Preview
                </CardTitle>
                <CardDescription className="text-muted-foreground text-[10px]">
                  Formatted executable strategy output
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {strategy ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                      <h4 className="text-foreground text-sm font-bold mb-1">{strategy.name}</h4>
                      <p className="text-foreground/60 text-xs leading-relaxed">{strategy.description}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <StrategySection
                          title="BUY Side"
                          icon={<TrendingUp className="w-3 h-3 text-green-400" />}
                          onUpdate={updateStrategyParam}
                          sections={[
                            { label: "Entry", data: strategy.buy_entry_logic || { conditions: [] }, path: "buy_entry_logic" },
                            { label: "Stop Loss", data: strategy.buy_stop_loss || { conditions: [] }, path: "buy_stop_loss" },
                            { label: "Target", data: strategy.buy_target || { conditions: [] }, path: "buy_target" },
                            { label: "Trailing SL", data: strategy.buy_trailing_sl || { conditions: [] }, path: "buy_trailing_sl" },
                          ]}
                        />
                        <StrategySection
                          title="SELL Side"
                          icon={<TrendingDown className="w-3 h-3 text-red-400" />}
                          onUpdate={updateStrategyParam}
                          sections={[
                            { label: "Entry", data: strategy.sell_entry_logic || { conditions: [] }, path: "sell_entry_logic" },
                            { label: "Stop Loss", data: strategy.sell_stop_loss || { conditions: [] }, path: "sell_stop_loss" },
                            { label: "Target", data: strategy.sell_target || { conditions: [] }, path: "sell_target" },
                            { label: "Trailing SL", data: strategy.sell_trailing_sl || { conditions: [] }, path: "sell_trailing_sl" },
                          ]}
                        />
                    </div>
                    
                    <Button 
                      onClick={() => setStep("backtest")}
                      className="w-full bg-green-500 hover:bg-green-600 mt-4"
                    >
                      Next: Test Performance
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center border-2 border-dashed border-border rounded-xl p-8">
                    <Sparkles className="w-12 h-12 text-foreground/5 mb-4" />
                    <p className="text-muted-foreground text-sm">Enter your strategy on the left and click "Format Logic" to see the executable preview here.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {(step === "backtest" || step === "improve") && strategy && (
        <div className="space-y-6">
          {improvementNotes && step === "improve" && (
            <Card className="bg-cyan-500/10 border-cyan-500/30">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-cyan-400 mt-0.5" />
                  <div>
                    <h4 className="text-foreground font-medium mb-2">
                      AI Improvement #{improvementCount}
                    </h4>
                    <p className="text-foreground/70 text-sm">{improvementNotes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-muted/50 border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-foreground text-lg">{strategy.name}</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {strategy.description}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep("input")} className="border-border text-foreground/60">
                <Pencil className="w-4 h-4 mr-2" />
                Edit Logic
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <StrategySection
                      title="BUY Side"
                      icon={<TrendingUp className="w-4 h-4 text-green-400" />}
                      onUpdate={updateStrategyParam}
                      sections={[
                        { label: "Entry Logic", data: strategy.buy_entry_logic || { conditions: [] }, path: "buy_entry_logic" },
                        { label: "Stop Loss", data: strategy.buy_stop_loss || { conditions: [] }, path: "buy_stop_loss" },
                        { label: "Target", data: strategy.buy_target || { conditions: [] }, path: "buy_target" },
                        { label: "Trailing SL", data: strategy.buy_trailing_sl || { conditions: [] }, path: "buy_trailing_sl" },
                      ]}
                    />
                    <StrategySection
                      title="SELL Side"
                      icon={<TrendingDown className="w-4 h-4 text-red-400" />}
                      onUpdate={updateStrategyParam}
                      sections={[
                        { label: "Entry Logic", data: strategy.sell_entry_logic || { conditions: [] }, path: "sell_entry_logic" },
                        { label: "Stop Loss", data: strategy.sell_stop_loss || { conditions: [] }, path: "sell_stop_loss" },
                        { label: "Target", data: strategy.sell_target || { conditions: [] }, path: "sell_target" },
                        { label: "Trailing SL", data: strategy.sell_trailing_sl || { conditions: [] }, path: "sell_trailing_sl" },
                      ]}
                    />
                  </div>

                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-yellow-400" />
                    <span className="text-yellow-400 font-medium">Hold / No-Trade Logic</span>
                  </div>
                    <ul className="text-foreground/60 text-sm space-y-1">
                      {strategy.hold_logic?.conditions?.map((c, i) => (
                        <li key={i}>• {typeof c === 'string' ? c : JSON.stringify(c)}</li>
                      )) || <li>• No specific hold conditions</li>}
                    </ul>
                </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/50 border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Backtest Strategy
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Select an instrument and run backtests across different timeframes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Label className="text-foreground/60 mb-2 block">Select Instruments (max 2)</Label>
                {selectedInstruments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedInstruments.map((inst) => (
                      <Badge 
                        key={inst.instrument_token} 
                        className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 cursor-pointer hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30"
                        onClick={() => removeInstrument(inst.instrument_token)}
                      >
                        {inst.tradingsymbol} ×
                      </Badge>
                    ))}
                  </div>
                )}
                <Input
                  placeholder="Search by symbol (e.g., NIFTY, SBIN)..."
                  value={instrumentSearch}
                  onChange={(e) => {
                    setInstrumentSearch(e.target.value);
                    searchInstruments(e.target.value);
                  }}
                  className="bg-muted/50 border-border text-foreground"
                  disabled={selectedInstruments.length >= 2}
                />
                {instruments.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {instruments.map((inst) => (
                      <button
                        key={inst.instrument_token}
                        className="w-full text-left px-4 py-2 hover:bg-muted/50 text-foreground text-sm"
                        onClick={() => addInstrument(inst)}
                      >
                        {inst.tradingsymbol} - {inst.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedInstruments.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-foreground/60 mb-2 block">From Date (optional)</Label>
                      <Input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="bg-muted/50 border-border text-foreground"
                      />
                    </div>
                    <div>
                      <Label className="text-foreground/60 mb-2 block">To Date (optional)</Label>
                      <Input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="bg-muted/50 border-border text-foreground"
                      />
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Leave dates empty to use maximum available data based on timeframe
                  </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {TIMEFRAMES.map((tf) => (
                        <Button
                          key={tf.value}
                          variant="outline"
                          onClick={() => setSelectedTf(tf.value)}
                          className={`border-border text-foreground transition-all ${
                            selectedTf === tf.value 
                              ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]" 
                              : "hover:bg-muted/50"
                          }`}
                        >
                          {selectedTf === tf.value && <Check className="w-4 h-4 mr-2" />}
                          {tf.label}
                        </Button>
                      ))}
                    </div>

                    <Button
                      onClick={() => runBacktest(selectedTf)}
                      disabled={backtesting}
                      className="w-full bg-cyan-500 hover:bg-cyan-600 text-foreground font-bold h-12 text-lg shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                    >
                      {backtesting ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-5 h-5 mr-2 fill-current" />
                      )}
                      Backtest Now
                    </Button>

                </>
              )}

                {backtestResults[selectedTf] && (
                  <div className="space-y-4 mt-6">
                    <BacktestResultCard
                      timeframe={selectedTf}
                      result={backtestResults[selectedTf]}
                    />


                  <div className="flex gap-4 pt-4">
                    <Button
                      onClick={improveStrategy}
                      disabled={improving}
                      className="flex-1 bg-purple-500 hover:bg-purple-600"
                    >
                      {improving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      AI Analyze & Improve Strategy
                    </Button>
                    <Button
                      onClick={() => setShowSaveDialog(true)}
                      className="flex-1 bg-cyan-500 hover:bg-cyan-600"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Finalize & Save Strategy
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="bg-[#1a1a1a] border-border text-foreground">
          <DialogHeader>
            <DialogTitle>{initialData ? "Update Strategy" : "Save Strategy"}</DialogTitle>
            <DialogDescription className="text-foreground/50">
              Select timeframes and visibility for your strategy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-foreground/60 mb-2 block">Select Timeframes</Label>
              <div className="flex flex-wrap gap-2">
                {TIMEFRAMES.map((tf) => (
                  <Button
                    key={tf.value}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedTimeframes((prev) =>
                        prev.includes(tf.value)
                          ? prev.filter((t) => t !== tf.value)
                          : [...prev, tf.value]
                      );
                    }}
                    className={`border-border ${
                      selectedTimeframes.includes(tf.value)
                        ? "bg-cyan-500 border-cyan-500 text-foreground"
                        : "text-foreground/60"
                    }`}
                  >
                    {tf.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
                <Label className="text-foreground/60 mb-2 block">Visibility</Label>
                <Select value={visibility} onValueChange={(v: "private" | "public" | "invite_only") => setVisibility(v)}>
                  <SelectTrigger className="bg-muted/50 border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-border">
                    <SelectItem value="private" className="text-foreground">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        Private - Only you can see
                      </div>
                    </SelectItem>
                    <SelectItem value="public" className="text-foreground">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Public - Visible to everyone (requires approval)
                      </div>
                    </SelectItem>
                    <SelectItem value="invite_only" className="text-foreground" disabled={!canUseInviteOnly}>
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4" />
                        Invite Only - Controlled access {!canUseInviteOnly && "(ELITE Plan)"}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {!canUseInviteOnly && visibility === "invite_only" && (
                  <p className="text-yellow-400 text-xs mt-2">
                    Invite-only strategies require ELITE plan. <a href="/pricing" className="underline">Upgrade now</a>
                  </p>
                )}
              </div>

            <div className="flex items-center justify-between p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-foreground text-sm">Paper Trading</Label>
                <p className="text-muted-foreground text-[10px]">
                  Simulate trades on live data after saving
                </p>
              </div>
              <Switch
                checked={isPaperTrading}
                onCheckedChange={setIsPaperTrading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              className="border-border text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={saveStrategy}
              disabled={saving || selectedTimeframes.length === 0}
              className="bg-cyan-500 hover:bg-cyan-600"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {initialData ? "Update Strategy" : "Save Strategy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StrategySection({
  title,
  icon,
  sections,
  onUpdate,
}: {
  title: string;
  icon: React.ReactNode;
  sections: { label: string; data: StrategyLogic; path?: string }[];
  onUpdate?: (path: string, field: string, value: any) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="p-4 bg-muted/50 border border-border rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-4"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-foreground font-medium">{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.label}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-muted-foreground text-xs uppercase tracking-wider">
                  {section.label}
                </p>
              </div>
              <div className="text-foreground/80 text-sm">
                {section.data.description && (
                  <p className="mb-1 text-foreground/60 italic">{section.data.description}</p>
                )}
                
                {/* Editable Parameters */}
                {section.data.parameters && typeof section.data.parameters === "object" && section.data.parameters !== null && Object.keys(section.data.parameters).length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-2 p-2 bg-muted/50 rounded-lg border border-border">
                    {Object.entries(section.data.parameters).map(([k, v]) => (
                      <div key={k} className="flex flex-col gap-1">
                        <Label className="text-[10px] text-muted-foreground uppercase">{k.replace("_", " ")}</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type={typeof v === "number" ? "number" : "text"}
                            value={String(v)}
                            onChange={(e) => {
                              const newVal = typeof v === "number" ? parseFloat(e.target.value) : e.target.value;
                              if (onUpdate && section.path) {
                                onUpdate(section.path, k, newVal);
                              }
                            }}
                            className="h-7 text-xs bg-white/10 border-border text-foreground px-2"
                            step={typeof v === "number" ? "0.1" : undefined}
                          />
                          {k.toLowerCase().includes("percent") && <span className="text-[10px] text-muted-foreground">%</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <ul className="space-y-0.5">
                  {section.data.conditions?.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-cyan-500 mt-1.5">•</span>
                      {typeof c === 'string' ? (
                        <span>{c}</span>
                      ) : (
                        <span className="text-muted-foreground">
                          {JSON.stringify(c)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EquityCurveChart({ data }: { data: any[] }) {
  const minEquity = Math.min(...data.map(d => d.equity));
  const maxEquity = Math.max(...data.map(d => d.equity));
  const padding = (maxEquity - minEquity) * 0.1 || 1000;

  return (
    <div className="h-[200px] w-full mt-4 bg-muted/30 rounded-lg p-2 border border-border">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis 
            dataKey="time" 
            hide 
          />
          <YAxis 
            hide 
            domain={[minEquity - padding, maxEquity + padding]} 
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(0,0,0,0.9)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            itemStyle={{ color: "#06b6d4" }}
            labelStyle={{ color: "rgba(255,255,255,0.5)" }}
            formatter={(value: number) => [`₹${value.toLocaleString()}`, "Equity"]}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="#06b6d4"
            fillOpacity={1}
            fill="url(#colorEquity)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function BacktestResultCard({ timeframe, result }: { timeframe: string; result: BacktestResult }) {
  const [showTrades, setShowTrades] = useState(false);
  const tf = TIMEFRAMES.find((t) => t.value === timeframe);

  const equityData = useMemo(() => {
    let currentEquity = result.capital_used;
    const data = [{ 
      time: "Start", 
      equity: currentEquity,
      pnl: 0
    }];
    
    (result.trade_log || []).forEach((trade, idx) => {
      currentEquity += (trade.pnl || 0);
      data.push({
        time: new Date(trade.entry_time).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        equity: currentEquity,
        pnl: trade.pnl || 0
      });
    });
    
    return data;
  }, [result]);

  return (
    <div className="p-4 bg-muted/50 border border-border rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
            {tf?.label || timeframe}
          </Badge>
          <span className="text-muted-foreground text-sm">{tf?.coverage} data</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Net P&L</p>
            <div
              className={`text-lg font-bold ${
                result.net_pnl >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {result.net_pnl >= 0 ? "+" : ""}
              ₹{result.net_pnl.toLocaleString()} ({result.net_pnl_percentage.toFixed(2)}%)
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-3 bg-muted/50 rounded-lg border border-border">
          <p className="text-muted-foreground text-xs mb-1">Win Rate</p>
          <p className="text-green-400 text-xl font-bold">{result.win_rate.toFixed(1)}%</p>
          <p className="text-foreground/20 text-[10px]">Total: {result.total_trades} trades</p>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg border border-border">
          <p className="text-muted-foreground text-xs mb-1">P&L / Trade</p>
          <p className={`text-xl font-bold ${result.net_pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            ₹{(result.net_pnl / (result.total_trades || 1)).toFixed(0)}
          </p>
          <p className="text-foreground/20 text-[10px]">Avg per position</p>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg border border-border">
          <p className="text-muted-foreground text-xs mb-1">Max Drawdown</p>
          <p className="text-red-400 text-xl font-bold">{result.max_drawdown_percentage.toFixed(1)}%</p>
          <p className="text-foreground/20 text-[10px]">₹{result.max_drawdown.toLocaleString()}</p>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg border border-border">
          <p className="text-muted-foreground text-xs mb-1">Capital Used</p>
          <p className="text-foreground text-xl font-bold">₹{result.capital_used.toLocaleString()}</p>
          <p className="text-foreground/20 text-[10px]">Total exposure</p>
        </div>
      </div>

      <EquityCurveChart data={equityData} />

      <div className="flex gap-4 mt-4 text-xs">
        <span className="text-muted-foreground">
          Profit Trades: <span className="text-green-400">{Math.round(result.total_trades * result.win_rate / 100)}</span>
        </span>
        <span className="text-muted-foreground">
          Loss Trades: <span className="text-red-400">{Math.round(result.total_trades * result.loss_rate / 100)}</span>
        </span>
        <span className="text-muted-foreground">
          Hold: <span className="text-foreground/60">{result.hold_count}</span>
        </span>
      </div>

      <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTrades(!showTrades)}
          className="mt-4 text-muted-foreground hover:text-foreground h-8"
        >
          {showTrades ? "Hide" : "Show"} Position Log ({(result.trade_log || []).length})
        </Button>

        {/* AI Insights Panel */}
        {result.aiInsights && result.aiInsights.suggestions && result.aiInsights.suggestions.length > 0 && (
          <div className="mt-4 p-4 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-purple-400" />
              <span className="text-foreground font-medium text-sm">AI Trading Engine Insights</span>
              {result.aiInsights.expectedImprovement > 0 && (
                <Badge className="bg-green-500/20 text-green-400 border-none text-[10px]">
                  +{result.aiInsights.expectedImprovement}% Expected
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              {result.aiInsights.suggestions.map((suggestion, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-foreground/70">
                  <Sparkles className="w-3 h-3 text-cyan-400 mt-0.5 shrink-0" />
                  <span>{suggestion}</span>
                </div>
              ))}
            </div>
            {result.aiInsights.optimizedParams && (
              <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-2">
                {result.aiInsights.optimizedParams.stop_loss_pct && (
                  <div className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-[10px] text-muted-foreground">Stop Loss</p>
                    <p className="text-sm font-bold text-red-400">{result.aiInsights.optimizedParams.stop_loss_pct}%</p>
                  </div>
                )}
                {result.aiInsights.optimizedParams.target_pct && (
                  <div className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-[10px] text-muted-foreground">Target</p>
                    <p className="text-sm font-bold text-green-400">{result.aiInsights.optimizedParams.target_pct}%</p>
                  </div>
                )}
                {result.aiInsights.optimizedParams.trailing_stop && (
                  <div className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-[10px] text-muted-foreground">Trailing SL</p>
                    <p className="text-sm font-bold text-yellow-400">Enabled</p>
                  </div>
                )}
                {result.aiInsights.optimizedParams.additional_filter && (
                  <div className="p-2 bg-muted/50 rounded text-center col-span-2 md:col-span-1">
                    <p className="text-[10px] text-muted-foreground">Filter</p>
                    <p className="text-xs font-medium text-cyan-400">{result.aiInsights.optimizedParams.additional_filter}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {showTrades && result.trade_log && (
        <div className="mt-4 overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-[10px] uppercase tracking-wider bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2">S.No</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Qty</th>
                <th className="text-left px-4 py-2">Entry</th>
                <th className="text-left px-4 py-2">Exit (Reason)</th>
                <th className="text-right px-4 py-2">P&L</th>
              </tr>
            </thead>
            <tbody className="text-foreground/80">
              {result.trade_log.map((trade, idx) => (
                <tr key={trade.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-foreground/30 text-xs">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-5 ${
                        trade.type === "BUY"
                          ? "border-green-500/30 text-green-400"
                          : "border-red-500/30 text-red-400"
                      }`}
                    >
                      {trade.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-foreground/60 font-mono text-xs">
                    {trade.quantity}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-xs">₹{trade.entry_price.toFixed(2)}</div>
                    <div className="text-foreground/30 text-[9px]">
                      {new Date(trade.entry_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-xs">₹{trade.exit_price?.toFixed(2) || "-"}</div>
                    <div className={`text-[9px] ${
                      trade.exit_reason?.includes("Stop Loss") ? "text-red-400/70" : 
                      trade.exit_reason?.includes("Target") ? "text-green-400/70" : "text-foreground/30"
                    }`}>
                      {trade.exit_reason || "-"}
                    </div>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-bold text-xs ${
                      (trade.pnl || 0) >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    <div>{(trade.pnl || 0) >= 0 ? "+" : ""}₹{trade.pnl?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="text-[10px] opacity-70 font-normal">{trade.pnl_percentage?.toFixed(2)}%</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PrivateStrategiesTab({ onEdit }: { onEdit?: (strategy: any) => void }) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchStrategies();
  }, []);

  const fetchStrategies = async () => {
    try {
      const res = await fetch("/api/strategies");
      if (res.ok) {
        const data = await res.json();
        setStrategies(data.strategies || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: number, active: boolean) => {
    const res = await fetch(`/api/strategies/${id}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      fetchStrategies();
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/strategies/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setStrategies(prev => prev.filter(s => s.id !== id));
        setDeletingId(null);
      }
    } catch (err) {
      alert("Error deleting strategy");
    }
  };

  if (loading) {
    return (
      <Card className="bg-muted/50 border-border">
        <CardContent className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-muted/50 border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-lg">Private Strategies</CardTitle>
          <CardDescription className="text-muted-foreground">
            Your personal strategies. Toggle to activate for AI analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {strategies.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-border rounded-xl">
              <Lock className="w-12 h-12 text-foreground/10 mb-4" />
              <p className="text-muted-foreground">No private strategies saved</p>
              <p className="text-foreground/20 text-sm mt-1">
                Create your first strategy in the Create AI tab
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {strategies.map((strategy) => (
                <div
                  key={strategy.id}
                  className="p-4 bg-muted/50 border border-border rounded-xl"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-foreground font-medium">{strategy.name}</h3>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            strategy.visibility === "private"
                              ? "border-white/20 text-muted-foreground"
                              : strategy.visibility === "public"
                              ? "border-green-500/30 text-green-400"
                              : "border-purple-500/30 text-purple-400"
                          }`}
                        >
                          {strategy.visibility === "invite_only" ? "Invite Only" : strategy.visibility}
                        </Badge>
                        {strategy.visibility !== "private" && !strategy.admin_approved && (
                          <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-400">
                            Pending Approval
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm mt-1">{strategy.description}</p>
                      <div className="flex gap-2 mt-2">
                        {strategy.selected_timeframes?.map((tf) => (
                          <Badge
                            key={tf}
                            variant="outline"
                            className="text-xs border-border text-foreground/50"
                          >
                            {TIMEFRAMES.find((t) => t.value === tf)?.label || tf}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 mr-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/10"
                          onClick={() => onEdit?.(strategy)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                          onClick={() => setDeletingId(strategy.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Status</p>
                        <Switch
                          checked={strategy.is_active}
                          onCheckedChange={(checked) => toggleActive(strategy.id, checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="bg-[#1a1a1a] border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/50">
              This will permanently delete the strategy and stop all active scanning/trading associated with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted/50 border-border text-foreground hover:bg-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-red-500 hover:bg-red-600 text-foreground border-none"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PublicStrategiesTab() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicStrategies();
  }, []);

  const fetchPublicStrategies = async () => {
    try {
      const res = await fetch("/api/strategies/public");
      if (res.ok) {
        const data = await res.json();
        setStrategies((data.strategies || []).filter((s: Strategy) => s.visibility === "public"));
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-muted/50 border-border">
        <CardContent className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-muted/50 border-border">
      <CardHeader>
        <CardTitle className="text-foreground text-lg">Public Marketplace</CardTitle>
        <CardDescription className="text-muted-foreground">
          Discover strategies shared by the community.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {strategies.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-border rounded-xl">
            <Globe className="w-12 h-12 text-foreground/10 mb-4" />
            <p className="text-muted-foreground">No public strategies available yet</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {strategies.map((strategy) => (
              <div
                key={strategy.id}
                className="p-4 bg-muted/50 border border-border rounded-xl"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-foreground font-medium">{strategy.name}</h3>
                  <Badge variant="outline" className="border-green-500/30 text-green-400">
                    Public
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm mb-3">{strategy.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-foreground/30 text-xs">by {strategy.creator}</span>
                  {strategy.stats && (
                    <div className="flex gap-3 text-xs">
                      <span className="text-green-400">
                        {strategy.stats.win_rate?.toFixed(0)}% Win
                      </span>
                      <span className={strategy.stats.net_pnl_percentage >= 0 ? "text-green-400" : "text-red-400"}>
                        {strategy.stats.net_pnl_percentage >= 0 ? "+" : ""}
                        {strategy.stats.net_pnl_percentage?.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InviteOnlyTab() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [accessData, setAccessData] = useState<{
    incomingRequests: unknown[];
    myRequests: unknown[];
    myGrants: unknown[];
  }>({ incomingRequests: [], myRequests: [], myGrants: [] });
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"browse" | "requests" | "manage">("browse");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [publicRes, accessRes] = await Promise.all([
        fetch("/api/strategies/public"),
        fetch("/api/strategies/access"),
      ]);

      if (publicRes.ok) {
        const data = await publicRes.json();
        setStrategies((data.strategies || []).filter((s: Strategy) => s.visibility === "invite_only"));
      }

      if (accessRes.ok) {
        const data = await accessRes.json();
        setAccessData(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const requestAccess = async (strategyId: number) => {
    const res = await fetch("/api/strategies/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategyId, message: "I would like access to this strategy." }),
    });
    if (res.ok) {
      alert("Access request sent!");
      fetchData();
    } else {
      const error = await res.json();
      alert(error.error || "Failed to request access");
    }
  };

  const handleRequest = async (requestId: number, action: "approve" | "reject") => {
    const res = await fetch(`/api/strategies/access/${requestId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      fetchData();
    }
  };

  if (loading) {
    return (
      <Card className="bg-muted/50 border-border">
        <CardContent className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button
          variant={activeSubTab === "browse" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSubTab("browse")}
          className={activeSubTab === "browse" ? "bg-cyan-500" : "border-border text-foreground/60"}
        >
          Browse
        </Button>
        <Button
          variant={activeSubTab === "requests" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSubTab("requests")}
          className={activeSubTab === "requests" ? "bg-cyan-500" : "border-border text-foreground/60"}
        >
          My Requests
        </Button>
        <Button
          variant={activeSubTab === "manage" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSubTab("manage")}
          className={activeSubTab === "manage" ? "bg-cyan-500" : "border-border text-foreground/60"}
        >
          Manage Invites
          {accessData.incomingRequests.length > 0 && (
            <Badge className="ml-2 bg-red-500">{accessData.incomingRequests.length}</Badge>
          )}
        </Button>
      </div>

      {activeSubTab === "browse" && (
        <Card className="bg-muted/50 border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-lg">Invite-Only Strategies</CardTitle>
            <CardDescription className="text-muted-foreground">
              Request access to exclusive strategies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {strategies.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-border rounded-xl">
                <UserCheck className="w-12 h-12 text-foreground/10 mb-4" />
                <p className="text-muted-foreground">No invite-only strategies available</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {strategies.map((strategy) => (
                  <div
                    key={strategy.id}
                    className="p-4 bg-muted/50 border border-border rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-purple-400" />
                        <h3 className="text-foreground font-medium">{strategy.name}</h3>
                      </div>
                      <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                        Invite Only
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm mb-3">{strategy.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground/30 text-xs">by {strategy.creator}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => requestAccess(strategy.id)}
                        className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                      >
                        Request Access
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSubTab === "requests" && (
        <Card className="bg-muted/50 border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-lg">My Access Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {accessData.myRequests.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No access requests</p>
            ) : (
              <div className="space-y-3">
                {accessData.myRequests.map((req: any) => (
                  <div key={req.id} className="p-3 bg-muted/50 border border-border rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-foreground">{req.strategies?.name}</p>
                      <p className="text-muted-foreground text-sm">Status: {req.status}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        req.status === "approved"
                          ? "border-green-500/30 text-green-400"
                          : req.status === "rejected"
                          ? "border-red-500/30 text-red-400"
                          : "border-yellow-500/30 text-yellow-400"
                      }
                    >
                      {req.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSubTab === "manage" && (
        <Card className="bg-muted/50 border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-lg">Manage Invite Requests</CardTitle>
            <CardDescription className="text-muted-foreground">
              Approve or reject access requests for your invite-only strategies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accessData.incomingRequests.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No pending requests</p>
            ) : (
              <div className="space-y-3">
                {accessData.incomingRequests.map((req: any) => (
                  <div key={req.id} className="p-4 bg-muted/50 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-foreground font-medium">{req.profiles?.username || req.profiles?.email}</p>
                        <p className="text-muted-foreground text-sm">Requesting: {req.strategies?.name}</p>
                      </div>
                      <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                        {req.status}
                      </Badge>
                    </div>
                    {req.message && (
                      <p className="text-foreground/60 text-sm mb-3 italic">&quot;{req.message}&quot;</p>
                    )}
                    {req.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleRequest(req.id, "approve")}
                          className="bg-green-500 hover:bg-green-600"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequest(req.id, "reject")}
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
