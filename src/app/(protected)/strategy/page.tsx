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
    <div className="flex flex-col min-h-screen bg-[#030303] overflow-y-auto">
      <div className="flex-1 p-4 md:p-8 pt-6 space-y-6 max-w-7xl mx-auto w-full pb-20">
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

            <Tabs value={activeTab} onValueChange={(v) => {
              setActiveTab(v);
              if (v !== "create") setEditingStrategy(null);
            }} className="space-y-6">
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
                    <span className="truncate w-full text-center sm:text-left">
                      {editingStrategy ? "Edit" : "Create"}
                    </span>
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

function CreateStrategyTab({
  initialData,
  onCancel
}: {
  initialData?: any;
  onCancel?: () => void;
}) {
  const [creationMode, setCreationMode] = useState<CreationMode | null>(initialData?.creation_mode || null);
  const [step, setStep] = useState<"input" | "review" | "backtest" | "improve" | "save">("input");
  const [rawInput, setRawInput] = useState("");
  const [formatting, setFormatting] = useState(false);
  const [aiAnalysisEnabled, setAiAnalysisEnabled] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [strategy, setStrategy] = useState<StructuredStrategy | null>(null);
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

  // AI Powered specific states
  const [aiIntent, setAiIntent] = useState("");
  const [confidenceThreshold, setConfidenceThreshold] = useState(75);
  
  // AI Assisted specific states
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardAnswers, setWizardAnswers] = useState<Record<string, any>>({});

  useEffect(() => {
    if (initialData) {
      setCreationMode(initialData.creation_mode || "TRADITIONAL");
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

  const resetForm = () => {
    setCreationMode(null);
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
    setAiIntent("");
    setConfidenceThreshold(75);
    setWizardStep(0);
    setWizardAnswers({});
    if (onCancel && initialData) onCancel();
  };

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
    setStrategy(draft.strategy_logic || draft.strategy_data || null);
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

  const formatStrategy = async (input?: string) => {
    const textToFormat = input || rawInput;
    if (!textToFormat.trim()) return;
    setFormatting(true);
    try {
      const res = await fetch("/api/strategies/format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput: textToFormat, aiAnalysisEnabled }),
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
          strategy: {
            ...strategy,
            creation_mode: creationMode,
            intelligence_profile: creationMode === "AI_POWERED" ? {
              intent: aiIntent,
              confidence_threshold: confidenceThreshold
            } : creationMode === "AI_ASSISTED" ? {
              wizard_answers: wizardAnswers
            } : null
          },
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

  useEffect(() => {
    fetchDrafts();
  }, []);

  if (!creationMode) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card 
          className="group relative overflow-hidden bg-white/5 border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/[0.02] cursor-pointer transition-all duration-300"
          onClick={() => setCreationMode("TRADITIONAL")}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Zap className="w-24 h-24" />
          </div>
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6 text-cyan-400" />
            </div>
            <CardTitle className="text-white text-xl">Traditional Strategy</CardTitle>
            <CardDescription className="text-white/50">
              Build using indicators like RSI, EMA, and Price Action. Best for systematic rule-based trading.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" className="text-cyan-400 group-hover:translate-x-1 transition-transform p-0">
              Build Now <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="group relative overflow-hidden bg-white/5 border-white/10 hover:border-purple-500/50 hover:bg-purple-500/[0.02] cursor-pointer transition-all duration-300"
          onClick={() => setCreationMode("AI_POWERED")}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles className="w-24 h-24" />
          </div>
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <CardTitle className="text-white text-xl">Fully AI Powered</CardTitle>
            <CardDescription className="text-white/50">
              Neural pattern recognition without fixed indicators. Analyzes raw market soul and volume clusters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" className="text-purple-400 group-hover:translate-x-1 transition-transform p-0">
              Enter Neural Engine <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="group relative overflow-hidden bg-white/5 border-white/10 hover:border-green-500/50 hover:bg-green-500/[0.02] cursor-pointer transition-all duration-300"
          onClick={() => setCreationMode("AI_ASSISTED")}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Bot className="w-24 h-24" />
          </div>
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Bot className="w-6 h-6 text-green-400" />
            </div>
            <CardTitle className="text-white text-xl">AI Assisted Wizard</CardTitle>
            <CardDescription className="text-white/50">
              A guided interview where the AI brain helps you define your edge, risk, and goals step-by-step.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" className="text-green-400 group-hover:translate-x-1 transition-transform p-0">
              Start Interview <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCreationMode(null)}
            className="text-white/40 hover:text-white"
          >
            <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
            Change Mode
          </Button>
          <Badge variant="outline" className={`border-${creationMode === 'TRADITIONAL' ? 'cyan' : creationMode === 'AI_POWERED' ? 'purple' : 'green'}-500/30 text-${creationMode === 'TRADITIONAL' ? 'cyan' : creationMode === 'AI_POWERED' ? 'purple' : 'green'}-400`}>
            {creationMode.replace('_', ' ')}
          </Badge>
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
              className="border-white/10 text-white/60"
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
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              Your Drafts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{draft.name || "Untitled"}</p>
                  <p className="text-white/40 text-xs">
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
                {creationMode === "TRADITIONAL" ? (
                  <>
                    <Bot className="w-5 h-5 text-cyan-400" />
                    Describe Your Strategy
                  </>
                ) : creationMode === "AI_POWERED" ? (
                  <>
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    Neural Engine Configuration
                  </>
                ) : (
                  <>
                    <Bot className="w-5 h-5 text-green-400" />
                    AI Strategy Interview
                  </>
                )}
              </CardTitle>
              <CardDescription className="text-white/40">
                {creationMode === "TRADITIONAL" 
                  ? "Write your trading idea in any form. Our AI will convert it into systematic rules."
                  : creationMode === "AI_POWERED"
                  ? "Define the market pattern or 'Soul' you want the AI to recognize. No indicators needed."
                  : "Answer a few questions and let the AI Brain architect your perfect trading system."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {creationMode === "TRADITIONAL" && (
                <>
                  <Textarea
                    placeholder="Example: Buy when RSI is low and price is above 20 SMA..."
                    value={rawInput}
                    onChange={(e) => setRawInput(e.target.value)}
                    className="min-h-[200px] bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
                  />

                  <div className="flex items-center justify-between p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <Label className="text-white text-sm font-medium">AI Performance Analysis</Label>
                        <p className="text-white/40 text-xs">
                          Enable deep analysis to optimize win rate
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={aiAnalysisEnabled}
                      onCheckedChange={setAiAnalysisEnabled}
                    />
                  </div>
                </>
              )}

              {creationMode === "AI_POWERED" && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-white">What pattern should the Neural Engine look for?</Label>
                    <Textarea
                      placeholder="Example: Identify liquidity grabs at previous day highs followed by a rapid rejection..."
                      value={aiIntent}
                      onChange={(e) => setAiIntent(e.target.value)}
                      className="min-h-[150px] bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-white">Neural Confidence Threshold</Label>
                      <Badge variant="outline" className="text-purple-400 border-purple-500/30">
                        {confidenceThreshold}%
                      </Badge>
                    </div>
                    <Input 
                      type="range" 
                      min="50" 
                      max="95" 
                      step="5"
                      value={confidenceThreshold}
                      onChange={(e) => setConfidenceThreshold(parseInt(e.target.value))}
                      className="accent-purple-500"
                    />
                    <p className="text-white/30 text-xs">
                      Higher threshold means fewer but more accurate trades.
                    </p>
                  </div>

                  <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                    <h4 className="text-purple-400 text-sm font-medium mb-1">How it works</h4>
                    <p className="text-white/60 text-xs leading-relaxed">
                      The AI analyzes raw OHLCV data to find the pattern you described. It doesn't use RSI or EMA, but learns the "Visual Soul" of the market to make entry/exit decisions.
                    </p>
                  </div>
                </div>
              )}

              {creationMode === "AI_ASSISTED" && (
                <div className="space-y-8 py-4">
                  <div className="flex items-center justify-between gap-2">
                    {[0, 1, 2, 3].map((s) => (
                      <div 
                        key={s} 
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          wizardStep >= s ? "bg-green-500" : "bg-white/10"
                        }`} 
                      />
                    ))}
                  </div>

                  {wizardStep === 0 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                      <h3 className="text-white text-xl font-medium">What is your primary trading goal?</h3>
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          { id: "income", label: "Consistent Daily Income", icon: <TrendingUp className="w-4 h-4" /> },
                          { id: "growth", label: "Long-term Capital Growth", icon: <Zap className="w-4 h-4" /> },
                          { id: "wealth", label: "High Risk Wealth Creation", icon: <Sparkles className="w-4 h-4" /> }
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => {
                              setWizardAnswers({...wizardAnswers, goal: opt.id});
                              setWizardStep(1);
                            }}
                            className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-green-500/50 hover:bg-green-500/5 transition-all text-left"
                          >
                            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                              {opt.icon}
                            </div>
                            <span className="text-white font-medium">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {wizardStep === 1 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                      <h3 className="text-white text-xl font-medium">What is your risk tolerance?</h3>
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          { id: "CONSERVATIVE", label: "Conservative (Low Drawdown)", desc: "Focus on capital preservation" },
                          { id: "MODERATE", label: "Moderate (Balanced)", desc: "Optimized for Risk/Reward ratio" },
                          { id: "AGGRESSIVE", label: "Aggressive (High Yield)", desc: "Maximum returns, higher volatility" }
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => {
                              setWizardAnswers({...wizardAnswers, risk: opt.id});
                              setWizardStep(2);
                            }}
                            className="flex flex-col p-4 bg-white/5 border border-white/10 rounded-xl hover:border-green-500/50 hover:bg-green-500/5 transition-all text-left"
                          >
                            <span className="text-white font-medium">{opt.label}</span>
                            <span className="text-white/40 text-xs">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                      <Button variant="ghost" onClick={() => setWizardStep(0)} className="text-white/40">Back</Button>
                    </div>
                  )}

                  {wizardStep === 2 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                      <h3 className="text-white text-xl font-medium">Preferred Trading Style?</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {["SCALPING", "INTRADAY", "SWING"].map((style) => (
                          <button
                            key={style}
                            onClick={() => {
                              setWizardAnswers({...wizardAnswers, style});
                              setWizardStep(3);
                            }}
                            className="p-4 bg-white/5 border border-white/10 rounded-xl hover:border-green-500/50 hover:bg-green-500/5 transition-all text-white font-medium"
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                      <Button variant="ghost" onClick={() => setWizardStep(1)} className="text-white/40">Back</Button>
                    </div>
                  )}

                  {wizardStep === 3 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                      <h3 className="text-white text-xl font-medium">Any specific market bias or observation?</h3>
                      <Textarea
                        placeholder="e.g., I like trading pullbacks in strong trends, or I prefer mean reversion..."
                        value={wizardAnswers.observation || ""}
                        onChange={(e) => setWizardAnswers({...wizardAnswers, observation: e.target.value})}
                        className="min-h-[120px] bg-white/5 border-white/10 text-white"
                      />
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setWizardStep(2)} className="text-white/40">Back</Button>
                        <Button 
                          onClick={() => {
                            setRawInput(`Build a ${wizardAnswers.style} strategy for ${wizardAnswers.goal} with ${wizardAnswers.risk} risk. ${wizardAnswers.observation || ""}`);
                            formatStrategy();
                          }} 
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          Generate Strategy
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {creationMode !== "AI_ASSISTED" && (
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
                  
                  {creationMode === "TRADITIONAL" && (
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
                  )}
                  
                  <Button
                    onClick={creationMode === "AI_POWERED" ? () => {
                      // Handle AI Powered formatting
                      setStrategy({
                        name: "Neural Pattern Strategy",
                        description: aiIntent,
                        strategy_type: "INTRADAY",
                        buy_entry_logic: { conditions: [`AI Neural Inference: ${aiIntent}`], parameters: { confidence: confidenceThreshold } },
                        buy_stop_loss: { conditions: ["1.5% fixed"] },
                        buy_target: { conditions: ["3% fixed"] },
                        buy_trailing_sl: { conditions: ["Enabled at 2%"] },
                        sell_entry_logic: { conditions: [`AI Neural Inference (Reversal): ${aiIntent}`], parameters: { confidence: confidenceThreshold } },
                        sell_stop_loss: { conditions: ["1.5% fixed"] },
                        sell_target: { conditions: ["3% fixed"] },
                        sell_trailing_sl: { conditions: ["Enabled at 2%"] },
                        hold_logic: { conditions: ["Low volatility periods"] }
                      });
                      setStep("review");
                    } : formatStrategy}
                    disabled={creationMode === "AI_POWERED" ? !aiIntent.trim() : !rawInput.trim() || formatting || generating}
                    className={`${creationMode === "AI_POWERED" ? "bg-purple-600 hover:bg-purple-700" : "bg-cyan-500 hover:bg-cyan-600"}`}
                  >
                    {formatting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    {creationMode === "AI_POWERED" ? "Initialize Neural Engine" : "Format with AI"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="hidden lg:block">
            {creationMode === "AI_POWERED" ? (
              <Card className="bg-purple-500/5 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    Neural Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-white/60 text-xs">
                      The Neural Engine uses 100+ micro-patterns to validate your intent.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-white/40 text-[10px] uppercase">Detected Potential</p>
                    <div className="flex items-center justify-between">
                      <span className="text-white text-xs">Pattern Complexity</span>
                      <span className="text-purple-400 text-xs">High</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white text-xs">Learning Time</span>
                      <span className="text-purple-400 text-xs">~2 mins</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <TradingToolbox onInsertTool={handleInsertTool} />
            )}
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
                      { label: "Entry Logic", data: strategy.buy_entry_logic || { conditions: [] } },
                      { label: "Stop Loss", data: strategy.buy_stop_loss || { conditions: [] } },
                      { label: "Target", data: strategy.buy_target || { conditions: [] } },
                      { label: "Trailing SL", data: strategy.buy_trailing_sl || { conditions: [] } },
                    ]}
                  />
                  <StrategySection
                    title="SELL Side"
                    icon={<TrendingDown className="w-4 h-4 text-red-400" />}
                    sections={[
                      { label: "Entry Logic", data: strategy.sell_entry_logic || { conditions: [] } },
                      { label: "Stop Loss", data: strategy.sell_stop_loss || { conditions: [] } },
                      { label: "Target", data: strategy.sell_target || { conditions: [] } },
                      { label: "Trailing SL", data: strategy.sell_trailing_sl || { conditions: [] } },
                    ]}
                  />
                </div>

                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-yellow-400" />
                    <span className="text-yellow-400 font-medium">Hold / No-Trade Logic</span>
                  </div>
                    <ul className="text-white/60 text-sm space-y-1">
                      {strategy.hold_logic?.conditions?.map((c, i) => (
                        <li key={i}>• {typeof c === 'string' ? c : JSON.stringify(c)}</li>
                      )) || <li>• No specific hold conditions</li>}
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
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{initialData ? "Update Strategy" : "Save Strategy"}</DialogTitle>
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
                      <li key={i}>
                        • {typeof c === 'string' ? c : (
                          <span className="text-white/40">
                            {JSON.stringify(c)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                    {section.data.parameters && typeof section.data.parameters === "object" && section.data.parameters !== null && Object.keys(section.data.parameters).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(section.data.parameters).map(([k, v]) => (
                        <Badge key={k} variant="outline" className="text-xs border-white/10 text-white/50">
                          {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
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
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-white/40 text-[10px] uppercase tracking-wider">Net P&L</p>
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
        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
          <p className="text-white/40 text-xs mb-1">Win Rate</p>
          <p className="text-green-400 text-xl font-bold">{result.win_rate.toFixed(1)}%</p>
          <p className="text-white/20 text-[10px]">Total: {result.total_trades} trades</p>
        </div>
        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
          <p className="text-white/40 text-xs mb-1">P&L / Trade</p>
          <p className={`text-xl font-bold ${result.net_pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            ₹{(result.net_pnl / (result.total_trades || 1)).toFixed(0)}
          </p>
          <p className="text-white/20 text-[10px]">Avg per position</p>
        </div>
        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
          <p className="text-white/40 text-xs mb-1">Max Drawdown</p>
          <p className="text-red-400 text-xl font-bold">{result.max_drawdown_percentage.toFixed(1)}%</p>
          <p className="text-white/20 text-[10px]">₹{result.max_drawdown.toLocaleString()}</p>
        </div>
        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
          <p className="text-white/40 text-xs mb-1">Capital Used</p>
          <p className="text-white text-xl font-bold">₹{result.capital_used.toLocaleString()}</p>
          <p className="text-white/20 text-[10px]">Total exposure</p>
        </div>
      </div>

      <div className="flex gap-4 mt-4 text-xs">
        <span className="text-white/40">
          Profit Trades: <span className="text-green-400">{Math.round(result.total_trades * result.win_rate / 100)}</span>
        </span>
        <span className="text-white/40">
          Loss Trades: <span className="text-red-400">{Math.round(result.total_trades * result.loss_rate / 100)}</span>
        </span>
        <span className="text-white/40">
          Hold: <span className="text-white/60">{result.hold_count}</span>
        </span>
      </div>

      <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTrades(!showTrades)}
          className="mt-4 text-white/40 hover:text-white h-8"
        >
          {showTrades ? "Hide" : "Show"} Position Log ({(result.trade_log || []).length})
        </Button>

        {/* AI Insights Panel */}
        {result.aiInsights && result.aiInsights.suggestions && result.aiInsights.suggestions.length > 0 && (
          <div className="mt-4 p-4 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-purple-400" />
              <span className="text-white font-medium text-sm">AI Trading Engine Insights</span>
              {result.aiInsights.expectedImprovement > 0 && (
                <Badge className="bg-green-500/20 text-green-400 border-none text-[10px]">
                  +{result.aiInsights.expectedImprovement}% Expected
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              {result.aiInsights.suggestions.map((suggestion, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-white/70">
                  <Sparkles className="w-3 h-3 text-cyan-400 mt-0.5 shrink-0" />
                  <span>{suggestion}</span>
                </div>
              ))}
            </div>
            {result.aiInsights.optimizedParams && (
              <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-2">
                {result.aiInsights.optimizedParams.stop_loss_pct && (
                  <div className="p-2 bg-white/5 rounded text-center">
                    <p className="text-[10px] text-white/40">Stop Loss</p>
                    <p className="text-sm font-bold text-red-400">{result.aiInsights.optimizedParams.stop_loss_pct}%</p>
                  </div>
                )}
                {result.aiInsights.optimizedParams.target_pct && (
                  <div className="p-2 bg-white/5 rounded text-center">
                    <p className="text-[10px] text-white/40">Target</p>
                    <p className="text-sm font-bold text-green-400">{result.aiInsights.optimizedParams.target_pct}%</p>
                  </div>
                )}
                {result.aiInsights.optimizedParams.trailing_stop && (
                  <div className="p-2 bg-white/5 rounded text-center">
                    <p className="text-[10px] text-white/40">Trailing SL</p>
                    <p className="text-sm font-bold text-yellow-400">Enabled</p>
                  </div>
                )}
                {result.aiInsights.optimizedParams.additional_filter && (
                  <div className="p-2 bg-white/5 rounded text-center col-span-2 md:col-span-1">
                    <p className="text-[10px] text-white/40">Filter</p>
                    <p className="text-xs font-medium text-cyan-400">{result.aiInsights.optimizedParams.additional_filter}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {showTrades && result.trade_log && (
        <div className="mt-4 overflow-x-auto border border-white/5 rounded-lg">
          <table className="w-full text-sm">
            <thead className="text-white/40 text-[10px] uppercase tracking-wider bg-white/5">
              <tr>
                <th className="text-left px-4 py-2">S.No</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Qty</th>
                <th className="text-left px-4 py-2">Entry</th>
                <th className="text-left px-4 py-2">Exit (Reason)</th>
                <th className="text-right px-4 py-2">P&L</th>
              </tr>
            </thead>
            <tbody className="text-white/80">
              {result.trade_log.map((trade, idx) => (
                <tr key={trade.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-white/30 text-xs">
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
                  <td className="px-4 py-3 text-white/60 font-mono text-xs">
                    {trade.quantity}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-xs">₹{trade.entry_price.toFixed(2)}</div>
                    <div className="text-white/30 text-[9px]">
                      {new Date(trade.entry_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-xs">₹{trade.exit_price?.toFixed(2) || "-"}</div>
                    <div className={`text-[9px] ${
                      trade.exit_reason?.includes("Stop Loss") ? "text-red-400/70" : 
                      trade.exit_reason?.includes("Target") ? "text-green-400/70" : "text-white/30"
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
      <Card className="bg-white/5 border-white/10">
        <CardContent className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-white/40" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
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
                      <div className="flex items-center gap-2 mr-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10"
                          onClick={() => onEdit?.(strategy)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-white/40 hover:text-red-400 hover:bg-red-400/10"
                          onClick={() => setDeletingId(strategy.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Status</p>
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
        <AlertDialogContent className="bg-[#1a1a1a] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              This will permanently delete the strategy and stop all active scanning/trading associated with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-red-500 hover:bg-red-600 text-white border-none"
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
