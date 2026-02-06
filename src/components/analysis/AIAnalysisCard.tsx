import { ArrowDown, ArrowUp, BrainCircuit, Share2, Sparkles, TrendingDown, TrendingUp, Minus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface AnalysisResult {
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

interface AIAnalysisCardProps {
  analysis: AnalysisResult | null;
  isLoading: boolean;
  predictiveMode: boolean;
  predictivePath: { time: string; price: number }[];
  currentPrice: number | null;
  onShare?: () => void;
  showShareButton?: boolean;
}

export function AIAnalysisCard({
  analysis,
  isLoading,
  predictiveMode,
  predictivePath,
  currentPrice,
  onShare,
  showShareButton = false,
}: AIAnalysisCardProps) {
  const formatPrice = (price: number | null) => {
    if (price === null) return "—";
    return price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  return (
    <Card className="bg-card border-border mb-3 overflow-hidden">
      <CardHeader className="p-3 md:p-4 border-b border-border bg-gradient-to-r from-purple-500/10 to-blue-500/10">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-purple-500" />
            <span>Unified AI Intelligence</span>
          </div>
          <div className="flex items-center gap-2">
            {predictiveMode && (
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px] gap-1 hidden sm:flex">
                <Sparkles className="w-3 h-3" />
                Predictive Brain Active
              </Badge>
            )}
            {showShareButton && analysis && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-xs gap-1.5 bg-background/50 hover:bg-background"
                onClick={onShare}
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {isLoading ? (
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
              {predictiveMode && currentPrice && predictivePath.length > 0 && (
                <div className="mt-3 pt-3 border-t border-dashed border-purple-500/20 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-purple-300 italic">
                    &quot;Predictive model suggests a {((predictivePath[predictivePath.length - 1]?.price || 0) > currentPrice) ? "continuation upside" : "potential pullback"} in the next hour based on volatility structure.&quot;
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
  );
}
