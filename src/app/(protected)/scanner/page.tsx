"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Radar,
  RefreshCcw, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle,
  History,
  Activity,
  Settings2,
  Info,
  Wifi,
  WifiOff
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ScannerSettingsForm } from "../settings/ScannerSettingsForm";
import { cn } from "@/lib/utils";
import { useMultipleLatestPrices } from "@/hooks/use-realtime-ticks";

interface AnalysisOutput {
  id: string;
  tradingsymbol: string;
  instrument_token: string;
  direction: 'LONG' | 'SHORT';
  entry_price: number;
  target_price: number;
  sl_price: number;
  current_price?: number;
  pnl?: number;
  status: 'pending' | 'active' | 'target_hit' | 'sl_hit' | 'expired';
  created_at: string;
  strategy_name?: string;
}

export default function ScannerPage() {
  const [isActive, setIsActive] = useState(false);
  const [currentOutputs, setCurrentOutputs] = useState<AnalysisOutput[]>([]);
  const [pastOutputs, setPastOutputs] = useState<AnalysisOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const supabase = createClient();

  const instrumentTokens = useMemo(() => 
    currentOutputs.map(o => parseInt(o.instrument_token)).filter(t => !isNaN(t)),
    [currentOutputs]
  );

  const { prices: livePrices, isConnected: isPricesConnected, getPrice } = useMultipleLatestPrices(
    instrumentTokens,
    instrumentTokens.length > 0
  );

  useEffect(() => {
    fetchScannerStatus();
    fetchAnalysisOutputs();

    const channel = supabase
      .channel('scanner_outputs')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'ai_signals' 
      }, () => {
        fetchAnalysisOutputs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchScannerStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch('/api/trading/settings');
      const data = await response.json();
      if (data.success) {
        setIsActive(data.settings.is_scanner_active);
      }
    } catch (error) {
      console.error("Error fetching scanner status:", error);
    }
  };

  const fetchAnalysisOutputs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ai/analysis-output?type=SCANNER');
      const data = await response.json();
      
      if (data.success) {
        setCurrentOutputs(data.outputs.filter((s: AnalysisOutput) => ['pending', 'active'].includes(s.status)));
        setPastOutputs(data.outputs.filter((s: AnalysisOutput) => ['target_hit', 'sl_hit', 'expired'].includes(s.status)));
      }
    } catch (error) {
      console.error("Error fetching analysis outputs:", error);
      toast.error("Failed to load analysis outputs");
    } finally {
      setLoading(false);
    }
  };

  const toggleScanner = async () => {
    try {
      setProcessing(true);
      const response = await fetch('/api/trading/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: 'scanner',
          enabled: !isActive 
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setIsActive(!isActive);
        toast.success(`Background Scanner ${!isActive ? 'activated' : 'deactivated'}`);
      } else {
        toast.error(data.error || "Failed to toggle scanner");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setProcessing(false);
    }
  };

  const runScannerNow = async () => {
    setProcessing(true);
    toast.info("Refreshing scanner outputs from background engine...");
    await fetchAnalysisOutputs();
    setTimeout(() => {
      setProcessing(false);
      toast.success("Scanner data synchronized");
    }, 500);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-blue-500">Live</Badge>;
      case 'pending': return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'target_hit': return <Badge className="bg-green-500">Target Hit</Badge>;
      case 'sl_hit': return <Badge className="bg-red-500">SL Hit</Badge>;
      case 'expired': return <Badge variant="outline">Expired</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading && currentOutputs.length === 0 && pastOutputs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-3 md:space-y-4 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-br from-white/10 to-transparent p-3 md:p-4 rounded-2xl border border-white/10 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <Radar className={`size-5 text-blue-400 ${isActive ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-white tracking-tight leading-none">
              AI Market Scanner
            </h1>
            <p className="text-white/40 text-[10px] md:text-xs mt-1 font-medium italic">Real-time pattern identification and analysis</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-black/40 p-1 pl-3 rounded-full border border-white/5 w-fit">
          <div className="flex items-center gap-2">
            <Switch 
              checked={isActive} 
              onCheckedChange={toggleScanner}
              disabled={processing}
              className="scale-75"
            />
            <span className={cn(
              "text-[9px] font-black px-1.5 py-0.5 rounded-full",
              isActive ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-white/20"
            )}>
              {isActive ? "LIVE" : "OFF"}
            </span>
          </div>
          <div className="h-6 w-px bg-white/5 mx-1" />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={runScannerNow}
            disabled={processing || !isActive}
            className="h-8 rounded-full gap-2 text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white hover:bg-white/5"
          >
            <RefreshCcw className={`size-3 ${processing ? 'animate-spin' : ''}`} />
            Scan
          </Button>
        </div>
      </div>

      <div className="p-2.5 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-2.5">
        <div className="size-5 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/10">
          <Info className="size-3 text-blue-400" />
        </div>
        <p className="text-[10px] text-blue-200/40 font-medium leading-relaxed">
          Analytical outputs based on user-configured rules. Informational purposes only. No trading advice.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: "Active Signals", value: currentOutputs.length, sub: "Live monitoring", icon: Activity, color: "text-blue-400" },
          { label: "Scan Accuracy", value: pastOutputs.length > 0 ? `${((pastOutputs.filter(s => s.status === 'target_hit').length / pastOutputs.length) * 100).toFixed(0)}%` : "0%", sub: `Based on ${pastOutputs.length} hits`, icon: TrendingUp, color: "text-green-400" },
          { label: "Daily Realized", value: `₹${pastOutputs.reduce((acc, s) => acc + (s.pnl || 0), 0).toFixed(0)}`, sub: "Scanner outcomes", icon: Clock, color: "text-orange-400" }
        ].map((stat, i) => (
          <Card key={i} className={cn("bg-white/5 border-white/10 group", i === 2 && "col-span-2 md:col-span-1")}>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{stat.label}</CardTitle>
              <stat.icon className={cn("size-3.5 opacity-50", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className={cn("text-xl md:text-2xl font-black tracking-tighter leading-none", stat.color)}>
                {stat.value}
              </div>
              <p className="text-[10px] text-white/20 font-medium mt-1 uppercase tracking-tight">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-black/40 border border-white/5 p-1 rounded-xl h-10">
          <TabsTrigger value="current" className="rounded-lg text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-white/10 data-[state=active]:text-white">
            Live
          </TabsTrigger>
          <TabsTrigger value="past" className="rounded-lg text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-white/10 data-[state=active]:text-white">
            History
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-white/10 data-[state=active]:text-white">
            Config
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="current" className="mt-3 space-y-3">
          <Card className="bg-white/5 border-white/10 overflow-hidden">
            <CardHeader className="bg-white/[0.02] border-b border-white/5 py-3">
              <CardTitle className="text-sm font-bold text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="size-3.5 text-blue-400" />
                  Live Analysis
                </div>
                <div className="flex items-center gap-1">
                  {isPricesConnected ? (
                    <div className="flex items-center gap-1 text-green-400">
                      <Wifi className="size-3" />
                      <span className="text-[9px] uppercase font-bold">Live Prices</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-white/30">
                      <WifiOff className="size-3" />
                      <span className="text-[9px] uppercase">Offline</span>
                    </div>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {currentOutputs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Activity className="size-8 text-white/10 mb-3" />
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">No active outputs</h3>
                  <p className="text-[10px] text-white/20 mt-1">Scanner is waiting for pattern triggers</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-white/[0.01]">
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Symbol</TableHead>
                      <TableHead className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Dir</TableHead>
                      <TableHead className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Entry/Live</TableHead>
                      <TableHead className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Target/SL</TableHead>
                      <TableHead className="text-[9px] font-bold text-white/20 uppercase tracking-widest text-right">P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentOutputs.map((output) => {
                      const token = parseInt(output.instrument_token);
                      const livePrice = getPrice(token);
                      const currentPrice = livePrice || output.current_price || output.entry_price;
                      const priceDiff = currentPrice - output.entry_price;
                      const pnlPercent = (priceDiff / output.entry_price) * 100;
                      const isLong = output.direction === 'LONG';
                      const unrealizedPnl = isLong ? priceDiff : -priceDiff;
                      
                      return (
                        <TableRow key={output.id} className="border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer">
                          <TableCell className="font-bold text-white text-xs uppercase">{output.tradingsymbol}</TableCell>
                          <TableCell>
                            <Badge className={cn(
                              "text-[8px] font-black px-1.5 py-0 border-none",
                              output.direction === 'LONG' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                            )}>
                              {output.direction}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[11px] font-mono">
                            <div className="text-white/40 text-[9px]">E: ₹{output.entry_price.toFixed(2)}</div>
                            <div className={cn(
                              "font-bold",
                              livePrice ? (unrealizedPnl >= 0 ? "text-green-400" : "text-red-400") : "text-white/60"
                            )}>
                              L: ₹{currentPrice.toFixed(2)}
                              {livePrice && <span className="text-[8px] ml-1">({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-[10px] font-medium">
                            <div className="text-green-500/60">T: ₹{output.target_price.toFixed(2)}</div>
                            <div className="text-red-500/60">S: ₹{output.sl_price.toFixed(2)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className={cn("font-bold text-xs", unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400')}>
                              {livePrice ? `₹${unrealizedPnl.toFixed(1)}` : (output.pnl ? `₹${output.pnl.toFixed(1)}` : '-')}
                            </div>
                            <div className="text-[9px] text-white/20 font-medium">
                              {getStatusBadge(output.status)}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="past" className="mt-3">
          <Card className="bg-white/5 border-white/10 overflow-hidden">
            <CardHeader className="bg-white/[0.02] border-b border-white/5 py-3">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <History className="size-3.5 text-purple-400" />
                Historical Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pastOutputs.length === 0 ? (
                <div className="py-16 text-center">
                  <History className="size-8 text-white/10 mx-auto mb-3" />
                  <p className="text-[10px] text-white/20 uppercase font-bold tracking-widest">No history available</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-white/[0.01]">
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Symbol</TableHead>
                      <TableHead className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Dir</TableHead>
                      <TableHead className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Outcome</TableHead>
                      <TableHead className="text-[9px] font-bold text-white/20 uppercase tracking-widest text-right">P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pastOutputs.map((output) => (
                      <TableRow key={output.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                        <TableCell className="font-bold text-white text-xs uppercase">{output.tradingsymbol}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "text-[9px] font-black",
                            output.direction === 'LONG' ? "text-green-400" : "text-red-400"
                          )}>{output.direction}</span>
                        </TableCell>
                        <TableCell>
                          {output.status === 'target_hit' ? (
                            <div className="flex items-center gap-1 text-green-400 font-bold text-[10px]">
                              <CheckCircle2 className="size-3" /> TARGET
                            </div>
                          ) : output.status === 'sl_hit' ? (
                            <div className="flex items-center gap-1 text-red-400 font-bold text-[10px]">
                              <XCircle className="size-3" /> STOPLOSS
                            </div>
                          ) : (
                            <div className="text-white/20 font-bold text-[10px]">EXPIRED</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={cn("font-bold text-xs font-mono", (output.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400')}>
                            ₹{(output.pnl || 0).toFixed(1)}
                          </div>
                          <div className="text-[8px] text-white/20 font-medium">
                            {new Date(output.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings" className="mt-3">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Settings2 className="size-3.5 text-orange-400" />
                Scanner Config
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              <ScannerSettingsForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
