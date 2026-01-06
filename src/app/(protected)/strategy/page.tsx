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
  Link2,
  Wrench,
  Pencil,
  Trash2,
} from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TradingToolbox } from "@/components/trading-toolbox";
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
    <div className="p-4 md:p-8 pt-6 space-y-6 max-w-7xl mx-auto w-full pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Strategies
          </h1>
          <p className="text-white/50 text-sm">
            Create, backtest, and manage AI-powered analysis strategies.
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          if (v !== "create") setEditingStrategy(null);
        }}
        className="space-y-6"
      >
        <div className="px-0">
          <TabsList className="flex h-auto sm:h-12 items-center justify-between gap-0.5 rounded-xl border border-white/10 bg-white/5 p-1 w-full overflow-x-auto scrollbar-hide">
            <TabsTrigger
              value="active"
              className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
            >
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate w-full text-center sm:text-left">
                Active
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="create"
              className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
            >
              <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate w-full text-center sm:text-left">
                {editingStrategy ? "Edit" : "Create"}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="private"
              className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
            >
              <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate w-full text-center sm:text-left">
                Private
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="public"
              className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
            >
              <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate w-full text-center sm:text-left">
                Public
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="invite-only"
              className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
            >
              <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate w-full text-center sm:text-left">
                Invites
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-6">
          <TabsContent value="active" className="space-y-6 mt-0">
            <ActiveStrategiesTab />
          </TabsContent>

          <TabsContent value="create" className="space-y-6 mt-0">
            <CreateStrategyTab
              initialData={editingStrategy}
              onCancel={handleCancelEdit}
            />
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
  );
}

function ActiveStrategiesTab() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(
    null
  );
  const [signals, setSignals] = useState<Signal[]>([]);
  const [paperTrades, setPaperTrades] = useState<PaperTrade[]>([]);
  const [activeView, setActiveView] = useState<"overview" | "signals" | "trades">(
    "overview"
  );

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
        const activeOnes = (data.strategies || []).filter(
          (s: Strategy) => s.is_active
        );
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
        fetch(`/api/trading/history?strategyId=${id}&limit=10`),
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
      <Card className="bg-white/5 border-white/10">
        <CardContent className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-white/40" />
        </CardContent>
      </Card>
    );
  }

  const selectedStrategy = strategies.find((s) => s.id === selectedStrategyId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <Card className="bg-white/5 border-white/10 lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-white text-sm">Active List</CardTitle>
        </CardHeader>
        <CardContent className="p-2 space-y-1">
          {strategies.length === 0 ? (
            <p className="text-white/20 text-xs p-4 text-center">
              No active strategies
            </p>
          ) : (
            strategies.map((strategy) => (
              <button
                key={strategy.id}
                onClick={() => setSelectedStrategyId(strategy.id)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  selectedStrategyId === strategy.id
                    ? "bg-white/10"
                    : "hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm font-medium truncate">
                    {strategy.name}
                  </span>
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1 h-4 border-white/10 text-white/40"
                  >
                    {strategy.selected_timeframes[0]}
                  </Badge>
                  {strategy.is_paper_trading && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 h-4 border-cyan-500/30 text-cyan-400"
                    >
                      Paper
                    </Badge>
                  )}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10 lg:col-span-3">
        {selectedStrategy ? (
          <>
            <CardHeader className="border-b border-white/5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-lg">
                    {selectedStrategy.name}
                  </CardTitle>
                  <CardDescription className="text-white/40">
                    Monitoring{" "}
                    {selectedStrategy.selected_instruments?.length || 0}{" "}
                    instruments
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end mr-4">
                    <span className="text-[10px] text-white/40 uppercase tracking-wider">
                      Status
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-white text-xs">Active</span>
                      <Switch
                        checked={selectedStrategy.is_active}
                        onCheckedChange={(checked) =>
                          toggleActive(selectedStrategy.id, checked)
                        }
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
                  className={
                    activeView === "overview"
                      ? "bg-white/10 text-white"
                      : "text-white/40"
                  }
                >
                  Overview
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveView("signals")}
                  className={
                    activeView === "signals"
                      ? "bg-white/10 text-white"
                      : "text-white/40"
                  }
                >
                  Live Signals
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveView("trades")}
                  className={
                    activeView === "trades"
                      ? "bg-white/10 text-white"
                      : "text-white/40"
                  }
                >
                  Paper Trades
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {activeView === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                      <p className="text-white/40 text-xs mb-1">Total Signals</p>
                      <p className="text-white text-xl font-bold">
                        {signals.length}
                      </p>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                      <p className="text-white/40 text-xs mb-1">Win Rate</p>
                      <p className="text-green-400 text-xl font-bold">
                        {selectedStrategy.stats?.win_rate?.toFixed(1) || "0.0"}%
                      </p>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                      <p className="text-white/40 text-xs mb-1">Total P&L</p>
                      <p
                        className={`text-xl font-bold ${
                          (selectedStrategy.stats?.net_pnl_percentage || 0) >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {selectedStrategy.stats?.net_pnl_percentage?.toFixed(
                          2
                        ) || "0.00"}
                        %
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <h4 className="text-white text-sm font-medium mb-3">
                      Strategy Description
                    </h4>
                    <p className="text-white/60 text-sm leading-relaxed">
                      {selectedStrategy.description}
                    </p>
                  </div>
                </div>
              )}

              {activeView === "signals" && (
                <div className="space-y-4">
                  {signals.length === 0 ? (
                    <div className="text-center py-12">
                      <Zap className="w-12 h-12 text-white/10 mx-auto mb-4" />
                      <p className="text-white/40">Waiting for live signals...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-white/40 text-xs">
                          <tr className="border-b border-white/5">
                            <th className="text-left py-3">Time</th>
                            <th className="text-left py-3">Type</th>
                            <th className="text-left py-3">Price</th>
                            <th className="text-right py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="text-white/80">
                          {signals.map((signal) => (
                            <tr
                              key={signal.id}
                              className="border-b border-white/5 hover:bg-white/5"
                            >
                              <td className="py-3 text-white/40">
                                {new Date(signal.timestamp).toLocaleTimeString()}
                              </td>
                              <td className="py-3">
                                <Badge
                                  variant="outline"
                                  className={
                                    signal.type === "BUY"
                                      ? "border-green-500/30 text-green-400"
                                      : "border-red-500/30 text-red-400"
                                  }
                                >
                                  {signal.type}
                                </Badge>
                              </td>
                              <td className="py-3">
                                ₹{signal.price.toFixed(2)}
                              </td>
                              <td className="py-3 text-right">
                                <Badge
                                  variant="outline"
                                  className="border-cyan-500/30 text-cyan-400"
                                >
                                  Recorded
                                </Badge>
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
                      <Target className="w-12 h-12 text-white/10 mx-auto mb-4" />
                      <p className="text-white/40">No paper trades recorded yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-white/40 text-xs">
                          <tr className="border-b border-white/5">
                            <th className="text-left py-3">Type</th>
                            <th className="text-left py-3">Entry</th>
                            <th className="text-left py-3">Exit</th>
                            <th className="text-right py-3">P&L</th>
                          </tr>
                        </thead>
                        <tbody className="text-white/80">
                          {paperTrades.map((trade) => (
                            <tr
                              key={trade.id}
                              className="border-b border-white/5 hover:bg-white/5"
                            >
                              <td className="py-3">
                                <Badge
                                  variant="outline"
                                  className={
                                    trade.type === "BUY"
                                      ? "border-green-500/30 text-green-400"
                                      : "border-red-500/30 text-red-400"
                                  }
                                >
                                  {trade.type}
                                </Badge>
                              </td>
                              <td className="py-3">
                                <div>₹{trade.entry_price.toFixed(2)}</div>
                                <div className="text-[10px] text-white/40">
                                  {new Date(trade.entry_time).toLocaleDateString()}
                                </div>
                              </td>
                              <td className="py-3">
                                {trade.status === "OPEN" ? (
                                  <Badge className="bg-cyan-500">OPEN</Badge>
                                ) : (
                                  <>
                                    <div>₹{trade.exit_price?.toFixed(2)}</div>
                                    <div className="text-[10px] text-white/40">
                                      {trade.exit_reason}
                                    </div>
                                  </>
                                )}
                              </td>
                              <td
                                className={`py-3 text-right font-medium ${
                                  (trade.pnl || 0) >= 0
                                    ? "text-green-400"
                                    : "text-red-400"
                                }`}
                              >
                                {trade.status === "CLOSED" ? (
                                  <>
                                    <div>
                                      {(trade.pnl || 0) >= 0 ? "+" : ""}₹
                                      {trade.pnl?.toFixed(2)}
                                    </div>
                                    <div className="text-[10px]">
                                      {trade.pnl_percentage?.toFixed(2)}%
                                    </div>
                                  </>
                                ) : (
                                  "-"
                                )}
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
            <Activity className="w-12 h-12 text-white/10 mb-4" />
            <p className="text-white/40 text-center">
              Select a strategy from the left to view live performance
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

function CreateStrategyTab({ initialData, onCancel }: any) {
  const [step, setStep] = useState("input");
  const [rawInput, setRawInput] = useState("");
  const [strategy, setStrategy] = useState<any>(null);
  const [formatting, setFormatting] = useState(false);

  const formatStrategy = async () => {
    setFormatting(true);
    try {
      const res = await fetch("/api/strategies/format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setStrategy(data.strategy);
        setStep("review");
      }
    } finally {
      setFormatting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6 bg-white/5 p-4 rounded-xl border border-white/10">
        {["input", "review", "backtest", "save"].map((s, i) => (
          <div key={s} className={`flex items-center gap-2 ${step === s ? "text-cyan-400" : "text-white/40"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === s ? "bg-cyan-500 text-white" : "bg-white/10"}`}>{i + 1}</div>
            <span className="text-xs capitalize">{s}</span>
          </div>
        ))}
      </div>

      {step === "input" && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader><CardTitle>Describe Your Strategy</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Textarea 
              value={rawInput} 
              onChange={e => setRawInput(e.target.value)} 
              placeholder="e.g. Buy when RSI < 30 and Close > EMA 20..."
              className="min-h-[200px] bg-white/5 border-white/10 text-white"
            />
            <div className="flex justify-end gap-3">
              <Button onClick={formatStrategy} disabled={formatting || !rawInput.trim()}>
                {formatting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Format with AI
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "review" && strategy && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader><CardTitle>{strategy.name}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <h4 className="text-green-400 font-medium mb-2">BUY Logic</h4>
                <ul className="text-sm text-white/60">
                  {strategy.buy_entry_logic?.conditions?.map((c: any, i: number) => <li key={i}>• {c}</li>)}
                </ul>
              </div>
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <h4 className="text-red-400 font-medium mb-2">SELL Logic</h4>
                <ul className="text-sm text-white/60">
                  {strategy.sell_entry_logic?.conditions?.map((c: any, i: number) => <li key={i}>• {c}</li>)}
                </ul>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setStep("input")}>Edit Idea</Button>
              <Button onClick={() => setStep("backtest")}>Next: Backtest</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PrivateStrategiesTab({ onEdit }: any) {
  const [strategies, setStrategies] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/strategies").then(res => res.json()).then(data => setStrategies(data.strategies || []));
  }, []);

  return (
    <div className="grid gap-4">
      {strategies.map(s => (
        <Card key={s.id} className="bg-white/5 border-white/10 p-4 flex items-center justify-between">
          <div><h3 className="text-white font-medium">{s.name}</h3><p className="text-white/40 text-sm">{s.description}</p></div>
          <Button variant="ghost" size="icon" onClick={() => onEdit(s)}><Pencil className="h-4 w-4" /></Button>
        </Card>
      ))}
    </div>
  );
}

function PublicStrategiesTab() { return <div className="text-white/40 text-center py-12">Marketplace Coming Soon</div>; }
function InviteOnlyTab() { return <div className="text-white/40 text-center py-12">Invites Coming Soon</div>; }

function StrategySection({
  title,
  icon,
  sections,
}: {
  title: string;
  icon: React.ReactNode;
  sections: { label: string; data: StrategyLogic }[];
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-4"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-white font-medium">{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40" />
        )}
      </button>

      {expanded && (
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">
                {section.label}
              </p>
              <div className="text-white/80 text-sm">
                {section.data.description && (
                  <p className="mb-1 text-white/60 italic">
                    {section.data.description}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {section.data.conditions?.map((c, i) => (
                    <li key={i}>
                      •{" "}
                      {typeof c === "string" ? (
                        c
                      ) : (
                        <span className="text-white/40">{JSON.stringify(c)}</span>
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
