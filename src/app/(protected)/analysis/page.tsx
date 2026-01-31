"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowDown, ArrowUp, BrainCircuit, ChevronDown, Eye, EyeOff, Info, LineChart, Loader2, Minus, RefreshCw, Settings2, Sparkles, Target, TrendingDown, TrendingUp, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { InstrumentSearch, type Instrument } from "@/components/InstrumentSearch";
import { TradingViewChart, type CandleData } from "@/components/TradingViewChart";
import { cn } from "@/lib/utils";
import { useLiveCandles } from "@/hooks/use-live-candles";
import { useLatestPrice } from "@/hooks/use-realtime-ticks";
import { toast } from "sonner";

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

import { Input } from "@/components/ui/input";

interface IndicatorOverlay {
  id: string;
  name: string;
  type: "sma" | "ema" | "bollinger" | "vwap" | "supertrend" | "support_resistance" | "rsi" | "macd" | "stochastic" | "atr";
  params?: Record<string, number>;
  color?: string;
  visible: boolean;
}

const DEFAULT_INDICATORS: IndicatorOverlay[] = [
  { id: "sma20", name: "SMA 20", type: "sma", params: { period: 20 }, color: "#f59e0b", visible: false },
  { id: "sma50", name: "SMA 50", type: "sma", params: { period: 50 }, color: "#06b6d4", visible: false },
  { id: "sma200", name: "SMA 200", type: "sma", params: { period: 200 }, color: "#3b82f6", visible: false },
  { id: "ema9", name: "EMA 9", type: "ema", params: { period: 9 }, color: "#ec4899", visible: false },
  { id: "ema21", name: "EMA 21", type: "ema", params: { period: 21 }, color: "#8b5cf6", visible: false },
  { id: "bollinger", name: "Bollinger Bands", type: "bollinger", params: { period: 20, stdDev: 2 }, color: "#3b82f6", visible: false },
  { id: "vwap", name: "VWAP", type: "vwap", params: {}, color: "#a855f7", visible: false },
  { id: "supertrend", name: "Supertrend", type: "supertrend", params: { period: 10, multiplier: 3 }, visible: false },
  { id: "rsi", name: "RSI", type: "rsi", params: { period: 14 }, color: "#8b5cf6", visible: false },
  { id: "macd", name: "MACD", type: "macd", params: { fast: 12, slow: 26, signal: 9 }, color: "#3b82f6", visible: false },
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
  const [expandedIndicatorId, setExpandedIndicatorId] = useState<string | null>(null);
  
  // Predictive Brain State
  // We now enable predictive mode by default or based on system config, removing user toggle for simpler UX
  const [predictiveMode] = useState(true);
  const [predictivePath, _setPredictivePath] = useState<{ time: string; price: number }[]>([]);
  const [_swingPoints, _setSwingPoints] = useState<{ time: string; price: number; type: "HIGH" | "LOW" }[]>([]);

  const { candles: chartData, isConnected: isRealtimeConnected, refetch: refetchCandles } = useLiveCandles({
    instrumentToken: selectedInstrument?.instrument_token || 0,
    timeframe,
    initialData: initialChartData,
    enabled: !!selectedInstrument,
  });

    const { price: currentPrice, tick: currentTick, isConnected: _isPriceConnected } = useLatestPrice({
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
    } catch (error) {
      console.error("Failed to subscribe to instrument:", error);
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
      } else {
        throw new Error(`API Error: ${response.status}`);
      }
    } catch (error) {
      console.error("Error fetching chart data:", error);
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        toast.error("Network error: Unable to reach market data server. Please check your connection.");
      } else {
        toast.error("Failed to load chart data");
      }
    } finally {
      setIsLoadingChart(false);
    }
  }, [requestSubscription]);

  const fetchAnalysis = useCallback(async (instrument: Instrument, tf: string) => {
    setIsLoadingAnalysis(true);
    try {
      const activeIndicators = indicators.filter(i => i.visible).map(i => i.id);
      
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumentToken: instrument.instrument_token,
          tradingsymbol: instrument.tradingsymbol,
          timeframe: tf,
          activeIndicators, // Pass active indicators to AI
          selectedStrategy: selectedStrategy // Pass active strategy to AI
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAnalysis(data.analysis);
        } else {
          toast.error(data.error || "Analysis failed");
        }
      } else {
        throw new Error(`API Error: ${response.status}`);
      }
    } catch (error) {
      console.error("Error fetching analysis:", error);
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        toast.error("Network error: AI service unreachable");
      }
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
      } else {
        throw new Error(`API Error: ${response.status}`);
      }
    } catch (error) {
      console.error("Error fetching analysis outputs:", error);
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        toast.error("Network error: Unable to fetch analysis history");
      }
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

  const updateIndicatorParams = (id: string, paramName: string, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    
    setIndicators(prev => prev.map(ind => 
      ind.id === id ? { ...ind, params: { ...ind.params, [paramName]: numValue } } : ind
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
    <div className="p-1.5 md:p-4 space-y-1.5 md:space-y-2 max-w-[1600px] mx-auto">
        <div className="flex flex-col gap-1 md:gap-2">
        <InstrumentSearch
          onSelect={setSelectedInstrument}
          selectedInstrument={selectedInstrument}
          className="w-full"
        />
        <div className="flex items-center gap-1 flex-wrap">
          <div className="flex items-center gap-0.5 bg-muted/50 border border-border p-0.5 rounded-md shrink-0">
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
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
              <div className="absolute top-full right-0 mt-1 z-50 w-72 bg-popover/95 backdrop-blur-md border border-border rounded-lg shadow-xl p-2">
                <div className="text-xs text-muted-foreground px-2 py-1 mb-1">Technical Indicators</div>
                <div className="max-h-[300px] overflow-y-auto space-y-1">
                  {indicators.map((ind) => (
                    <div key={ind.id} className="border border-border/40 rounded-md overflow-hidden bg-card/50">
                      <div className="flex items-center justify-between px-2 py-1.5 hover:bg-muted/50 transition-colors">
                        <button
                          onClick={() => toggleIndicator(ind.id)}
                          className="flex items-center gap-2 flex-1 text-sm text-left"
                        >
                          <div className="w-3 h-3 rounded shrink-0" style={{ backgroundColor: ind.color || "#f59e0b" }} />
                          <span className={ind.visible ? "text-foreground font-medium" : "text-muted-foreground"}>{ind.name}</span>
                        </button>
                        
                        <div className="flex items-center gap-1">
                          {ind.params && Object.keys(ind.params).length > 0 && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={cn("h-6 w-6 text-muted-foreground hover:text-foreground", expandedIndicatorId === ind.id && "bg-muted text-foreground")}
                              onClick={() => setExpandedIndicatorId(expandedIndicatorId === ind.id ? null : ind.id)}
                            >
                              <Settings2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <button onClick={() => toggleIndicator(ind.id)} className="p-1 hover:text-foreground text-muted-foreground">
                             {ind.visible ? (
                              <Eye className="w-4 h-4 text-blue-600" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {expandedIndicatorId === ind.id && ind.params && (
                        <div className="p-2 bg-muted/30 border-t border-border/40 space-y-2 animate-in slide-in-from-top-1 duration-200">
                           {Object.entries(ind.params).map(([key, val]) => (
                             <div key={key} className="flex items-center gap-2">
                               <Label className="text-[10px] text-muted-foreground w-16 capitalize">{key}</Label>
                               <Input 
                                  type="number" 
                                  className="h-6 text-xs" 
                                  value={val} 
                                  onChange={(e) => updateIndicatorParams(ind.id, key, e.target.value)}
                               />
                             </div>
                           ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 md:gap-3">
          <div className="lg:col-span-2 space-y-2 md:space-y-3">
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="p-2 md:p-3 border-b border-border">
                <CardTitle className="text-xs font-medium flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LineChart className="w-3.5 h-3.5 text-blue-600" />
                    {selectedInstrument ? (
                      <span>
                        {selectedInstrument.tradingsymbol}
                        <span className="text-muted-foreground ml-2 text-xs">{selectedInstrument.exchange}</span>
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
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <WifiOff className="w-3 h-3" />
                        <span className="text-[10px] uppercase">Offline</span>
                      </div>
                    )}
                    {chartData.length > 0 && (
                      <span className="text-xs text-muted-foreground">{chartData.length} candles</span>
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
                      showVolume={false}
                      lastPrice={currentPrice}
                      tick={currentTick}
                    />


              </div>
            </CardContent>
          </Card>

            {/* Always render container if we have an instrument selected, show skeleton or content */}
            {selectedInstrument && (
              <>
                <Card className="bg-card border-border mb-3 overflow-hidden">
                  <CardHeader className="p-3 md:p-4 border-b border-border bg-gradient-to-r from-purple-500/10 to-blue-500/10">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BrainCircuit className="w-4 h-4 text-purple-500" />
                        <span>Unified AI Intelligence</span>
                      </div>
                      {predictiveMode && (
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px] gap-1">
                          <Sparkles className="w-3 h-3" />
                          Predictive Brain Active
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {isLoadingAnalysis ? (
                      <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                        <p className="text-sm text-muted-foreground animate-pulse">Running Deep Learning Analysis...</p>
                      </div>
                    ) : analysis ? (
                      <>
                        {/* Top Stats Row */}
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className={`p-2 rounded-lg ${
                                analysis.trend === "bullish" ? "bg-green-500/10" : 
                                analysis.trend === "bearish" ? "bg-red-500/10" : "bg-yellow-500/10"
                              }`}>
                                {getTrendIcon(analysis.trend)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`font-bold uppercase tracking-tight ${getTrendColor(analysis.trend)}`}>
                                    {analysis.trend}
                                  </span>
                                  {getDirectionBadge(analysis.signal)}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                  <span>Strength: {analysis.strength}%</span>
                                  <span className="w-1 h-1 bg-muted-foreground rounded-full" />
                                  <span>Conf: {analysis.confidence}%</span>
                                </div>
                              </div>
                          </div>

                          {predictiveMode && predictivePath.length > 0 && (
                            <div className="flex gap-4 w-full md:w-auto bg-purple-500/5 p-2 rounded-lg border border-purple-500/10">
                               <div className="text-center">
                                  <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Forecast High</p>
                                  <p className="text-green-400 font-mono text-xs font-bold">
                                    ₹{formatPrice((predictivePath[predictivePath.length - 1]?.price || 0) * 1.002)}
                                  </p>
                               </div>
                               <div className="w-px bg-purple-500/20" />
                               <div className="text-center">
                                  <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Forecast Low</p>
                                  <p className="text-red-400 font-mono text-xs font-bold">
                                    ₹{formatPrice((predictivePath[predictivePath.length - 1]?.price || 0) * 0.998)}
                                  </p>
                               </div>
                            </div>
                          )}
                        </div>

                        {/* Semantic Analysis Text */}
                        <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                          <p className="text-sm leading-relaxed text-foreground/80">
                            {analysis.analysis}
                          </p>
                          {predictiveMode && (
                            <div className="mt-3 pt-3 border-t border-dashed border-purple-500/20 flex items-start gap-2">
                              <Sparkles className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                              <p className="text-xs text-purple-300 italic">
                                &quot;Predictive model suggests a {((predictivePath[predictivePath.length - 1]?.price || 0) > (currentPrice || 0)) ? "continuation upside" : "potential pullback"} in the next hour based on volatility structure.&quot;
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Action Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="p-2 bg-muted/50 rounded-lg border border-border/50">
                            <div className="text-[10px] text-muted-foreground mb-1">Entry Zone</div>
                            <div className="font-mono text-sm font-semibold text-blue-500">₹{formatPrice(analysis.entry)}</div>
                          </div>
                          <div className="p-2 bg-muted/50 rounded-lg border border-border/50">
                            <div className="text-[10px] text-muted-foreground mb-1">Target</div>
                            <div className="font-mono text-sm font-semibold text-green-500 flex items-center gap-1">
                              <ArrowUp className="w-3 h-3" />
                              ₹{formatPrice(analysis.target)}
                            </div>
                          </div>
                          <div className="p-2 bg-muted/50 rounded-lg border border-border/50">
                            <div className="text-[10px] text-muted-foreground mb-1">Stop Loss</div>
                            <div className="font-mono text-sm font-semibold text-red-500 flex items-center gap-1">
                              <ArrowDown className="w-3 h-3" />
                              ₹{formatPrice(analysis.stopLoss)}
                            </div>
                          </div>
                           <div className="p-2 bg-muted/50 rounded-lg border border-border/50">
                            <div className="text-[10px] text-muted-foreground mb-1">AI Conviction</div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                               <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${analysis.confidence}%` }} />
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center min-h-[150px] text-muted-foreground">
                        <BrainCircuit className="w-10 h-10 mb-2 opacity-20" />
                        <p className="text-sm">Waiting for market data...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>

        <div className="lg:col-span-1 space-y-3">
          {/* AI Analysis Card Removed - Merged into Unified Intelligence */}
            <Card className="bg-card border-border">
              <CardHeader className="p-3 md:p-4 border-b border-border">
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
                            : "bg-muted/50 text-muted-foreground border-border hover:bg-accent/50"
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
                              : "bg-muted/50 text-muted-foreground border-border hover:bg-accent/50"
                          )}
                        >
                          {strategy.name}
                        </button>
                      ))}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No strategies available. Create one in the Strategy section.</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="p-3 md:p-4 border-b border-border">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="w-4 h-4 text-green-600" />
                  Strategy Analysis Outputs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {isLoadingOutputs ? (
                  <div className="min-h-[150px] flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                    <span className="text-muted-foreground text-xs">Loading outputs...</span>
                  </div>
                ) : analysisOutputs.length > 0 ? (
                  <div className="space-y-3">
                    {analysisOutputs.slice(0, 5).map((output) => (
                      <div 
                        key={output.id} 
                        className="p-3 bg-muted/50 rounded-lg border border-border"
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
                          <span className="text-muted-foreground">Confidence: {output.confidence}%</span>
                          <span className="text-muted-foreground">
                            {new Date(output.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : selectedInstrument ? (
                  <div className="min-h-[150px] flex items-center justify-center text-center">
                    <div>
                      <Target className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-xs">
                        No active outputs for {selectedInstrument.tradingsymbol}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-[150px] flex items-center justify-center text-center">
                    <p className="text-muted-foreground text-xs md:text-sm">
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
