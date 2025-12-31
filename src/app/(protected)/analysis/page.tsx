"use client";

import { useState, useEffect, useCallback } from "react";
import { BrainCircuit, LineChart, Target, TrendingUp, TrendingDown, Minus, AlertCircle, RefreshCw, ArrowUp, ArrowDown, Loader2, ChevronDown, Eye, EyeOff, Settings2 } from "lucide-react";
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

interface Signal {
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
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
  const [chartData, setChartData] = useState<CandleData[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoadingSignals, setIsLoadingSignals] = useState(false);
  const [timeframe, setTimeframe] = useState("1d");
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

  const fetchSignals = useCallback(async (instrument: Instrument) => {
    setIsLoadingSignals(true);
    try {
      const response = await fetch("/api/ai/signals");
      if (response.ok) {
        const data = await response.json();
        const instrumentSignals = (data.signals || []).filter(
          (s: Signal) => s.tradingsymbol === instrument.tradingsymbol
        );
        setSignals(instrumentSignals);
      }
    } catch (error) {
      console.error("Error fetching signals:", error);
    } finally {
      setIsLoadingSignals(false);
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
      fetchSignals(selectedInstrument);
    } else {
      setChartData([]);
      setAnalysis(null);
      setSignals([]);
    }
  }, [selectedInstrument, fetchChartData, fetchAnalysis, fetchSignals, timeframe]);

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
      fetchSignals(selectedInstrument);
    }
  };

  const toggleIndicator = (id: string) => {
    setIndicators(prev => prev.map(ind => 
      ind.id === id ? { ...ind, visible: !ind.visible } : ind
    ));
  };

  const getTrendIcon = (trend: string) => {
    switch (trend?.toLowerCase()) {
      case "bullish":
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case "bearish":
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend?.toLowerCase()) {
      case "bullish":
        return "text-green-400";
      case "bearish":
        return "text-red-400";
      default:
        return "text-yellow-400";
    }
  };

  const getSignalBadge = (signal: string) => {
    switch (signal?.toLowerCase()) {
      case "buy":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">BUY</Badge>;
      case "sell":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">SELL</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">HOLD</Badge>;
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return "—";
    return price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="p-2 md:p-4 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <InstrumentSearch
          onSelect={setSelectedInstrument}
          selectedInstrument={selectedInstrument}
          className="flex-1 min-w-[280px]"
        />
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowIndicatorPanel(!showIndicatorPanel)}
              className="bg-white/5 border-white/10 hover:bg-white/10"
            >
              <Settings2 className="w-4 h-4 mr-2" />
              Indicators
              <ChevronDown className={cn("w-3 h-3 ml-1 transition-transform", showIndicatorPanel && "rotate-180")} />
            </Button>
            
            {showIndicatorPanel && (
              <div className="absolute top-full right-0 mt-1 z-50 w-56 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl p-2">
                <div className="text-xs text-white/40 px-2 py-1 mb-1">Technical Indicators</div>
                {indicators.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => toggleIndicator(ind.id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: ind.color || "#f59e0b" }} />
                      <span className={ind.visible ? "text-white" : "text-white/50"}>{ind.name}</span>
                    </div>
                    {ind.visible ? (
                      <Eye className="w-4 h-4 text-blue-400" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-white/30" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {selectedInstrument && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoadingChart || isLoadingAnalysis}
              className="bg-white/5 border-white/10 hover:bg-white/10"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${(isLoadingChart || isLoadingAnalysis) ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-white/5 border-white/10 overflow-hidden">
            <CardHeader className="p-3 md:p-4 border-b border-white/10">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LineChart className="w-4 h-4 text-blue-400" />
                  {selectedInstrument ? (
                    <span>
                      {selectedInstrument.tradingsymbol}
                      <span className="text-white/50 ml-2 text-xs">{selectedInstrument.exchange}</span>
                    </span>
                  ) : (
                    "Market Chart"
                  )}
                </div>
                {chartData.length > 0 && (
                  <span className="text-xs text-white/40">{chartData.length} candles</span>
                )}
              </CardTitle>
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

          {analysis && chartData.length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-white/5 rounded-lg">
                    <div className="text-xs text-white/50 mb-1">Entry Price</div>
                    <div className="font-mono font-semibold text-blue-400">{formatPrice(analysis.entry)}</div>
                  </div>
                  <div className="text-center p-3 bg-white/5 rounded-lg">
                    <div className="text-xs text-white/50 mb-1">Target</div>
                    <div className="font-mono font-semibold text-green-400 flex items-center justify-center gap-1">
                      <ArrowUp className="w-3 h-3" />
                      {formatPrice(analysis.target)}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-white/5 rounded-lg">
                    <div className="text-xs text-white/50 mb-1">Stop Loss</div>
                    <div className="font-mono font-semibold text-red-400 flex items-center justify-center gap-1">
                      <ArrowDown className="w-3 h-3" />
                      {formatPrice(analysis.stopLoss)}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-white/5 rounded-lg">
                    <div className="text-xs text-white/50 mb-1">Confidence</div>
                    <div className="font-mono font-semibold text-purple-400">{analysis.confidence}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="p-3 md:p-4 border-b border-white/10">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-400" />
                Strategy Overlay
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedStrategy(null)}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-full border transition-colors",
                    !selectedStrategy
                      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
                  )}
                >
                  None
                </button>
                {strategies.slice(0, 6).map((strategy) => (
                  <button
                    key={strategy.id}
                    onClick={() => setSelectedStrategy(strategy.id)}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-full border transition-colors",
                      selectedStrategy === strategy.id
                        ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
                        : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
                    )}
                  >
                    {strategy.name}
                  </button>
                ))}
                {strategies.length === 0 && (
                  <span className="text-xs text-white/30">No strategies available</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="p-3 md:p-4 border-b border-white/10">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-purple-400" />
                AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {isLoadingAnalysis ? (
                <div className="min-h-[200px] flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                  <span className="text-white/50 text-sm">Analyzing...</span>
                </div>
              ) : analysis ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getTrendIcon(analysis.trend)}
                      <span className={`font-semibold capitalize ${getTrendColor(analysis.trend)}`}>
                        {analysis.trend}
                      </span>
                    </div>
                    {getSignalBadge(analysis.signal)}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Trend Strength</span>
                      <span className="font-medium">{analysis.strength}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          analysis.trend === "bullish" ? "bg-green-500" : 
                          analysis.trend === "bearish" ? "bg-red-500" : "bg-yellow-500"
                        }`}
                        style={{ width: `${analysis.strength}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 bg-green-500/10 rounded border border-green-500/20">
                      <div className="text-green-400/70 text-xs">Support</div>
                      <div className="font-mono font-medium text-green-400">{formatPrice(analysis.support)}</div>
                    </div>
                    <div className="p-2 bg-red-500/10 rounded border border-red-500/20">
                      <div className="text-red-400/70 text-xs">Resistance</div>
                      <div className="font-mono font-medium text-red-400">{formatPrice(analysis.resistance)}</div>
                    </div>
                  </div>

                  <div className="text-sm text-white/70 leading-relaxed">
                    {analysis.analysis}
                  </div>

                  {analysis.reasoning && (
                    <div className="pt-3 border-t border-white/10">
                      <div className="text-xs text-white/40 mb-1">Signal Reasoning</div>
                      <div className="text-sm text-white/60">{analysis.reasoning}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="min-h-[200px] flex items-center justify-center text-center">
                  <div>
                    <AlertCircle className="w-8 h-8 text-white/20 mx-auto mb-2" />
                    <p className="text-white/30 text-xs md:text-sm">
                      Select an instrument to view AI analysis
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="p-3 md:p-4 border-b border-white/10">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="w-4 h-4 text-green-400" />
                Strategy Signals
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {isLoadingSignals ? (
                <div className="min-h-[150px] flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-green-400" />
                  <span className="text-white/50 text-xs">Loading signals...</span>
                </div>
              ) : signals.length > 0 ? (
                <div className="space-y-3">
                  {signals.slice(0, 5).map((signal) => (
                    <div 
                      key={signal.id} 
                      className="p-3 bg-white/5 rounded-lg border border-white/5"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{signal.strategy_name}</span>
                        <Badge 
                          className={
                            signal.direction === "long" 
                              ? "bg-green-500/20 text-green-400 border-green-500/30" 
                              : "bg-red-500/20 text-red-400 border-red-500/30"
                          }
                        >
                          {signal.direction?.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50">Confidence: {signal.confidence}%</span>
                        <span className="text-white/40">
                          {new Date(signal.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedInstrument ? (
                <div className="min-h-[150px] flex items-center justify-center text-center">
                  <div>
                    <Target className="w-6 h-6 text-white/20 mx-auto mb-2" />
                    <p className="text-white/30 text-xs">
                      No active signals for {selectedInstrument.tradingsymbol}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="min-h-[150px] flex items-center justify-center text-center">
                  <p className="text-white/30 text-xs md:text-sm">
                    Select an instrument to view signals
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
