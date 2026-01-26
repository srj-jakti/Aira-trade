"use client";

import { useState, useEffect, useCallback } from "react";
import { BrainCircuit, LineChart, Target, TrendingUp, TrendingDown, Minus, AlertCircle, RefreshCw, ArrowUp, ArrowDown, Loader2, ChevronDown, Eye, EyeOff, Settings2, Info, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InstrumentSearch, type Instrument } from "@/components/InstrumentSearch";
import { TradingViewChart, type CandleData } from "@/components/TradingViewChart";
import { cn } from "@/lib/utils";
import { useLiveCandles } from "@/hooks/use-live-candles";
import { useLatestPrice } from "@/hooks/use-realtime-ticks";

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
    const [initialChartData, setInitialChartData] = useState<CandleData[]>([]);
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

  const { candles: chartData, isConnected: isRealtimeConnected, refetch: refetchCandles } = useLiveCandles({
    instrumentToken: selectedInstrument?.instrument_token || 0,
    timeframe,
    initialData: initialChartData,
    enabled: !!selectedInstrument,
  });

    const { price: currentPrice, tick: currentTick, isConnected: isPriceConnected } = useLatestPrice({
      instrumentToken: selectedInstrument?.instrument_token || 0,
      enabled: !!selectedInstrument,
    });


  const requestSubscription = useCallback(async (instrumentToken: number) => {
    try {
      await fetch("/api/market-data/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrumentToken, source: "ai_analysis" }),
      });
    } catch (e) {
    }
  }, []);

  const fetchChartData = useCallback(async (instrument: Instrument, tf: string) => {
    setIsLoadingChart(true);
    try {
      await requestSubscription(instrument.instrument_token);

const response = await fetch(
          `/api/market-data/live?instrument=${instrument.instrument_token}&timeframe=${tf}&limit=500`
        );
      
      if (response.ok) {
        const data = await response.json();
        setInitialChartData(data.candles || []);
      }
    } catch (error) {
      console.error("Error fetching chart data:", error);
    } finally {
      setIsLoadingChart(false);
    }
  }, [requestSubscription]);

  const fetchAnalysis = useCallback(async (instrument: Instrument, tf: string) => {
    setIsLoadingAnalysis(true);
    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumentToken: instrument.instrument_token,
          tradingsymbol: instrument.tradingsymbol,
          timeframe: tf,
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
      fetchAnalysis(selectedInstrument, timeframe);
      fetchAnalysisOutputs(selectedInstrument);
    } else {
      setInitialChartData([]);
      setAnalysis(null);
      setAnalysisOutputs([]);
    }
  }, [selectedInstrument, fetchChartData, fetchAnalysis, fetchAnalysisOutputs, timeframe]);

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
    if (selectedInstrument) {
      fetchChartData(selectedInstrument, tf);
      fetchAnalysis(selectedInstrument, tf);
    }
  };

  const handleRefresh = () => {
    if (selectedInstrument) {
      fetchChartData(selectedInstrument, timeframe);
      fetchAnalysis(selectedInstrument, timeframe);
      fetchAnalysisOutputs(selectedInstrument);
      refetchCandles();
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
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case "bearish":
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend?.toLowerCase()) {
      case "bullish":
        return "text-green-600";
      case "bearish":
        return "text-red-600";
      default:
        return "text-yellow-600";
    }
  };

  const getDirectionBadge = (direction: string) => {
    switch (direction?.toLowerCase()) {
      case "buy":
      case "long":
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">LONG</Badge>;
      case "sell":
      case "short":
        return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">SHORT</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">NEUTRAL</Badge>;
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return "—";
    return price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="p-2 md:p-4 space-y-3 max-w-[1600px] mx-auto pt-14 md:pt-2">
      <div className="flex flex-col gap-2">
        <InstrumentSearch
          onSelect={setSelectedInstrument}
          selectedInstrument={selectedInstrument}
          className="w-full"
        />
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-0.5 bg-muted/50 border border-white/10 p-0.5 rounded-md shrink-0">
            {[
              { label: "1m", value: "1m" },
              { label: "5m", value: "5m" },
              { label: "15m", value: "15m" },
              { label: "1H", value: "1h" },
              { label: "4H", value: "4h" },
              { label: "1D", value: "1d" },
            ].map((tf) => (
              <button
                key={tf.value}
                onClick={() => handleTimeframeChange(tf.value)}
                className={cn(
                  "px-1.5 sm:px-2 py-1 text-[10px] rounded transition-all whitespace-nowrap",
                  timeframe === tf.value
                    ? "bg-blue-500/20 text-blue-600 font-semibold ring-1 ring-blue-500/30"
                    : "text-white/40 hover:text-white/70 hover:bg-muted/50"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div className="relative shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowIndicatorPanel(!showIndicatorPanel)}
              className="bg-card border-border hover:bg-accent/50 h-7 px-1.5 sm:px-2 text-xs"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline ml-1">Ind</span>
              <ChevronDown className={cn("w-3 h-3 ml-0.5 transition-transform", showIndicatorPanel && "rotate-180")} />
            </Button>
            
            {showIndicatorPanel && (
              <div className="absolute top-full right-0 mt-1 z-50 w-56 bg-popover/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl p-2">
                <div className="text-xs text-white/40 px-2 py-1 mb-1">Technical Indicators</div>
                {indicators.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => toggleIndicator(ind.id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: ind.color || "#f59e0b" }} />
                      <span className={ind.visible ? "text-white" : "text-white/50"}>{ind.name}</span>
                    </div>
                    {ind.visible ? (
                      <Eye className="w-4 h-4 text-blue-600" />
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
              className="bg-card border-border hover:bg-accent/50 h-7 px-1.5 sm:px-2 text-xs shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${(isLoadingChart || isLoadingAnalysis) ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline ml-1">Refresh</span>
            </Button>
          )}
        </div>
      </div>

      <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-[10px] text-blue-300/80">
          AI analysis outputs are for informational purposes only. They do not constitute investment advice.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="p-2 md:p-3 border-b border-white/10">
                <CardTitle className="text-xs font-medium flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LineChart className="w-3.5 h-3.5 text-blue-600" />
                    {selectedInstrument ? (
                      <span>
                        {selectedInstrument.tradingsymbol}
                        <span className="text-white/50 ml-2 text-xs">{selectedInstrument.exchange}</span>
                          {currentPrice && (
                            <div className="flex flex-col ml-2">
                              <span className="font-mono text-green-600">
                                ₹{currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="text-[10px] text-blue-600 font-bold -mt-1 uppercase">
                                {timeframe} LIVE TRACKING
                              </span>
                            </div>
                          )}

                      </span>
                    ) : (
                      "Market Chart"
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isRealtimeConnected ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <Wifi className="w-3 h-3" />
                        <span className="text-[10px] uppercase font-bold">Live</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-white/30">
                        <WifiOff className="w-3 h-3" />
                        <span className="text-[10px] uppercase">Offline</span>
                      </div>
                    )}
                    {chartData.length > 0 && (
                      <span className="text-xs text-white/40">{chartData.length} candles</span>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
            <CardContent className="p-0">
              <div className="h-[250px] md:h-[320px]">
                    <TradingViewChart
                      data={chartData}
                      symbol={selectedInstrument?.tradingsymbol}
                      support={analysis?.support || undefined}
                      resistance={analysis?.resistance || undefined}
                      isLoading={isLoadingChart}
                      timeframe={timeframe}
                      onTimeframeChange={handleTimeframeChange}
                      indicators={indicators}
                      lastPrice={currentPrice}
                      tick={currentTick}
                    />


              </div>
            </CardContent>
          </Card>

            {analysis && chartData.length > 0 && (
              <Card className="bg-card border-border">
                <CardContent className="p-2 md:p-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <div className="text-[10px] text-white/50 mb-0.5">Entry Price</div>
                      <div className="font-mono font-semibold text-blue-600 text-sm">{formatPrice(analysis.entry)}</div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <div className="text-[10px] text-white/50 mb-0.5">Target</div>
                      <div className="font-mono font-semibold text-green-600 flex items-center justify-center gap-1 text-sm">
                        <ArrowUp className="w-3 h-3" />
                        {formatPrice(analysis.target)}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <div className="text-[10px] text-white/50 mb-0.5">Stop Loss</div>
                      <div className="font-mono font-semibold text-red-600 flex items-center justify-center gap-1 text-sm">
                        <ArrowDown className="w-3 h-3" />
                        {formatPrice(analysis.stopLoss)}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <div className="text-[10px] text-white/50 mb-0.5">Confidence</div>
                      <div className="font-mono font-semibold text-purple-600 text-sm">{analysis.confidence}%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

        <div className="lg:col-span-1 space-y-3">
          <Card className="bg-card border-border">
            <CardHeader className="p-2 md:p-3 border-b border-white/10">
              <CardTitle className="text-xs font-medium flex items-center gap-2">
                <BrainCircuit className="w-3.5 h-3.5 text-purple-600" />
                AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-3">
              {isLoadingAnalysis ? (
                <div className="min-h-[200px] flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
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
                    {getDirectionBadge(analysis.signal)}
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

                  <div className="text-sm text-white/70 leading-relaxed">
                    {analysis.analysis}
                  </div>
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

            <Card className="bg-card border-border">
              <CardHeader className="p-3 md:p-4 border-b border-white/10">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-600" />
                  Strategy Overlay
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2">
                  {strategies.length > 0 ? (
                    <>
                      <button
                        onClick={() => setSelectedStrategy(null)}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded-full border transition-colors",
                          !selectedStrategy
                            ? "bg-blue-500/20 text-blue-600 border-blue-500/30"
                            : "bg-muted/50 text-white/50 border-white/10 hover:bg-accent/50"
                        )}
                      >
                        None
                      </button>
                      {strategies.map((strategy) => (
                        <button
                          key={strategy.id}
                          onClick={() => setSelectedStrategy(strategy.id)}
                          className={cn(
                            "px-3 py-1.5 text-xs rounded-full border transition-colors",
                            selectedStrategy === strategy.id
                              ? "bg-indigo-500/20 text-indigo-600 border-indigo-500/30"
                              : "bg-muted/50 text-white/50 border-white/10 hover:bg-accent/50"
                          )}
                        >
                          {strategy.name}
                        </button>
                      ))}
                    </>
                  ) : (
                    <span className="text-xs text-white/30 italic">No strategies available. Create one in the Strategy section.</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="p-3 md:p-4 border-b border-white/10">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="w-4 h-4 text-green-600" />
                  Strategy Analysis Outputs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {isLoadingOutputs ? (
                <div className="min-h-[150px] flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                  <span className="text-white/50 text-xs">Loading outputs...</span>
                </div>
              ) : analysisOutputs.length > 0 ? (
                <div className="space-y-3">
                  {analysisOutputs.slice(0, 5).map((output) => (
                    <div 
                      key={output.id} 
                      className="p-3 bg-muted/50 rounded-lg border border-white/5"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{output.strategy_name}</span>
                        <Badge 
                          className={
                            output.direction === "long" 
                              ? "bg-green-500/20 text-green-600 border-green-500/30" 
                              : "bg-red-500/20 text-red-600 border-red-500/30"
                          }
                        >
                          {output.direction?.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50">Confidence: {output.confidence}%</span>
                        <span className="text-white/40">
                          {new Date(output.created_at).toLocaleDateString()}
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
                      No active outputs for {selectedInstrument.tradingsymbol}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="min-h-[150px] flex items-center justify-center text-center">
                  <p className="text-white/30 text-xs md:text-sm">
                    Select an instrument to view outputs
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
