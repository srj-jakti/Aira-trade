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
  Play, 
  Square, 
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
  Info
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ScannerSettingsForm } from "../settings/ScannerSettingsForm";

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
      case 'active': return <Badge className="bg-blue-500">Live</Badge>;
      case 'pending': return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'target_hit': return <Badge className="bg-green-500">Target Hit</Badge>;
      case 'sl_hit': return <Badge className="bg-red-500">SL Hit</Badge>;
      case 'expired': return <Badge variant="outline">Expired</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Market Scanner</h1>
          <p className="text-muted-foreground">Real-time pattern identification powered by user-configured AI strategies.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
          <div className="flex items-center gap-2">
            <Switch 
              checked={isActive} 
              onCheckedChange={toggleScanner}
              disabled={processing}
            />
            <span className="font-medium">{isActive ? "Live Scanning" : "Scanner Off"}</span>
          </div>
          <div className="h-8 w-px bg-border mx-2" />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={runScannerNow}
            disabled={processing || !isActive}
            className="gap-2"
          >
            <RefreshCcw className={`h-4 w-4 ${processing ? 'animate-spin' : ''}`} />
            Scan Now
          </Button>
        </div>
      </div>

      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-2">
        <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-300/80">
          This scanner provides analytical outputs based on user-configured strategy logic. All outputs are for informational purposes only and do not constitute trading advice. You are responsible for all decisions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Active Outputs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentOutputs.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently monitoring based on your rules</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Historical Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pastOutputs.length > 0 
                ? `${((pastOutputs.filter(s => s.status === 'target_hit').length / pastOutputs.length) * 100).toFixed(1)}%`
                : "0%"
              }
            </div>
            <p className="text-xs text-muted-foreground mt-1">Based on {pastOutputs.length} past outputs (not guaranteed)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Daily Realized
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${pastOutputs.reduce((acc, s) => acc + (s.pnl || 0), 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ₹{pastOutputs.reduce((acc, s) => acc + (s.pnl || 0), 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">From scanner outputs today</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="current" className="gap-2">
            <Activity className="h-4 w-4" />
            Current Scanner
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-2">
            <History className="h-4 w-4" />
            Output History
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Scanner Settings
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="current" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Outputs & Active Positions</CardTitle>
              <CardDescription>
                Live outputs where conditions are met based on your configured rules.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentOutputs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="bg-muted p-4 rounded-full mb-4">
                    <Activity className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg">No active outputs</h3>
                  <p className="text-muted-foreground max-w-sm">
                    {isActive 
                      ? "The AI is currently scanning based on your configured rules. New outputs will appear here as patterns are detected." 
                      : "Start the scanner to begin identifying market patterns."
                    }
                  </p>
                  {!isActive && (
                    <Button onClick={toggleScanner} variant="outline" className="mt-4">
                      Start Scanning
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Strategy</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Entry Price</TableHead>
                      <TableHead>Current Price</TableHead>
                      <TableHead>Target/SL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentOutputs.map((output) => (
                      <TableRow key={output.id}>
                        <TableCell className="font-medium uppercase">{output.tradingsymbol}</TableCell>
                        <TableCell className="text-sm">{output.strategy_name || 'AI Dynamic'}</TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-1 font-bold ${output.direction === 'LONG' ? 'text-green-500' : 'text-red-500'}`}>
                            {output.direction === 'LONG' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {output.direction}
                          </div>
                        </TableCell>
                        <TableCell>₹{output.entry_price.toFixed(2)}</TableCell>
                        <TableCell>₹{(output.current_price || output.entry_price).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">
                          <div className="text-green-600 font-medium">T: ₹{output.target_price.toFixed(2)}</div>
                          <div className="text-red-600 font-medium">S: ₹{output.sl_price.toFixed(2)}</div>
                        </TableCell>
                        <TableCell>{getStatusBadge(output.status)}</TableCell>
                        <TableCell className={`font-bold ${(output.pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {output.pnl ? `₹${output.pnl.toFixed(2)}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="past" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Output History</CardTitle>
              <CardDescription>
                Recent analytical outputs that have completed, stopped out, or expired.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pastOutputs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <History className="h-12 w-12 mb-4 opacity-20" />
                  <p>No output history available yet.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Entry/Exit</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>P&L</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pastOutputs.map((output) => (
                      <TableRow key={output.id}>
                        <TableCell className="font-medium uppercase">{output.tradingsymbol}</TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-1 font-bold ${output.direction === 'LONG' ? 'text-green-500' : 'text-red-500'}`}>
                            {output.direction}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>E: ₹{output.entry_price.toFixed(2)}</div>
                          <div>X: ₹{(output.target_price).toFixed(2)}</div>
                        </TableCell>
                        <TableCell>
                          {output.status === 'target_hit' ? (
                            <div className="flex items-center gap-1 text-green-500 font-medium">
                              <CheckCircle2 className="h-4 w-4" /> Target Reached
                            </div>
                          ) : output.status === 'sl_hit' ? (
                            <div className="flex items-center gap-1 text-red-500 font-medium">
                              <XCircle className="h-4 w-4" /> Stop Loss
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-muted-foreground font-medium">
                              <AlertTriangle className="h-4 w-4" /> Expired
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(output.status)}</TableCell>
                        <TableCell className={`font-bold ${(output.pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          ₹{(output.pnl || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(output.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Scanner Configuration</CardTitle>
              <CardDescription>
                Customize how the AI scanner identifies patterns based on your rules. All execution requires your explicit action.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScannerSettingsForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
