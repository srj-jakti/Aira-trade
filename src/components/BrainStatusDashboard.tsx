"use client";

import { useState, useEffect } from "react";
import { 
  Activity, 
  BrainCircuit, 
  ShieldAlert, 
  Zap, 
  Clock, 
  BarChart3, 
  ShieldCheck, 
  AlertOctagon,
  RefreshCw,
  Heart,
  Network,
  History,
  Lock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface BrainHealth {
  brain: {
    state: string;
    uptime: number;
    requestsProcessed: number;
    errorsCount: number;
    lastHeartbeat: string;
    volatility?: {
      level: 'normal' | 'high' | 'extreme';
      vix?: number;
      atr?: number;
    };
  };
  aiKeys: {
    totalKeys: number;
    healthyKeys: number;
    providers: Record<string, { healthy: boolean; latency: number }>;
  };
  learning: {
    totalPatterns: number;
    recentDiscoveries: number;
    avgConfidence: number;
  };
  audit: {
    gatewayLogsLast24h: number;
    totalViolations: number;
    gatedCountTotal: number;
  };
  recentHeartbeats: Array<{
    id: number;
    state: string;
    uptime_seconds: number;
    requests_processed: number;
    volatility_level: string;
    created_at: string;
  }>;
  recentEvents: Array<{
    id: number;
    event_type: string;
    details: any;
    created_at: string;
  }>;
  systemStatus: "healthy" | "degraded" | "critical";
}

export function BrainStatusDashboard() {
  const [data, setData] = useState<BrainHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBrainHealth = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/system-health/brain");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (error) {
      toast.error("Failed to fetch brain health");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBrainHealth();
    const interval = setInterval(fetchBrainHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Activity className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!data) return null;

  const getVolatilityBadge = (level?: string) => {
    switch (level) {
      case 'extreme': return <Badge className="bg-red-500 text-white border-none">EXTREME VOLATILITY</Badge>;
      case 'high': return <Badge className="bg-orange-500 text-white border-none">HIGH VOLATILITY</Badge>;
      default: return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">NORMAL VOLATILITY</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <ShieldCheck className="w-5 h-5 text-green-400" />;
      case 'degraded': return <AlertOctagon className="w-5 h-5 text-yellow-400" />;
      case 'critical': return <ShieldAlert className="w-5 h-5 text-red-400" />;
      default: return <Activity className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <BrainCircuit className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              Aira Brain Command Center
              <Badge variant="outline" className="border-border text-muted-foreground font-normal">v1.2 (Watchtower)</Badge>
            </h2>
            <p className="text-sm text-muted-foreground">Proactive intelligence & safety gateway monitoring</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchBrainHealth} 
          disabled={refreshing}
          className="bg-card border-border hover:bg-muted"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Sync Engine
        </Button>
      </div>

      {/* Primary Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Heart className="w-12 h-12 text-red-500 fill-current animate-pulse" />
          </div>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
              Engine State
              <span className={`w-2 h-2 rounded-full ${data.brain.state === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            </p>
            <h3 className="text-2xl font-bold text-foreground mb-2">{data.brain.state}</h3>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Uptime: {Math.floor(data.brain.uptime / 3600)}h {Math.floor((data.brain.uptime % 3600) / 60)}m</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-1">Market Context</p>
            <div className="mb-2">{getVolatilityBadge(data.brain.volatility?.level)}</div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="p-2 bg-muted rounded border border-border">
                <p className="text-[10px] text-muted-foreground uppercase">VIX Score</p>
                <p className="text-sm font-bold text-foreground">{data.brain.volatility?.vix || 'N/A'}</p>
              </div>
              <div className="p-2 bg-muted rounded border border-border">
                <p className="text-[10px] text-muted-foreground uppercase">ATR Delta</p>
                <p className="text-sm font-bold text-foreground">{data.brain.volatility?.atr || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-1">Intent Processing</p>
            <h3 className="text-2xl font-bold text-foreground mb-2">{data.brain.requestsProcessed.toLocaleString()}</h3>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-400" /> Successful</span>
              <span>Errors: {data.brain.errorsCount}</span>
            </div>
            <Progress value={data.brain.requestsProcessed > 0 ? (1 - data.brain.errorsCount/data.brain.requestsProcessed) * 100 : 100} className="h-1 mt-2 bg-muted" />
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-1">Safety Gateway</p>
            <h3 className="text-2xl font-bold text-foreground mb-2">{data.audit.gatewayLogsLast24h.toLocaleString()}</h3>
            <div className="flex items-center justify-between text-xs">
              <span className="text-red-400 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> {data.audit.totalViolations} Violations</span>
              <span className="text-muted-foreground">24h History</span>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground font-medium">
              SYSTEM STATUS: <span className={data.systemStatus === 'healthy' ? 'text-green-400' : 'text-yellow-400'}>{data.systemStatus.toUpperCase()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Watchtower Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Heartbeat Heatmap (Watchtower) */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              Live Heartbeat Heatmap
            </CardTitle>
            <CardDescription className="text-xs">Real-time latency and state visualization across clusters</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {data.recentHeartbeats.map((hb, i) => (
                <div 
                  key={hb.id} 
                  className={`w-8 h-8 rounded-sm ${
                    hb.state === 'ACTIVE' ? (
                      hb.volatility_level === 'extreme' ? 'bg-red-500/40 border border-red-500/20' :
                      hb.volatility_level === 'high' ? 'bg-orange-500/40 border border-orange-500/20' :
                      'bg-green-500/40 border border-green-500/20'
                    ) : 'bg-red-900/40 border border-red-900/20'
                  } transition-all hover:scale-110 cursor-pointer flex items-center justify-center`}
                  title={`${new Date(hb.created_at).toLocaleTimeString()}: ${hb.state} | ${hb.volatility_level}`}
                >
                  <span className="text-[8px] text-muted-foreground">{i + 1}</span>
                </div>
              ))}
              {Array.from({ length: 60 - data.recentHeartbeats.length }).map((_, i) => (
                <div key={i} className="w-8 h-8 rounded-sm bg-muted border border-border" />
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500/40" /> Normal</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500/40" /> High Vol</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500/40" /> Extreme Vol</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-900/40" /> Offline</div>
            </div>
          </CardContent>
        </Card>

        {/* AI Provider Health (Watchtower) */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Network className="w-4 h-4 text-blue-400" />
              Intelligence Tiers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(data.aiKeys.providers).map(([provider, status]) => (
              <div key={provider} className="flex items-center justify-between p-2 rounded-lg bg-muted border border-border">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${status.healthy ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-xs font-medium text-foreground capitalize">{provider}</span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {status.latency}ms
                </div>
              </div>
            ))}
            <div className="pt-2">
              <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2">Cluster Health</p>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Core Nodes</span>
                <span className="text-foreground font-medium">{data.aiKeys.healthyKeys}/{data.aiKeys.totalKeys}</span>
              </div>
              <Progress value={(data.aiKeys.healthyKeys / data.aiKeys.totalKeys) * 100} className="h-1 bg-muted" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Violation Alerts (Watchtower) */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              Gateway Violation Alerts
            </CardTitle>
            <CardDescription className="text-xs">Real-time bypass attempts and gated intents</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 pr-4">
              <div className="space-y-3">
                {data.recentEvents.filter(e => e.event_type.includes('GATED') || e.event_type.includes('VIOLATION')).length > 0 ? (
                  data.recentEvents
                    .filter(e => e.event_type.includes('GATED') || e.event_type.includes('VIOLATION'))
                    .map((event) => (
                      <div key={event.id} className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 flex gap-3">
                        <AlertOctagon className="w-4 h-4 text-red-400 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-red-400 uppercase">{event.event_type}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{JSON.stringify(event.details)}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{new Date(event.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                    <ShieldCheck className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-xs">No active violations detected</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Learning Pattern Discovery (Watchtower - Read Only) */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-green-400" />
              Learning Pattern Visualization
            </CardTitle>
            <CardDescription className="text-xs">Identified behavioral structures (Read-Only Explorer)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-muted rounded-lg border border-border text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Known Patterns</p>
                  <p className="text-xl font-bold text-foreground">{data.learning.totalPatterns}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg border border-border text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Recent (24h)</p>
                  <p className="text-xl font-bold text-green-400">+{data.learning.recentDiscoveries}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg border border-border text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Avg Conf.</p>
                  <p className="text-xl font-bold text-blue-400">{(data.learning.avgConfidence * 100).toFixed(0)}%</p>
                </div>
              </div>
              
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-3">
                <Lock className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-blue-400 uppercase">EXPERIENCE RETRIEVAL ACTIVE</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Brain is currently retrieving similar market states from User Private Namespace. No execution mutation allowed.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Audit Log */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            Brain Audit Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.recentEvents.slice(0, 5).map((event) => (
              <div key={event.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-xs">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-border text-muted-foreground font-mono text-[9px]">{event.event_type}</Badge>
                  <span className="text-muted-foreground truncate max-w-md">{typeof event.details === 'string' ? event.details : JSON.stringify(event.details).slice(0, 100)}</span>
                </div>
                <span className="text-muted-foreground/50 tabular-nums">{new Date(event.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
