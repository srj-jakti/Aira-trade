"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  BrainCircuit, 
  LineChart, 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertCircle, 
  RefreshCw, 
  ArrowUp, 
  ArrowDown, 
  Loader2, 
  ChevronDown, 
  Eye, 
  EyeOff, 
  Settings2, 
  Info,
  Activity,
  Radar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InstrumentSearch, type Instrument } from "@/components/InstrumentSearch";
import { TradingViewChart, type CandleData } from "@/components/TradingViewChart";
import { cn } from "@/lib/utils";

interface AnalysisResult {
  trend: string;
  strength: number;
  support: number | null;
  resistance: number | null;
  analysis: string;
  signal: string;
  confidence: number;
  entry: number | null;
  target: number | null;
  stopLoss: number | null;
  reasoning: string;
}

interface AnalysisOutput {
  id: string;
  signal_type: string;
  tradingsymbol: string;
  direction: string;
  strength: number;
  confidence: number;
  analysis_data: Record<string, unknown>;
  created_at: string;
  strategy_name: string;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

interface IndicatorOverlay {
  id: string;
  name: string;
  type: "sma" | "ema" | "bollinger" | "support_resistance";
  params?: Record<string, number>;
  color?: string;
  visible: boolean;
}

const DEFAULT_INDICATORS: IndicatorOverlay[] = [
  { id: "sma20", name: "SMA 20", type: "sma", params: { period: 20 }, color: "#f59e0b", visible: false },
  { id: "sma50", name: "SMA 50", type: "sma", params: { period: 50 }, color: "#06b6d4", visible: false },
  { id: "ema9", name: "EMA 9", type: "ema", params: { period: 9 }, color: "#ec4899", visible: false },
  { id: "ema21", name: "EMA 21", type: "ema", params: { period: 21 }, color: "#8b5cf6", visible: false },
  { id: "bollinger", name: "Bollinger Bands", type: "bollinger", params: { period: 20, stdDev: 2 }, visible: false },
];

export default function AnalysisPage() {
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>({
    instrument_token: 256265,
    tradingsymbol: "NIFTY 50",
    name: "NIFTY 50",
    exchange: "NSE",
    segment: "INDICES",
    instrument_type: "EQ",
    lot_size: 1,
    tick_size: 0.05
  } as Instrument);
  const [chartData, setChartData] = useState<CandleData[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisOutputs, setAnalysisOutputs] = useState<AnalysisOutput[]>([]);
  const [isLoadingOutputs, setIsLoadingOutputs] = useState(false);
  const [timeframe, setTimeframe] = useState("15m");
  const [indicators, setIndicators] = useState<IndicatorOverlay[]>(DEFAULT_INDICATORS);
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  const fetchChartData = useCallback(async (instrument: Instrument, tf: string) => {
    setIsLoadingChart(true);
    try {
      const toDate = new Date();
      const fromDate = new Date();
      
      switch (tf) {
        case "1m":
        case "5m":
        case "15m":
          fromDate.setDate(fromDate.getDate() - 5);
          break;
        case "1h":
        case "4h":
          fromDate.setDate(fromDate.getDate() - 30);
          break;
        case "1d":
          fromDate.setDate(fromDate.getDate() - 180);
          break;
        case "1w":
          fromDate.setFullYear(fromDate.getFullYear() - 2);
          break;
        default:
          fromDate.setDate(fromDate.getDate() - 90);
      }
      
      const response = await fetch(
        `/api/market-data/historical?instrument=${instrument.instrument_token}&timeframe=${tf}&from=${fromDate.toISOString()}&to=${toDate.toISOString()}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setChartData(data.candles || []);
      }
    } catch (error) {
      console.error("Error fetching chart data:", error);
    } finally {
      setIsLoadingChart(false);
    }
  }, []);

  const fetchAnalysis = useCallback(async (instrument: Instrument) => {
    setIsLoadingAnalysis(true);
    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumentToken: instrument.instrument_token,
          tradingsymbol: instrument.tradingsymbol,
          timeframe: "1d",
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAnalysis(data.analysis);
        }
      }
    } catch (error) {
      console.error("Error fetching analysis:", error);
    } finally {
      setIsLoadingAnalysis(false);
    }
  }, []);

  const fetchAnalysisOutputs = useCallback(async (instrument: Instrument) => {
    setIsLoadingOutputs(true);
    try {
      const response = await fetch("/api/ai/analysis-output");
      if (response.ok) {
        const data = await response.json();
        const instrumentOutputs = (data.outputs || []).filter(
          (s: AnalysisOutput) => s.tradingsymbol === instrument.tradingsymbol
        );
        setAnalysisOutputs(instrumentOutputs);
      }
    } catch (error) {
      console.error("Error fetching analysis outputs:", error);
    } finally {
      setIsLoadingOutputs(false);
    }
  }, []);

  const fetchStrategies = useCallback(async () => {
    try {
      const response = await fetch("/api/strategies");
      if (response.ok) {
        const data = await response.json();
        setStrategies(data.strategies || []);
      }
    } catch (error) {
      console.error("Error fetching strategies:", error);
    }
  }, []);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  useEffect(() => {
    if (selectedInstrument) {
      fetchChartData(selectedInstrument, timeframe);
      fetchAnalysis(selectedInstrument);
      fetchAnalysisOutputs(selectedInstrument);
    } else {
      setChartData([]);
      setAnalysis(null);
      setAnalysisOutputs([]);
    }
  }, [selectedInstrument, fetchChartData, fetchAnalysis, fetchAnalysisOutputs, timeframe]);

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
    if (selectedInstrument) {
      fetchChartData(selectedInstrument, tf);
    }
  };

  const handleRefresh = () => {
    if (selectedInstrument) {
      fetchChartData(selectedInstrument, timeframe);
      fetchAnalysis(selectedInstrument);
      fetchAnalysisOutputs(selectedInstrument);
    }
  };

  const toggleIndicator = (id: string) => {
    setIndicators(prev => prev.map(ind => 
      ind.id === id ? { ...ind, visible: !ind.visible } : ind
    ));
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return "—";
    return price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.03] backdrop-blur-md p-4 md:p-6 rounded-2xl border border-white/10">
        <div className="flex-1 min-w-[300px]">
          <InstrumentSearch
            onSelect={setSelectedInstrument}
            selectedInstrument={selectedInstrument}
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowIndicatorPanel(!showIndicatorPanel)}
              className="h-10 bg-white/5 border-white/10 hover:bg-white/10 text-xs font-bold uppercase tracking-tight"
            >
              <Settings2 className="w-4 h-4 mr-2" />
              Indicators
              <ChevronDown className={cn("w-3 h-3 ml-1 transition-transform", showIndicatorPanel && "rotate-180")} />
            </Button>
            
            {showIndicatorPanel && (
              <div className="absolute top-full right-0 mt-2 z-50 w-64 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2">
                <div className="text-[10px] text-white/30 px-3 py-2 uppercase font-black tracking-widest">Technical Overlays</div>
                {indicators.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => toggleIndicator(ind.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: ind.color || "#f59e0b" }} />
                      <span className={cn("text-xs font-bold uppercase tracking-tight", ind.visible ? "text-white" : "text-white/30 group-hover:text-white/50")}>{ind.name}</span>
                    </div>
                    {ind.visible ? (
                      <Eye className="w-4 h-4 text-blue-400" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-white/10" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoadingChart || isLoadingAnalysis}
            className="h-10 bg-white/5 border-white/10 hover:bg-white/10 text-xs font-bold uppercase tracking-tight"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", (isLoadingChart || isLoadingAnalysis) && "animate-spin")} />
            Update
          </Button>
        </div>
      </div>

      <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3">
        <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-[10px] md:text-xs text-white/40 leading-relaxed uppercase tracking-tight font-medium">
          Analytical outputs are for informational purposes only. Pattern recognition does not guarantee future results.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Chart Area */}
        <div className="xl:col-span-3 space-y-4">
          <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
            <CardHeader className="p-4 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-blue-400/10 text-blue-400">
                    <LineChart className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <CardTitle className="text-sm font-black uppercase tracking-tight">
                      {selectedInstrument?.tradingsymbol || "Market Overview"}
                    </CardTitle>
                    <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{selectedInstrument?.exchange || "SELECT ASSET"}</span>
                  </div>
                </div>
                {chartData.length > 0 && (
                  <Badge variant="outline" className="text-[10px] font-bold border-white/10 text-white/40">
                    {chartData.length} BARS
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[400px] md:h-[500px]">
                <TradingViewChart
                  data={chartData}
                  symbol={selectedInstrument?.tradingsymbol}
                  support={analysis?.support || undefined}
                  resistance={analysis?.resistance || undefined}
                  isLoading={isLoadingChart}
                  timeframe={timeframe}
                  onTimeframeChange={handleTimeframeChange}
                  indicators={indicators}
                />
              </div>
            </CardContent>
          </Card>

          {/* Key Levels Row */}
          {analysis && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard title="Entry Node" value={`₹${formatPrice(analysis.entry)}`} icon={Target} iconColor="text-blue-400" />
              <StatCard title="Target Exit" value={`₹${formatPrice(analysis.target)}`} icon={ArrowUp} iconColor="text-green-400" valueColor="text-green-400" />
              <StatCard title="Risk Cut" value={`₹${formatPrice(analysis.stopLoss)}`} icon={ArrowDown} iconColor="text-red-400" valueColor="text-red-400" />
              <StatCard title="AI Confidence" value={`${analysis.confidence}%`} icon={BrainCircuit} iconColor="text-purple-400" />
            </div>
          )}
        </div>

        {/* Sidebar Info Area */}
        <div className="xl:col-span-1 space-y-4">
          {/* Trend Analysis */}
          <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm">
            <CardHeader className="p-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Radar className="w-4 h-4 text-purple-400" />
                <CardTitle className="text-xs font-black uppercase tracking-widest">Trend Intelligence</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {isLoadingAnalysis ? (
                <div className="h-40 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                  <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Processing Market Data...</span>
                </div>
              ) : analysis ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "p-1.5 rounded-lg",
                        analysis.trend === "bullish" ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
                      )}>
                        {analysis.trend === "bullish" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      </div>
                      <span className={cn("text-sm font-black uppercase tracking-tight", analysis.trend === "bullish" ? "text-green-400" : "text-red-400")}>
                        {analysis.trend} Trend
                      </span>
                    </div>
                    <Badge className={cn(
                      "text-[10px] font-black uppercase px-2 py-0.5",
                      analysis.signal.toLowerCase() === "buy" ? "bg-green-400 text-black" : "bg-red-400 text-black"
                    )}>
                      {analysis.signal}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                      <span>Signal Strength</span>
                      <span>{analysis.strength}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          analysis.trend === "bullish" ? "bg-green-400" : "bg-red-400"
                        )}
                        style={{ width: `${analysis.strength}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5">
                      <div className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-1">Floor</div>
                      <div className="font-mono font-bold text-xs text-white">₹{formatPrice(analysis.support)}</div>
                    </div>
                    <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5">
                      <div className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-1">Ceiling</div>
                      <div className="font-mono font-bold text-xs text-white">₹{formatPrice(analysis.resistance)}</div>
                    </div>
                  </div>

                  <div className="text-xs text-white/60 leading-relaxed font-medium bg-white/5 p-3 rounded-xl border border-white/5 italic">
                    "{analysis.analysis}"
                  </div>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-center opacity-20">
                  <Radar className="w-8 h-8 mb-2" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Select Asset to Analyze</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Strategy Outputs */}
          <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm">
            <CardHeader className="p-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-green-400" />
                <CardTitle className="text-xs font-black uppercase tracking-widest">Strategy Pulse</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {isLoadingOutputs ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-green-400" />
                </div>
              ) : analysisOutputs.length > 0 ? (
                <div className="space-y-3">
                  {analysisOutputs.slice(0, 3).map((output) => (
                    <div 
                      key={output.id} 
                      className="p-3 bg-white/[0.03] rounded-xl border border-white/5 group hover:bg-white/[0.05] transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-white uppercase tracking-tight">{output.strategy_name}</span>
                        <Badge 
                          variant="outline"
                          className={cn(
                            "text-[9px] font-black border-none h-4 px-1.5",
                            output.direction === "long" ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
                          )}
                        >
                          {output.direction?.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-white/20">
                        <span>Confidence {output.confidence}%</span>
                        <span>{new Date(output.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center opacity-10">
                  <Activity className="w-6 h-6 mx-auto mb-2" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">No Active Pulses</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
