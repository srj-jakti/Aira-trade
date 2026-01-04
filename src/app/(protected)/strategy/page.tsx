"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Bot,
  Lock,
  Globe,
  UserCheck,
  Zap,
  Send,
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
  RefreshCw,
  Save,
  Play,
  Sparkles,
  Eye,
  EyeOff,
  Users,
  Calendar,
  Link2,
  Wrench,
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

  return (
    <div className="flex flex-col h-full bg-[#030303]">
      <div className="flex-1 p-4 md:p-8 pt-6 space-y-6 max-w-7xl mx-auto w-full">
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

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <div className="px-0">
                <TabsList className="flex h-auto sm:h-12 items-center justify-between gap-0.5 rounded-xl border border-white/10 bg-white/5 p-1 w-full overflow-x-auto scrollbar-hide">
                  <TabsTrigger
                    value="active"
                    className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                  >
                    <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="truncate w-full text-center sm:text-left">Active</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="create"
                    className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                  >
                    <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="truncate w-full text-center sm:text-left">Create</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="private"
                    className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                  >
                    <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="truncate w-full text-center sm:text-left">Private</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="public"
                    className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                  >
                    <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="truncate w-full text-center sm:text-left">Public</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="invite-only"
                    className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
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
              <CreateStrategyTab />
            </TabsContent>

            <TabsContent value="private" className="space-y-6 mt-0">
              <PrivateStrategiesTab />
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
      <Card className="bg-white/5 border-white/10">
        <CardContent className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-white/40" />
        </CardContent>
      </Card>
    );
  }

  const selectedStrategy = strategies.find(s => s.id === selectedStrategyId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <Card className="bg-white/5 border-white/10 lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-white text-sm">Active List</CardTitle>
        </CardHeader>
        <CardContent className="p-2 space-y-1">
          {strategies.length === 0 ? (
            <p className="text-white/20 text-xs p-4 text-center">No active strategies</p>
          ) : (
            strategies.map((strategy) => (
              <button
                key={strategy.id}
                onClick={() => setSelectedStrategyId(strategy.id)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  selectedStrategyId === strategy.id ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm font-medium truncate">{strategy.name}</span>
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] px-1 h-4 border-white/10 text-white/40">
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

      <Card className="bg-white/5 border-white/10 lg:col-span-3">
        {selectedStrategy ? (
          <>
            <CardHeader className="border-b border-white/5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-lg">{selectedStrategy.name}</CardTitle>
                  <CardDescription className="text-white/40">
                    Monitoring {selectedStrategy.selected_instruments?.length || 0} instruments
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end mr-4">
                    <span className="text-[10px] text-white/40 uppercase tracking-wider">Status</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white text-xs">Active</span>
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
                  className={activeView === "overview" ? "bg-white/10 text-white" : "text-white/40"}
                >
                  Overview
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setActiveView("signals")}
                  className={activeView === "signals" ? "bg-white/10 text-white" : "text-white/40"}
                >
                  Live Signals
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setActiveView("trades")}
                  className={activeView === "trades" ? "bg-white/10 text-white" : "text-white/40"}
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
                      <p className="text-white text-xl font-bold">{signals.length}</p>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                      <p className="text-white/40 text-xs mb-1">Win Rate</p>
                      <p className="text-green-400 text-xl font-bold">
                        {selectedStrategy.stats?.win_rate?.toFixed(1) || "0.0"}%
                      </p>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                      <p className="text-white/40 text-xs mb-1">Total P&L</p>
                      <p className={`text-xl font-bold ${
                        (selectedStrategy.stats?.net_pnl_percentage || 0) >= 0 ? "text-green-400" : "text-red-400"
                      }`}>
                        {selectedStrategy.stats?.net_pnl_percentage?.toFixed(2) || "0.00"}%
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <h4 className="text-white text-sm font-medium mb-3">Strategy Description</h4>
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
                            <tr key={signal.id} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-3 text-white/40">
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
                            <tr key={trade.id} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-3">
                                <Badge variant="outline" className={
                                  trade.type === "BUY" ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"
                                }>
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
                                    <div className="text-[10px] text-white/40">{trade.exit_reason}</div>
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

function CreateStrategyTab() {
  const [step, setStep] = useState<"input" | "review" | "backtest" | "improve" | "save">("input");
  const [rawInput, setRawInput] = useState("");
  const [formatting, setFormatting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [strategy, setStrategy] = useState<StructuredStrategy | null>(null);
  const [backtestResults, setBacktestResults] = useState<Record<string, BacktestResult>>({});
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>([]);
  const [selectedInstruments, setSelectedInstruments] = useState<Array<{instrument_token: number; tradingsymbol: string}>>([]);
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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedTf, setSelectedTf] = useState("15m");
  const [showToolbox, setShowToolbox] = useState(false);
  const [referenceInstrument, setReferenceInstrument] = useState("");
  const [refInstrumentSearch, setRefInstrumentSearch] = useState("");
  const [refInstruments, setRefInstruments] = useState<Array<{instrument_token: number; tradingsymbol: string; name: string}>>([]);

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
        body: JSON.stringify({ rawInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setStrategy(data.strategy);
        setStep("review");
      } else {
        alert("Failed to format strategy. Please try again.");
      }
    } catch {
      alert("Error formatting strategy");
    } finally {
      setFormatting(false);
    }
  };

  const generateStrategy = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInput: rawInput.trim() || undefined,
          referenceInstrument: referenceInstrument || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRawInput(data.strategy);
      } else {
        alert("Failed to generate strategy. Please try again.");
      }
    } catch {
      alert("Error generating strategy");
    } finally {
      setGenerating(false);
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
          zerodhaConfigId: "b9b6056a-29ca-4327-9d6c-3fbb7b80f223", // Using ACCOUNT 3 as requested
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBacktestResults((prev) => ({ ...prev, [timeframe]: data.result }));
        if (step === "review") setStep("backtest");
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
    if (!strategy || Object.keys(backtestResults).length === 0) return;
    setImproving(true);
    try {
      const latestBacktest = Object.values(backtestResults)[0];
      const res = await fetch("/api/strategies/preview/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, backtestResults: latestBacktest }),
      });
      if (res.ok) {
        const data = await res.json();
        setStrategy(data.improved);
        setImprovementNotes(data.notes);
        setImprovementCount((c) => c + 1);
        setBacktestResults({});
        setStep("improve");
      }
    } catch {
      alert("Error improving strategy");
    } finally {
      setImproving(false);
    }
  };

  const saveStrategy = async () => {
    if (!strategy || selectedTimeframes.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/strategies", {
        method: "POST",
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
        alert(visibility === "private" 
          ? "Strategy saved successfully!" 
          : "Strategy saved and submitted for approval!");
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
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-0.5 mb-6 bg-white/5 p-1 rounded-xl border border-white/10 overflow-x-auto scrollbar-hide">
        {["input", "review", "backtest", "improve", "save"].map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div
              className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[9px] sm:text-sm font-medium transition-colors shrink-0 ${
                step === s
                  ? "bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                  : ["input", "review", "backtest", "improve", "save"].indexOf(step) > i
                  ? "bg-green-500 text-white"
                  : "bg-white/10 text-white/40"
              }`}
            >
              {["input", "review", "backtest", "improve", "save"].indexOf(step) > i ? (
                <Check className="w-3 h-3 sm:w-4 sm:h-4" />
              ) : (
                i + 1
              )}
            </div>
            {i < 4 && (
              <div
                className={`flex-1 h-0.5 mx-0.5 sm:mx-2 ${
                  ["input", "review", "backtest", "improve", "save"].indexOf(step) > i
                    ? "bg-green-500"
                    : "bg-white/10"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {step === "input" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-white/5 border-white/10 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Bot className="w-5 h-5 text-cyan-400" />
                Describe Your Strategy
              </CardTitle>
              <CardDescription className="text-white/40">
                Write your trading idea in any form - even incomplete or unclear. Our AI will convert it into a complete, executable strategy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Example: Buy when RSI is low and price is above 20 SMA. Use 2% stop loss and 4% target. Avoid trading during high volatility..."
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                className="min-h-[200px] bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
              />

              <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                <Label className="text-white/60 text-sm mb-2 flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Reference Instrument (Optional)
                </Label>
                <p className="text-white/40 text-xs mb-2">
                  For options/futures trading, reference index price for entry signals
                </p>
                <div className="relative">
                  {referenceInstrument ? (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                        {referenceInstrument}
                      </Badge>
                      <button
                        onClick={() => setReferenceInstrument("")}
                        className="text-white/40 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Input
                        placeholder="Search index (e.g., NIFTY 50, BANKNIFTY)..."
                        value={refInstrumentSearch}
                        onChange={(e) => {
                          setRefInstrumentSearch(e.target.value);
                          searchRefInstruments(e.target.value);
                        }}
                        className="bg-white/5 border-white/10 text-white h-9 text-sm"
                      />
                      {refInstruments.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl max-h-32 overflow-y-auto">
                          {refInstruments.map((inst) => (
                            <button
                              key={inst.instrument_token}
                              className="w-full text-left px-3 py-1.5 hover:bg-white/5 text-white text-sm"
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

              <div className="flex flex-wrap justify-end gap-3">
                <Sheet open={showToolbox} onOpenChange={setShowToolbox}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-white/10 text-white/60 hover:bg-white/5 lg:hidden"
                    >
                      <Wrench className="w-4 h-4 mr-2" />
                      Toolbox
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="bg-slate-900 border-slate-700 w-80">
                    <SheetHeader>
                      <SheetTitle className="text-white">Trading Toolbox</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4">
                      <TradingToolbox onInsertTool={handleInsertTool} />
                    </div>
                  </SheetContent>
                </Sheet>
                <Button
                  variant="outline"
                  onClick={generateStrategy}
                  disabled={generating || formatting}
                  className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  AI Generation
                </Button>
                <Button
                  onClick={formatStrategy}
                  disabled={!rawInput.trim() || formatting || generating}
                  className="bg-cyan-500 hover:bg-cyan-600"
                >
                  {formatting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Format with AI
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="hidden lg:block">
            <TradingToolbox onInsertTool={handleInsertTool} />
          </div>
        </div>
      )}

      {(step === "review" || step === "backtest" || step === "improve") && strategy && (
        <div className="space-y-6">
          {improvementNotes && step === "improve" && (
            <Card className="bg-cyan-500/10 border-cyan-500/30">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-cyan-400 mt-0.5" />
                  <div>
                    <h4 className="text-white font-medium mb-2">
                      AI Improvement #{improvementCount}
                    </h4>
                    <p className="text-white/70 text-sm">{improvementNotes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white text-lg">{strategy.name}</CardTitle>
                <CardDescription className="text-white/40">
                  {strategy.description}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={resetForm} className="border-white/10 text-white/60">
                <X className="w-4 h-4 mr-2" />
                Start Over
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StrategySection
                  title="BUY Side"
                  icon={<TrendingUp className="w-4 h-4 text-green-400" />}
                  sections={[
                    { label: "Entry Logic", data: strategy.buy_entry_logic },
                    { label: "Stop Loss", data: strategy.buy_stop_loss },
                    { label: "Target", data: strategy.buy_target },
                    { label: "Trailing SL", data: strategy.buy_trailing_sl },
                  ]}
                />
                <StrategySection
                  title="SELL Side"
                  icon={<TrendingDown className="w-4 h-4 text-red-400" />}
                  sections={[
                    { label: "Entry Logic", data: strategy.sell_entry_logic },
                    { label: "Stop Loss", data: strategy.sell_stop_loss },
                    { label: "Target", data: strategy.sell_target },
                    { label: "Trailing SL", data: strategy.sell_trailing_sl },
                  ]}
                />
              </div>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400 font-medium">Hold / No-Trade Logic</span>
                </div>
                <ul className="text-white/60 text-sm space-y-1">
                  {strategy.hold_logic.conditions?.map((c, i) => (
                    <li key={i}>• {c}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Backtest Strategy
              </CardTitle>
              <CardDescription className="text-white/40">
                Select an instrument and run backtests across different timeframes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Label className="text-white/60 mb-2 block">Select Instruments (max 2)</Label>
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
                  className="bg-white/5 border-white/10 text-white"
                  disabled={selectedInstruments.length >= 2}
                />
                {instruments.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {instruments.map((inst) => (
                      <button
                        key={inst.instrument_token}
                        className="w-full text-left px-4 py-2 hover:bg-white/5 text-white text-sm"
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
                      <Label className="text-white/60 mb-2 block">From Date (optional)</Label>
                      <Input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-white/60 mb-2 block">To Date (optional)</Label>
                      <Input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                  </div>
                  <p className="text-white/40 text-xs">
                    Leave dates empty to use maximum available data based on timeframe
                  </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {TIMEFRAMES.map((tf) => (
                        <Button
                          key={tf.value}
                          variant="outline"
                          onClick={() => setSelectedTf(tf.value)}
                          className={`border-white/10 text-white transition-all ${
                            selectedTf === tf.value 
                              ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]" 
                              : "hover:bg-white/5"
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
                      className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold h-12 text-lg shadow-[0_0_20px_rgba(6,182,212,0.3)]"
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

              {Object.keys(backtestResults).length > 0 && (
                <div className="space-y-4 mt-6">
                  {Object.entries(backtestResults).map(([timeframe, result]) => (
                    <BacktestResultCard
                      key={timeframe}
                      timeframe={timeframe}
                      result={result}
                    />
                  ))}

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
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Save Strategy</DialogTitle>
            <DialogDescription className="text-white/50">
              Select timeframes and visibility for your strategy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-white/60 mb-2 block">Select Timeframes</Label>
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
                    className={`border-white/10 ${
                      selectedTimeframes.includes(tf.value)
                        ? "bg-cyan-500 border-cyan-500 text-white"
                        : "text-white/60"
                    }`}
                  >
                    {tf.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-white/60 mb-2 block">Visibility</Label>
              <Select value={visibility} onValueChange={(v: "private" | "public" | "invite_only") => setVisibility(v)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="private" className="text-white">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Private - Only you can see
                    </div>
                  </SelectItem>
                  <SelectItem value="public" className="text-white">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Public - Visible to everyone (requires approval)
                    </div>
                  </SelectItem>
                  <SelectItem value="invite_only" className="text-white">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4" />
                      Invite Only - Controlled access (requires approval)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-white text-sm">Paper Trading</Label>
                <p className="text-white/40 text-[10px]">
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
              className="border-white/10 text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={saveStrategy}
              disabled={saving || selectedTimeframes.length === 0}
              className="bg-cyan-500 hover:bg-cyan-600"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Strategy
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
                  <p className="mb-1 text-white/60 italic">{section.data.description}</p>
                )}
                <ul className="space-y-0.5">
                  {section.data.conditions?.map((c, i) => (
                    <li key={i}>• {c}</li>
                  ))}
                </ul>
                {section.data.parameters && Object.keys(section.data.parameters).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(section.data.parameters).map(([k, v]) => (
                      <Badge key={k} variant="outline" className="text-xs border-white/10 text-white/50">
                        {k}: {v}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BacktestResultCard({ timeframe, result }: { timeframe: string; result: BacktestResult }) {
  const [showTrades, setShowTrades] = useState(false);
  const tf = TIMEFRAMES.find((t) => t.value === timeframe);

  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
            {tf?.label || timeframe}
          </Badge>
          <span className="text-white/40 text-sm">{tf?.coverage} data</span>
        </div>
        <div
          className={`text-lg font-bold ${
            result.net_pnl >= 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {result.net_pnl >= 0 ? "+" : ""}
          {result.net_pnl_percentage.toFixed(2)}%
        </div>
      </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-white/40 text-xs">Capital</p>
            <p className="text-white font-medium">₹{result.capital_used.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">Total Trades</p>
            <p className="text-white font-medium">{result.total_trades}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">Win Rate</p>
            <p className="text-green-400 font-medium">{result.win_rate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">Max Drawdown</p>
            <p className="text-red-400 font-medium">{result.max_drawdown_percentage.toFixed(1)}%</p>
          </div>
        </div>

      <div className="flex gap-4 mt-4 text-sm">
        <span className="text-white/40">
          Buy: <span className="text-green-400">{result.buy_count}</span>
        </span>
        <span className="text-white/40">
          Sell: <span className="text-red-400">{result.sell_count}</span>
        </span>
        <span className="text-white/40">
          Hold: <span className="text-white/60">{result.hold_count}</span>
        </span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowTrades(!showTrades)}
        className="mt-4 text-white/40 hover:text-white"
      >
        {showTrades ? "Hide" : "Show"} Trade Log ({result.trade_log.length})
      </Button>

      {showTrades && (
        <div className="mt-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="min-w-[600px]">
            <table className="w-full text-sm">
              <thead className="text-white/40 text-xs">
                <tr>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Entry</th>
                  <th className="text-left py-2">Exit</th>
                  <th className="text-right py-2">P&L</th>
                </tr>
              </thead>
              <tbody className="text-white/80">
                {result.trade_log.slice(0, 20).map((trade) => (
                  <tr key={trade.id} className="border-t border-white/5">
                    <td className="py-2">
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
                    <td className="py-2">
                      ₹{trade.entry_price.toFixed(2)}
                      <span className="text-white/40 text-xs block">
                        {new Date(trade.entry_time).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-2">
                      ₹{trade.exit_price?.toFixed(2) || "-"}
                      <span className="text-white/40 text-xs block">
                        {trade.exit_reason}
                      </span>
                    </td>
                    <td
                      className={`py-2 text-right ${
                        (trade.pnl || 0) >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {(trade.pnl || 0) >= 0 ? "+" : ""}₹{trade.pnl?.toFixed(2) || "0"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PrivateStrategiesTab() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-white/40" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white text-lg">Private Strategies</CardTitle>
        <CardDescription className="text-white/40">
          Your personal strategies. Toggle to activate for AI analysis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {strategies.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-white/5 rounded-xl">
            <Lock className="w-12 h-12 text-white/10 mb-4" />
            <p className="text-white/40">No private strategies saved</p>
            <p className="text-white/20 text-sm mt-1">
              Create your first strategy in the Create AI tab
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {strategies.map((strategy) => (
              <div
                key={strategy.id}
                className="p-4 bg-white/5 border border-white/10 rounded-xl"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-medium">{strategy.name}</h3>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          strategy.visibility === "private"
                            ? "border-white/20 text-white/40"
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
                    <p className="text-white/40 text-sm mt-1">{strategy.description}</p>
                    <div className="flex gap-2 mt-2">
                      {strategy.selected_timeframes?.map((tf) => (
                        <Badge
                          key={tf}
                          variant="outline"
                          className="text-xs border-white/10 text-white/50"
                        >
                          {TIMEFRAMES.find((t) => t.value === tf)?.label || tf}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-white/40 text-xs">Activation</p>
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
      <Card className="bg-white/5 border-white/10">
        <CardContent className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-white/40" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white text-lg">Public Marketplace</CardTitle>
        <CardDescription className="text-white/40">
          Discover strategies shared by the community.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {strategies.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-white/5 rounded-xl">
            <Globe className="w-12 h-12 text-white/10 mb-4" />
            <p className="text-white/40">No public strategies available yet</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {strategies.map((strategy) => (
              <div
                key={strategy.id}
                className="p-4 bg-white/5 border border-white/10 rounded-xl"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-medium">{strategy.name}</h3>
                  <Badge variant="outline" className="border-green-500/30 text-green-400">
                    Public
                  </Badge>
                </div>
                <p className="text-white/40 text-sm mb-3">{strategy.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-white/30 text-xs">by {strategy.creator}</span>
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
      <Card className="bg-white/5 border-white/10">
        <CardContent className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-white/40" />
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
          className={activeSubTab === "browse" ? "bg-cyan-500" : "border-white/10 text-white/60"}
        >
          Browse
        </Button>
        <Button
          variant={activeSubTab === "requests" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSubTab("requests")}
          className={activeSubTab === "requests" ? "bg-cyan-500" : "border-white/10 text-white/60"}
        >
          My Requests
        </Button>
        <Button
          variant={activeSubTab === "manage" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSubTab("manage")}
          className={activeSubTab === "manage" ? "bg-cyan-500" : "border-white/10 text-white/60"}
        >
          Manage Invites
          {accessData.incomingRequests.length > 0 && (
            <Badge className="ml-2 bg-red-500">{accessData.incomingRequests.length}</Badge>
          )}
        </Button>
      </div>

      {activeSubTab === "browse" && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-lg">Invite-Only Strategies</CardTitle>
            <CardDescription className="text-white/40">
              Request access to exclusive strategies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {strategies.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-white/5 rounded-xl">
                <UserCheck className="w-12 h-12 text-white/10 mb-4" />
                <p className="text-white/40">No invite-only strategies available</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {strategies.map((strategy) => (
                  <div
                    key={strategy.id}
                    className="p-4 bg-white/5 border border-white/10 rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-purple-400" />
                        <h3 className="text-white font-medium">{strategy.name}</h3>
                      </div>
                      <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                        Invite Only
                      </Badge>
                    </div>
                    <p className="text-white/40 text-sm mb-3">{strategy.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-white/30 text-xs">by {strategy.creator}</span>
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
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-lg">My Access Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {accessData.myRequests.length === 0 ? (
              <p className="text-white/40 text-center py-8">No access requests</p>
            ) : (
              <div className="space-y-3">
                {accessData.myRequests.map((req: any) => (
                  <div key={req.id} className="p-3 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-white">{req.strategies?.name}</p>
                      <p className="text-white/40 text-sm">Status: {req.status}</p>
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
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-lg">Manage Invite Requests</CardTitle>
            <CardDescription className="text-white/40">
              Approve or reject access requests for your invite-only strategies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accessData.incomingRequests.length === 0 ? (
              <p className="text-white/40 text-center py-8">No pending requests</p>
            ) : (
              <div className="space-y-3">
                {accessData.incomingRequests.map((req: any) => (
                  <div key={req.id} className="p-4 bg-white/5 border border-white/10 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-white font-medium">{req.profiles?.username || req.profiles?.email}</p>
                        <p className="text-white/40 text-sm">Requesting: {req.strategies?.name}</p>
                      </div>
                      <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                        {req.status}
                      </Badge>
                    </div>
                    {req.message && (
                      <p className="text-white/60 text-sm mb-3 italic">&quot;{req.message}&quot;</p>
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
