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
  Settings2,
  Plus
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
import { cn } from "@/lib/utils";

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

const TIMEFRAMES = [
  { value: "3minute", label: "3 Min", coverage: "1 Month" },
  { value: "5minute", label: "5 Min", coverage: "3 Months" },
  { value: "15minute", label: "15 Min", coverage: "6 Months" },
  { value: "60minute", label: "1 Hour", coverage: "1 Year" },
  { value: "day", label: "Daily", coverage: "3 Years" },
];

export default function StrategyPage() {
  const [activeTab, setActiveTab] = useState("create");

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.03] backdrop-blur-md p-4 md:p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-400/10 text-purple-400">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">Strategy Factory</h1>
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider">AI-Powered Logic Builder</p>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList className="bg-white/5 border border-white/5 p-1 h-11 w-full md:w-fit">
            <TabsTrigger value="active" className="gap-2 text-[10px] font-black uppercase tracking-tighter data-[state=active]:bg-white/10">
              <Activity className="h-3.5 w-3.5" />
              Active
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-2 text-[10px] font-black uppercase tracking-tighter data-[state=active]:bg-white/10">
              <Plus className="h-3.5 w-3.5" />
              Create
            </TabsTrigger>
            <TabsTrigger value="private" className="gap-2 text-[10px] font-black uppercase tracking-tighter data-[state=active]:bg-white/10">
              <Lock className="h-3.5 w-3.5" />
              Private
            </TabsTrigger>
            <TabsTrigger value="public" className="gap-2 text-[10px] font-black uppercase tracking-tighter data-[state=active]:bg-white/10">
              <Globe className="h-3.5 w-3.5" />
              Market
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="active" className="space-y-4 mt-0">
            <ActiveStrategiesTab />
          </TabsContent>

          <TabsContent value="create" className="space-y-4 mt-0">
            <CreateStrategyTab />
          </TabsContent>

          <TabsContent value="private" className="space-y-4 mt-0">
            <PrivateStrategiesTab />
          </TabsContent>

          <TabsContent value="public" className="space-y-4 mt-0">
            <PublicStrategiesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ActiveStrategiesTab() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveStrategies();
  }, []);

  const fetchActiveStrategies = async () => {
    try {
      const res = await fetch("/api/strategies");
      if (res.ok) {
        const data = await res.json();
        setStrategies((data.strategies || []).filter((s: Strategy) => s.is_active));
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
      fetchActiveStrategies();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
      <CardHeader className="p-4 md:p-5 border-b border-white/5">
        <CardTitle className="text-sm font-bold text-white uppercase tracking-tight">Active Strategies</CardTitle>
        <CardDescription className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Currently engaged for market scanning</CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        {strategies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="h-10 w-10 text-white/10 mb-4 animate-pulse" />
            <h3 className="font-bold text-white uppercase tracking-tighter">No live strategies</h3>
            <p className="text-white/20 text-[10px] mt-1 uppercase tracking-widest">Enable strategies from your Private tab</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategies.map((strategy) => (
              <div
                key={strategy.id}
                className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl flex flex-col justify-between group hover:bg-white/[0.05] transition-all duration-300"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-black tracking-tight text-sm uppercase truncate">{strategy.name}</h3>
                    <Switch
                      checked={strategy.is_active}
                      onCheckedChange={(checked) => toggleActive(strategy.id, checked)}
                      className="data-[state=checked]:bg-green-500 scale-75"
                    />
                  </div>
                  <p className="text-white/40 text-[11px] leading-relaxed line-clamp-2 mb-3">
                    {strategy.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {strategy.selected_timeframes?.map((tf) => (
                      <Badge
                        key={tf}
                        variant="outline"
                        className="text-[9px] font-bold border-white/5 bg-white/5 text-white/40 h-4 px-1.5"
                      >
                        {TIMEFRAMES.find((t) => t.value === tf)?.label || tf}
                      </Badge>
                    ))}
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

function CreateStrategyTab() {
  const [step, setStep] = useState<"input" | "review" | "backtest" | "improve" | "save">("input");
  const [rawInput, setRawInput] = useState("");
  const [formatting, setFormatting] = useState(false);
  const [strategy, setStrategy] = useState<StructuredStrategy | null>(null);
  const [backtestResults, setBacktestResults] = useState<Record<string, BacktestResult>>({});
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>([]);
  const [selectedInstrument, setSelectedInstrument] = useState<number | null>(null);
  const [instrumentSearch, setInstrumentSearch] = useState("");
  const [instruments, setInstruments] = useState<Array<{instrument_token: number; tradingsymbol: string; name: string}>>([]);
  const [backtesting, setBacktesting] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improvementNotes, setImprovementNotes] = useState("");
  const [improvementCount, setImprovementCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [visibility, setVisibility] = useState<"private" | "public" | "invite_only">("private");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const searchInstruments = useCallback(async (query: string) => {
    if (query.length < 2) {
      setInstruments([]);
      return;
    }
    const res = await fetch(`/api/admin/market-data/instruments?search=${encodeURIComponent(query)}&limit=10`);
    if (res.ok) {
      const data = await res.json();
      setInstruments(data.instruments || []);
    }
  }, []);

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
      }
    } catch {
      console.error("Error formatting strategy");
    } finally {
      setFormatting(false);
    }
  };

  const runBacktest = async (timeframe: string) => {
    if (!strategy || !selectedInstrument) return;
    setBacktesting(true);
    try {
      const res = await fetch("/api/strategies/preview/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy,
          instrumentToken: selectedInstrument,
          timeframe,
          capital: 100000,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBacktestResults((prev) => ({ ...prev, [timeframe]: data.result }));
        if (step === "review") setStep("backtest");
      }
    } catch {
      console.error("Error running backtest");
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
      console.error("Error improving strategy");
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
          visibility,
        }),
      });
      if (res.ok) {
        setShowSaveDialog(false);
        resetForm();
      }
    } catch {
      console.error("Error saving strategy");
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
    setSelectedInstrument(null);
    setImprovementNotes("");
    setImprovementCount(0);
  };

  return (
    <div className="space-y-4">
      {/* Progress Stepper */}
      <div className="bg-white/5 border border-white/5 p-3 rounded-2xl flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        {["input", "review", "backtest", "improve", "save"].map((s, i) => {
          const isActive = step === s;
          const isDone = ["input", "review", "backtest", "improve", "save"].indexOf(step) > i;
          return (
            <div key={s} className="flex items-center gap-2 flex-1 min-w-fit">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all",
                isActive ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20" : 
                isDone ? "bg-green-400 text-black" : "bg-white/5 text-white/20"
              )}>
                {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-widest transition-colors",
                isActive ? "text-white" : "text-white/20"
              )}>{s}</span>
              {i < 4 && <ArrowRight className="w-3 h-3 text-white/10 mx-auto" />}
            </div>
          );
        })}
      </div>

      {step === "input" && (
        <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
          <CardHeader className="p-4 md:p-6 pb-2">
            <CardTitle className="text-sm md:text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Describe Trading Idea
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 space-y-4">
            <Textarea
              placeholder="Example: Buy when RSI(14) is below 30 and price cross above 20 SMA. Target 2%, SL 1%..."
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              className="min-h-[180px] bg-white/[0.03] border-white/5 text-white placeholder:text-white/20 resize-none rounded-xl focus:ring-purple-500/50"
            />
            <div className="flex justify-end">
              <Button
                onClick={formatStrategy}
                disabled={!rawInput.trim() || formatting}
                className="bg-purple-500 hover:bg-purple-600 h-10 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-purple-500/20"
              >
                {formatting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Format Logic
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(step === "review" || step === "backtest" || step === "improve") && strategy && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
            <CardHeader className="p-4 md:p-6 pb-2 border-b border-white/5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-white uppercase tracking-tight">{strategy.name}</CardTitle>
                <CardDescription className="text-[10px] text-white/40 uppercase tracking-widest font-medium">
                  Generated AI Logic
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white">
                Reset
              </Button>
            </CardHeader>
            <CardContent className="p-4 md:p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StrategySection
                  title="Bullish Entry"
                  icon={<TrendingUp className="w-4 h-4 text-green-400" />}
                  sections={[
                    { label: "Conditions", data: strategy.buy_entry_logic },
                    { label: "Target / Risk", data: strategy.buy_target },
                  ]}
                />
                <StrategySection
                  title="Bearish Entry"
                  icon={<TrendingDown className="w-4 h-4 text-red-400" />}
                  sections={[
                    { label: "Conditions", data: strategy.sell_entry_logic },
                    { label: "Target / Risk", data: strategy.sell_target },
                  ]}
                />
              </div>

              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-yellow-400" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Risk Guard Logic</span>
                </div>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {strategy.hold_logic.conditions?.map((c, i) => (
                    <li key={i} className="text-[11px] text-white/40 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/30 mt-1 shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
            <CardHeader className="p-4 md:p-6 pb-2 border-b border-white/5">
              <CardTitle className="text-sm font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Performance Validation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Select Instrument</Label>
                  <div className="relative">
                    <Input
                      placeholder="Symbol..."
                      value={instrumentSearch}
                      onChange={(e) => {
                        setInstrumentSearch(e.target.value);
                        searchInstruments(e.target.value);
                      }}
                      className="bg-white/5 border-white/5 text-white h-10 rounded-xl"
                    />
                    {instruments.length > 0 && (
                      <div className="absolute z-50 w-full mt-2 bg-black border border-white/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                        {instruments.map((inst) => (
                          <button
                            key={inst.instrument_token}
                            className="w-full text-left px-4 py-3 hover:bg-white/5 text-white text-xs border-b border-white/5 last:border-none"
                            onClick={() => {
                              setSelectedInstrument(inst.instrument_token);
                              setInstrumentSearch(inst.tradingsymbol);
                              setInstruments([]);
                            }}
                          >
                            <span className="font-bold">{inst.tradingsymbol}</span>
                            <span className="text-white/30 ml-2">{inst.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Timeframe Scan</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {TIMEFRAMES.slice(0, 3).map((tf) => (
                      <Button
                        key={tf.value}
                        variant="outline"
                        size="sm"
                        onClick={() => runBacktest(tf.value)}
                        disabled={backtesting || !selectedInstrument}
                        className={cn(
                          "h-10 border-white/5 text-[10px] font-bold uppercase tracking-widest rounded-xl",
                          backtestResults[tf.value] ? "bg-green-400/10 border-green-400/20 text-green-400" : "bg-white/5 text-white/40"
                        )}
                      >
                        {backtesting ? <Loader2 className="w-3 h-3 animate-spin" /> : tf.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {Object.keys(backtestResults).length > 0 && (
                <div className="space-y-4 animate-in fade-in duration-500">
                  {Object.entries(backtestResults).map(([timeframe, result]) => (
                    <BacktestResultCard
                      key={timeframe}
                      timeframe={timeframe}
                      result={result}
                    />
                  ))}

                  <div className="flex gap-3 pt-4 border-t border-white/5">
                    <Button
                      onClick={improveStrategy}
                      disabled={improving}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 h-11 text-[10px] font-black uppercase tracking-widest rounded-xl"
                    >
                      {improving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Optimize
                    </Button>
                    <Button
                      onClick={() => setShowSaveDialog(true)}
                      className="flex-1 bg-purple-500 hover:bg-purple-600 h-11 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-purple-500/20"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Strategy
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 text-white rounded-3xl max-w-md">
          <DialogHeader className="p-2">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Save Strategy</DialogTitle>
            <DialogDescription className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
              Deployment Configuration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Engagement Timeframes</Label>
              <div className="flex flex-wrap gap-2">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.value}
                    onClick={() => {
                      setSelectedTimeframes((prev) =>
                        prev.includes(tf.value)
                          ? prev.filter((t) => t !== tf.value)
                          : [...prev, tf.value]
                      );
                    }}
                    className={cn(
                      "px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                      selectedTimeframes.includes(tf.value)
                        ? "bg-purple-500 border-purple-400 text-white"
                        : "bg-white/5 border-white/5 text-white/30"
                    )}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Visibility / Marketplace</Label>
              <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
                <SelectTrigger className="bg-white/5 border-white/5 text-white h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black border-white/10">
                  <SelectItem value="private" className="text-xs font-bold uppercase tracking-tight">Private Access</SelectItem>
                  <SelectItem value="public" className="text-xs font-bold uppercase tracking-tight">Marketplace (Public)</SelectItem>
                  <SelectItem value="invite_only" className="text-xs font-bold uppercase tracking-tight">Restricted Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowSaveDialog(false)}
              className="text-[10px] font-black uppercase tracking-widest text-white/40"
            >
              Cancel
            </Button>
            <Button
              onClick={saveStrategy}
              disabled={saving || selectedTimeframes.length === 0}
              className="bg-purple-500 hover:bg-purple-600 rounded-xl px-6 h-11 text-[10px] font-black uppercase tracking-widest"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Deploy Strategy"}
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
  return (
    <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl space-y-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[11px] font-black text-white uppercase tracking-widest">{title}</span>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.label} className="space-y-1.5">
            <p className="text-[9px] text-white/20 uppercase font-black tracking-widest">
              {section.label}
            </p>
            <div className="space-y-1">
              {section.data.conditions?.map((c, i) => (
                <div key={i} className="text-[11px] text-white/70 bg-white/5 p-2 rounded-lg border border-white/5">
                  {c}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BacktestResultCard({ timeframe, result }: { timeframe: string; result: BacktestResult }) {
  const [showTrades, setShowTrades] = useState(false);
  const tf = TIMEFRAMES.find((t) => t.value === timeframe);

  return (
    <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-400/10 text-blue-400 border-none text-[10px] font-black uppercase tracking-widest">
            {tf?.label || timeframe}
          </Badge>
          <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">{tf?.coverage}</span>
        </div>
        <div className={cn(
          "text-lg font-black tracking-tighter",
          result.net_pnl >= 0 ? "text-green-400" : "text-red-400"
        )}>
          {result.net_pnl >= 0 ? "+" : ""}{result.net_pnl_percentage.toFixed(2)}%
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="text-center p-2 rounded-xl bg-white/5">
          <p className="text-[8px] text-white/30 uppercase font-black tracking-tighter">Trades</p>
          <p className="text-xs font-bold text-white">{result.total_trades}</p>
        </div>
        <div className="text-center p-2 rounded-xl bg-white/5">
          <p className="text-[8px] text-white/30 uppercase font-black tracking-tighter">Win Rate</p>
          <p className="text-xs font-bold text-green-400">{result.win_rate.toFixed(1)}%</p>
        </div>
        <div className="text-center p-2 rounded-xl bg-white/5">
          <p className="text-[8px] text-white/30 uppercase font-black tracking-tighter">Drawdown</p>
          <p className="text-xs font-bold text-red-400">{result.max_drawdown_percentage.toFixed(1)}%</p>
        </div>
        <div className="text-center p-2 rounded-xl bg-white/5">
          <p className="text-[8px] text-white/30 uppercase font-black tracking-tighter">P&L</p>
          <p className={cn("text-xs font-bold", result.net_pnl >= 0 ? "text-green-400" : "text-red-400")}>₹{result.net_pnl.toFixed(0)}</p>
        </div>
      </div>
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
      <CardHeader className="p-4 md:p-5 border-b border-white/5">
        <CardTitle className="text-sm font-bold text-white uppercase tracking-tight">Private Repository</CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        {strategies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Lock className="h-10 w-10 text-white/10 mb-4" />
            <h3 className="font-bold text-white uppercase tracking-tighter">Vault Empty</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategies.map((strategy) => (
              <div
                key={strategy.id}
                className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl group hover:bg-white/[0.05] transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-black tracking-tight text-sm uppercase truncate">{strategy.name}</h3>
                  <Badge className="bg-white/5 text-white/40 border-none text-[8px] font-black uppercase tracking-widest">
                    {strategy.visibility}
                  </Badge>
                </div>
                <p className="text-white/40 text-[11px] leading-relaxed line-clamp-2 mb-4">
                  {strategy.description}
                </p>
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex gap-1">
                    {strategy.selected_timeframes?.slice(0, 2).map((tf) => (
                      <span key={tf} className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">
                        {TIMEFRAMES.find((t) => t.value === tf)?.label || tf}
                      </span>
                    ))}
                  </div>
                  <Switch
                    checked={strategy.is_active}
                    onCheckedChange={(checked) => toggleActive(strategy.id, checked)}
                    className="scale-75 data-[state=checked]:bg-purple-500"
                  />
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
      <CardHeader className="p-4 md:p-5 border-b border-white/5">
        <CardTitle className="text-sm font-bold text-white uppercase tracking-tight">Marketplace</CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        {strategies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-white/20 text-[10px] font-bold uppercase tracking-widest">
            Marketplace Coming Soon
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategies.map((strategy) => (
              <div
                key={strategy.id}
                className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-black tracking-tight text-sm uppercase truncate">{strategy.name}</h3>
                  <Badge className="bg-green-400 text-black border-none text-[8px] font-black uppercase tracking-widest">
                    FREE
                  </Badge>
                </div>
                <p className="text-white/40 text-[11px] leading-relaxed line-clamp-2 mb-4">
                  {strategy.description}
                </p>
                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-white/20">
                  <span>by {strategy.creator}</span>
                  {strategy.stats && (
                    <span className="text-green-400">{strategy.stats.win_rate?.toFixed(0)}% WIN</span>
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
