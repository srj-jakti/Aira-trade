import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AIAnalysisCard } from "@/components/analysis/AIAnalysisCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Calendar, LineChart } from "lucide-react";
import Link from "next/link";
import { TradingViewChart } from "@/components/TradingViewChart";

export const metadata = {
  title: "AiRA Analysis Snapshot",
  description: "Shared AI market analysis and strategy insights.",
};

interface SharedPageProps {
  params: Promise<{
    shareId: string;
  }>;
}

export default async function SharedAnalysisPage({ params }: SharedPageProps) {
  const { shareId } = await params;

  // Fetch snapshot
  const { data: snapshot, error } = await supabaseAdmin
    .from("shared_analysis")
    .select("*")
    .eq("id", shareId)
    .single();

  if (error || !snapshot) {
    notFound();
  }

  const analysis = snapshot.analysis_data;
  const { instrument_token, tradingsymbol, timeframe, created_at, chart_config } = snapshot;
  const date = new Date(created_at).toLocaleString();

  // Extract chart data from snapshot config
  const candles = chart_config?.candles || [];
  const indicators = chart_config?.indicators || [];
  const lastPrice = chart_config?.lastPrice || null;

  // Determine the exact candle timestamp for analysis
  let analysisTime = date;
  if (candles.length > 0) {
    const lastCandle = candles[candles.length - 1];
    analysisTime = new Date(lastCandle.timestamp).toLocaleString();
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <BrainCircuit className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500">
                AiRA Analysis
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{tradingsymbol}</Badge>
                <Badge variant="secondary">{timeframe}</Badge>
                <span className="flex items-center gap-1 text-xs" title="Snapshot Created At">
                  <Calendar className="h-3 w-3" />
                  {date}
                </span>
              </div>
            </div>
          </div>
          
          <Button asChild className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 border-0 shadow-lg shadow-blue-500/20">
            <Link href="https://aira.trade/signup">
              Try AiRA for Free
            </Link>
          </Button>
        </div>

        {/* Analysis Timing Info */}
        <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-600">
          <LineChart className="h-3.5 w-3.5" />
          <span>
            <strong>Analysis Point:</strong> AI analyzed market structure based on candle closed at <strong>{analysisTime}</strong>
          </span>
        </div>

        {/* Chart Snapshot */}
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="p-4 border-b border-border">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <LineChart className="h-4 w-4 text-blue-500" />
              Market Context (Snapshot)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[400px] relative bg-card">
             {candles.length > 0 ? (
               <TradingViewChart
                 data={candles}
                 symbol={tradingsymbol}
                 timeframe={timeframe}
                 onTimeframeChange={() => {}} // No-op for snapshot
                 indicators={indicators}
                 showVolume={false}
                 lastPrice={lastPrice}
                 support={analysis?.support}
                 resistance={analysis?.resistance}
                 isLoading={false}
               />
             ) : (
               <div className="text-center p-6 h-full flex flex-col items-center justify-center">
                 <LineChart className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                 <p className="text-muted-foreground text-sm">
                   Chart data not available for this snapshot.
                 </p>
               </div>
             )}
          </CardContent>
        </Card>

        {/* AI Analysis */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-purple-500" />
            AI Logic & Strategy
          </h2>
          <AIAnalysisCard
            analysis={analysis}
            isLoading={false}
            predictiveMode={false} // Snapshot doesn't support predictive path unless stored
            predictivePath={[]}
            currentPrice={null}
            showShareButton={false}
          />
        </div>

        {/* Footer */}
        <div className="text-center pt-8 text-sm text-muted-foreground">
          <p>Generated by AiRA - The Intelligent Trading Assistant</p>
          <Link href="https://aira.trade" className="text-blue-500 hover:underline">
            www.aira.trade
          </Link>
        </div>
      </div>
    </div>
  );
}
