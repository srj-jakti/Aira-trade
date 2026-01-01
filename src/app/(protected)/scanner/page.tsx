"use client";

import { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
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
  RefreshCcw, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  History,
  Activity,
  Settings2,
  Radar,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ScannerSettingsForm } from "../settings/ScannerSettingsForm";
import { cn } from "@/lib/utils";

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
      const response = await fetch('/api/ai/analysis-output');
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
        toast.success(`Scanner ${!isActive ? 'started' : 'stopped'}`);
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
    try {
      setProcessing(true);
      toast.info("Scanning market for analytical patterns...");
      const response = await fetch('/api/scanner/process', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Scan complete! Found ${data.found} analysis outputs.`);
        fetchAnalysisOutputs();
      } else {
        toast.error(data.error || "Scan failed");
      }
    } catch (error) {
      toast.error("Scan failed");
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] h-5 font-bold">LIVE</Badge>;
      case 'pending': return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 text-[10px] h-5 font-bold">PENDING</Badge>;
      case 'target_hit': return <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px] h-5 font-bold uppercase">Target Hit</Badge>;
      case 'sl_hit': return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] h-5 font-bold uppercase">SL Hit</Badge>;
      case 'expired': return <Badge variant="outline" className="text-[10px] h-5 border-white/10 text-white/40">EXPIRED</Badge>;
      default: return <Badge variant="secondary" className="text-[10px] h-5">{status}</Badge>;
    }
  };

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.03] backdrop-blur-md p-4 md:p-6 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-xl",
            isActive ? "bg-blue-400/10 text-blue-400" : "bg-white/5 text-white/20"
          )}>
            <Radar className={cn("w-5 h-5", isActive && "animate-pulse")} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">Market Scanner</h1>
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider">AI Pattern Identification</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
          <div className="flex items-center gap-4 pr-4 border-r border-white/5">
            <Switch 
              checked={isActive} 
              onCheckedChange={toggleScanner}
              disabled={processing}
              className="data-[state=checked]:bg-blue-500"
            />
            <span className="text-xs font-bold text-white/70 uppercase tracking-tighter">
              {isActive ? "LIVE SCANNING" : "SCANNER OFF"}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={runScannerNow}
            disabled={processing || !isActive}
            className="h-8 gap-2 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5"
          >
            <RefreshCcw className={cn("h-3 w-3", processing && "animate-spin")} />
            Scan Now
          </Button>
        </div>
      </div>

      <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3">
        <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-[10px] md:text-xs text-white/40 leading-relaxed uppercase tracking-tight font-medium">
          This scanner provides analytical outputs based on user-configured strategy logic. All outputs are for informational purposes only.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard 
          title="Active Outputs" 
          value={currentOutputs.length}
          subValue="Monitoring rules"
          icon={Activity}
          iconColor="text-blue-400"
        />
        <StatCard 
          title="Avg Accuracy" 
          value={pastOutputs.length > 0 
            ? `${((pastOutputs.filter(s => s.status === 'target_hit').length / pastOutputs.length) * 100).toFixed(1)}%`
            : "0%"
          }
          subValue={`Based on ${pastOutputs.length} trades`}
          icon={TrendingUp}
          iconColor="text-green-400"
        />
        <StatCard 
          title="Daily Realized" 
          value={`₹${pastOutputs.reduce((acc, s) => acc + (s.pnl || 0), 0).toFixed(2)}`}
          subValue="Realized from scanner"
          icon={Clock}
          iconColor="text-purple-400"
          valueColor={pastOutputs.reduce((acc, s) => acc + (s.pnl || 0), 0) >= 0 ? "text-green-400" : "text-red-400"}
        />
      </div>

      <Tabs defaultValue="current" className="w-full">
        <TabsList className="bg-white/5 border border-white/5 p-1 h-11 w-full md:w-fit">
          <TabsTrigger value="current" className="gap-2 text-xs font-bold uppercase tracking-tighter data-[state=active]:bg-white/10">
            <Activity className="h-3.5 w-3.5" />
            Active Scanner
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-2 text-xs font-bold uppercase tracking-tighter data-[state=active]:bg-white/10">
            <History className="h-3.5 w-3.5" />
            Past History
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2 text-xs font-bold uppercase tracking-tighter data-[state=active]:bg-white/10">
            <Settings2 className="h-3.5 w-3.5" />
            Configuration
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="current" className="mt-4 space-y-4">
          <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
            <CardHeader className="p-4 md:p-5 border-b border-white/5">
              <CardTitle className="text-sm font-bold text-white uppercase tracking-tight">Active Analysis Outputs</CardTitle>
              <CardDescription className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Live detections based on configured strategies</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {currentOutputs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Radar className="h-10 w-10 text-white/10 mb-4 animate-pulse" />
                  <h3 className="font-bold text-white uppercase tracking-tighter">No active outputs</h3>
                  <p className="text-white/20 text-xs mt-1 uppercase tracking-widest">Scanner is listening for patterns...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-white/[0.02] border-white/5">
                      <TableRow className="hover:bg-transparent border-white/5">
                        <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4">Symbol</TableHead>
                        <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4">Direction</TableHead>
                        <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4">Entry/LTP</TableHead>
                        <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4">Target/SL</TableHead>
                        <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4">Status</TableHead>
                        <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4 text-right">P&L</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentOutputs.map((output) => (
                        <TableRow key={output.id} className="border-white/5 hover:bg-white/[0.03] transition-colors">
                          <TableCell className="font-bold text-white text-xs px-4 py-3 uppercase">
                            {output.tradingsymbol}
                            <div className="text-[9px] text-white/30 font-medium normal-case">{output.strategy_name || 'AI Dynamic'}</div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className={cn(
                              "flex items-center gap-1.5 font-black text-[10px] uppercase",
                              output.direction === 'LONG' ? 'text-green-400' : 'text-red-400'
                            )}>
                              {output.direction === 'LONG' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {output.direction}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 font-mono text-xs">
                            <div className="text-white">₹{output.entry_price.toFixed(2)}</div>
                            <div className="text-white/30 text-[9px]">LTP: ₹{(output.current_price || output.entry_price).toFixed(2)}</div>
                          </TableCell>
                          <TableCell className="px-4 py-3 font-mono text-[10px]">
                            <div className="text-green-400">T: ₹{output.target_price.toFixed(2)}</div>
                            <div className="text-red-400">S: ₹{output.sl_price.toFixed(2)}</div>
                          </TableCell>
                          <TableCell className="px-4 py-3">{getStatusBadge(output.status)}</TableCell>
                          <TableCell className={cn(
                            "text-right px-4 py-3 font-black font-mono text-xs",
                            (output.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                          )}>
                            {output.pnl ? `₹${output.pnl.toFixed(2)}` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="past" className="mt-4">
          <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm overflow-hidden">
            <CardHeader className="p-4 md:p-5 border-b border-white/5">
              <CardTitle className="text-sm font-bold text-white uppercase tracking-tight">Scanner History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pastOutputs.length === 0 ? (
                <div className="py-16 text-center text-white/20 text-xs uppercase tracking-widest font-medium">No history available</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-white/[0.02] border-white/5">
                      <TableRow className="hover:bg-transparent border-white/5">
                        <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4">Symbol</TableHead>
                        <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4">Outcome</TableHead>
                        <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4">P&L</TableHead>
                        <TableHead className="text-white/30 font-bold uppercase tracking-tighter text-[10px] h-10 px-4 text-right">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pastOutputs.map((output) => (
                        <TableRow key={output.id} className="border-white/5 hover:bg-white/[0.03] transition-colors">
                          <TableCell className="font-bold text-white text-xs px-4 py-3 uppercase">
                            {output.tradingsymbol}
                            <div className="text-[9px] text-white/30 font-medium">{output.direction}</div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className={cn(
                              "flex items-center gap-1.5 text-[10px] font-bold uppercase",
                              output.status === 'target_hit' ? 'text-green-400' : output.status === 'sl_hit' ? 'text-red-400' : 'text-white/30'
                            )}>
                              {output.status === 'target_hit' ? <CheckCircle2 className="h-3 w-3" /> : output.status === 'sl_hit' ? <XCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                              {output.status.replace('_', ' ')}
                            </div>
                          </TableCell>
                          <TableCell className={cn(
                            "font-bold font-mono text-xs px-4 py-3",
                            (output.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                          )}>
                            ₹{(output.pnl || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right px-4 py-3 text-[10px] text-white/30 font-medium">
                            {new Date(output.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings" className="mt-4">
          <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm">
            <CardHeader className="p-4 md:p-5 border-b border-white/5">
              <CardTitle className="text-sm font-bold text-white uppercase tracking-tight">Scanner Rules</CardTitle>
              <CardDescription className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Define logic for AI pattern recognition</CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <ScannerSettingsForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
