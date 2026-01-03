"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Database, 
  Key, 
  BrainCircuit, 
  Users,
  ArrowLeft,
  Loader2,
  Activity,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  Power,
  TestTube,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Save,
  X,
  ChevronDown,
  Star,
  Zap,
  Server,
  UserCheck,
  UserX,
  Eye,
  EyeOff,
  Download,
  BarChart3,
  Search,
  Calendar,
  Target,
  Lock,
  Globe,
  Play,
  Pause,
  TrendingUp,
  TrendingDown,
  Shield
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ZerodhaConfig {
  id: string;
  name: string;
  api_key: string;
  api_secret: string;
  user_id: string;
  connection_status: string;
  last_login_at: string | null;
  token_expires_at: string | null;
  last_error: string | null;
  auto_login_time: string;
  auto_login_enabled: boolean;
  priority: number;
  is_active: boolean;
  is_authorized: boolean;
  request_count: number;
  created_at: string;
}

interface AIConfig {
  id: string;
  provider: string;
  model: string;
  api_key: string;
  is_active: boolean;
  is_default: boolean;
  priority: number;
  request_count: number;
  last_error: string | null;
  created_at: string;
}

interface AIProviders {
  [key: string]: {
    name: string;
    models: string[];
  };
}

interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_approved: boolean;
  is_blocked: boolean;
  banned_until: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  plan: string | null;
  plan_id: string | null;
  plan_expires: string | null;
  is_admin_grant: boolean;
  is_admin: boolean;
  email_confirmed: boolean;
}

interface SystemHealth {
  zerodha: {
    total: number;
    connected: number;
    disconnected: number;
    errors: number;
    configs: Array<{
      id: string;
      name: string;
      status: string;
      lastLogin: string | null;
      tokenExpiry: string | null;
      lastError: string | null;
    }>;
  };
  ai: {
    total: number;
    active: number;
    inactive: number;
    errors: number;
    configs: Array<{
      id: string;
      provider: string;
      model: string;
      isActive: boolean;
      isDefault: boolean;
      lastError: string | null;
      requestCount: number;
    }>;
  };
  database: {
    status: string;
    totalUsers: number;
    activeUsers24h: number;
    totalTrades: number;
    totalStrategies: number;
  };
  workers?: {
    marketData: {
      status: string;
      lastHeartbeat: string | null;
      websocketStatus: string | null;
      subscribedInstruments: number | null;
      ticksPerSecond: number | null;
      lastTickAt: string | null;
      isOnline: boolean;
    } | null;
    tradingEngine: {
      status: string;
      lastHeartbeat: string | null;
      activeUsers: number | null;
      errorMessage: string | null;
      startedAt: string | null;
      isOnline: boolean;
    } | null;
  };
  errors: {
    zerodhaErrors24h: number;
    aiErrors24h: number;
    authErrors24h: number;
    recentErrors: Array<{
      type: string;
      message: string;
      timestamp: string;
    }>;
  };
}

interface AIRecommendation {
  category: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  action: string;
}

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("zerodha");
  const router = useRouter();

  useEffect(() => {
    async function checkAdmin() {
      const res = await fetch("/api/admin/check");
      if (res.ok) {
        const data = await res.json();
        if (!data.isAdmin) {
          router.push("/settings");
        } else {
          setIsAdmin(true);
        }
      } else {
        router.push("/settings");
      }
    }
    checkAdmin();
  }, [router]);

    if (isAdmin === null) {
      return (
        <div className="flex items-center justify-center h-full bg-[#030303]">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#030303]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/settings")}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
              <p className="text-white/40 text-sm">System configuration and management</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl w-full flex-wrap justify-start gap-1">
              <TabsTrigger 
                value="zerodha" 
                className="flex items-center gap-2 px-3 py-1.5 data-[state=active]:bg-orange-500 data-[state=active]:text-white rounded-lg transition-all text-xs md:text-sm"
              >
                <Key className="w-4 h-4" />
                <span className="hidden sm:inline">APIs</span>
              </TabsTrigger>
              <TabsTrigger 
                value="ai" 
                className="flex items-center gap-2 px-3 py-1.5 data-[state=active]:bg-purple-500 data-[state=active]:text-white rounded-lg transition-all text-xs md:text-sm"
              >
                <BrainCircuit className="w-4 h-4" />
                <span className="hidden sm:inline">AI</span>
              </TabsTrigger>
              <TabsTrigger 
                value="users" 
                className="flex items-center gap-2 px-3 py-1.5 data-[state=active]:bg-green-500 data-[state=active]:text-white rounded-lg transition-all text-xs md:text-sm"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Users</span>
              </TabsTrigger>
              <TabsTrigger 
                value="market-data" 
                className="flex items-center gap-2 px-3 py-1.5 data-[state=active]:bg-cyan-500 data-[state=active]:text-white rounded-lg transition-all text-xs md:text-sm"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Data</span>
              </TabsTrigger>
              <TabsTrigger 
                value="subscriptions" 
                className="flex items-center gap-2 px-3 py-1.5 data-[state=active]:bg-pink-500 data-[state=active]:text-white rounded-lg transition-all text-xs md:text-sm"
              >
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">Subs</span>
              </TabsTrigger>
              <TabsTrigger 
                value="strategies" 
                className="flex items-center gap-2 px-3 py-1.5 data-[state=active]:bg-yellow-500 data-[state=active]:text-white rounded-lg transition-all text-xs md:text-sm"
              >
                <Target className="w-4 h-4" />
                <span className="hidden sm:inline">Strategies</span>
              </TabsTrigger>
              <TabsTrigger 
                value="health" 
                className="flex items-center gap-2 px-3 py-1.5 data-[state=active]:bg-red-500 data-[state=active]:text-white rounded-lg transition-all text-xs md:text-sm"
              >
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">Health</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="zerodha" className="mt-0">
              <ZerodhaManager />
            </TabsContent>

            <TabsContent value="ai" className="mt-0">
              <AIManager />
            </TabsContent>

            <TabsContent value="users" className="mt-0">
              <UserManager />
            </TabsContent>

            <TabsContent value="market-data" className="mt-0">
              <MarketDataManager />
            </TabsContent>

            <TabsContent value="subscriptions" className="mt-0">
              <SubscriptionManager />
            </TabsContent>

            <TabsContent value="strategies" className="mt-0">
              <StrategyManager />
            </TabsContent>

            <TabsContent value="health" className="mt-0">
              <SystemHealthManager />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function ZerodhaManager() {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="pt-6">
        <p className="text-white/60">Zerodha API management coming soon...</p>
      </CardContent>
    </Card>
  );
}

function AIManager() {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="pt-6">
        <p className="text-white/60">AI configuration management coming soon...</p>
      </CardContent>
    </Card>
  );
}

function UserManager() {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="pt-6">
        <p className="text-white/60">User management coming soon...</p>
      </CardContent>
    </Card>
  );
}

function MarketDataManager() {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="pt-6">
        <p className="text-white/60">Market data management coming soon...</p>
      </CardContent>
    </Card>
  );
}

function SystemHealthManager() {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="pt-6">
        <p className="text-white/60">System health monitoring coming soon...</p>
      </CardContent>
    </Card>
  );
}

function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/market-data/subscriptions");
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions || []);
        setPendingRequests(data.pendingRequests || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePriority = async (instrumentToken: number, priority: string) => {
    setActionLoading(instrumentToken);
    try {
      const res = await fetch("/api/admin/market-data/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrumentToken, priority }),
      });
      if (res.ok) {
        toast.success("Priority updated");
        fetchSubscriptions();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (instrumentToken: number) => {
    if (!confirm("Remove this subscription?")) return;
    setActionLoading(instrumentToken);
    try {
      const res = await fetch(`/api/admin/market-data/subscriptions?instrumentToken=${instrumentToken}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Subscription removed");
        fetchSubscriptions();
      }
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pt-6 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-pink-400" />
                  Active Subscriptions
                </CardTitle>
                <CardDescription className="text-white/40">
                  Instruments currently receiving live market data updates.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchSubscriptions} className="border-white/20 text-white hover:bg-white/10 h-8">
                <RefreshCw className="w-3.5 h-3.5 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-white/40" />
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="p-8 border border-dashed border-white/20 rounded-lg text-center">
                <Activity className="w-12 h-12 mx-auto text-white/20 mb-4" />
                <p className="text-white/40 text-sm">No active subscriptions.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                {subscriptions.map((sub) => (
                  <div 
                    key={sub.instrument_token} 
                    className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium truncate">{sub.instruments?.tradingsymbol}</span>
                        <Badge variant="outline" className="text-[10px] py-0 h-4 border-white/10 text-white/40 shrink-0">
                          {sub.instruments?.exchange}
                        </Badge>
                        <Badge className={cn(
                          "text-[10px] py-0 h-4 shrink-0",
                          sub.priority === "CORE" ? "bg-cyan-500/20 text-cyan-400" :
                          sub.priority === "POPULAR" ? "bg-orange-500/20 text-orange-400" :
                          "bg-purple-500/20 text-purple-400"
                        )}>
                          {sub.priority}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-white/30 truncate mt-0.5">
                        {sub.instruments?.name} • Token: {sub.instrument_token}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Select 
                        value={sub.priority} 
                        onValueChange={(v) => handleUpdatePriority(sub.instrument_token, v)}
                        disabled={actionLoading === sub.instrument_token}
                      >
                        <SelectTrigger className="h-7 w-24 bg-white/5 border-white/10 text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-white/10">
                          <SelectItem value="CORE">CORE</SelectItem>
                          <SelectItem value="POPULAR">POPULAR</SelectItem>
                          <SelectItem value="TEMP">TEMP</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(sub.instrument_token)}
                        disabled={actionLoading === sub.instrument_token}
                        className="h-7 w-7 p-0 text-white/20 hover:text-red-400 hover:bg-red-400/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pt-6 pb-4">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              Pending Requests
            </CardTitle>
            <CardDescription className="text-white/40">
              User requests waiting to be processed by the market data worker.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-white/40" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="p-8 border border-dashed border-white/20 rounded-lg text-center">
                <Clock className="w-12 h-12 mx-auto text-white/20 mb-4" />
                <p className="text-white/40 text-sm">No pending requests.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                {pendingRequests.map((req) => (
                  <div 
                    key={req.id} 
                    className="p-3 bg-white/5 border border-white/10 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{req.instruments?.tradingsymbol}</span>
                        <Badge variant="outline" className="text-[10px] py-0 h-4 border-white/10 text-white/40">
                          {req.instruments?.exchange}
                        </Badge>
                      </div>
                      <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px] py-0 h-4">
                        {req.tier}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-white/30">
                      <span>Requested: {new Date(req.created_at).toLocaleTimeString()}</span>
                      <span>Token: {req.instrument_token}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface AdminStrategy {
  id: number;
  name: string;
  description: string;
  visibility: "public" | "invite_only" | "private";
  admin_approved: boolean;
  created_at: string;
  raw_input?: string;
  buy_entry_logic?: unknown;
  buy_stop_loss?: unknown;
  buy_target?: unknown;
  sell_entry_logic?: unknown;
  sell_stop_loss?: unknown;
  sell_target?: unknown;
  hold_logic?: unknown;
  creator?: {
    username?: string;
    email?: string;
  };
  stats?: {
    win_rate?: number;
    net_pnl_percentage?: number;
  };
}

interface BacktestResult {
  timeframe: string;
  total_trades: number;
  win_rate: number;
  net_pnl_percentage: number;
  max_drawdown_percentage: number;
}

function StrategyManager() {
  const [strategies, setStrategies] = useState<AdminStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStrategy, setSelectedStrategy] = useState<AdminStrategy | null>(null);
  const [backtests, setBacktests] = useState<BacktestResult[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "invite_only">("all");
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [runningBacktest, setRunningBacktest] = useState(false);
  const [backtestTimeframe, setBacktestTimeframe] = useState("15minute");

  useEffect(() => {
    fetchStrategies();
  }, [filter, visibilityFilter]);

  const fetchStrategies = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/strategies");
      if (res.ok) {
        const data = await res.json();
        let filtered = data.strategies || [];
        
        if (filter === "pending") {
          filtered = filtered.filter((s: AdminStrategy) => !s.admin_approved);
        } else if (filter === "approved") {
          filtered = filtered.filter((s: AdminStrategy) => s.admin_approved);
        }
        
        if (visibilityFilter !== "all") {
          filtered = filtered.filter((s: AdminStrategy) => s.visibility === visibilityFilter);
        }
        
        setStrategies(filtered);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/admin/strategies/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (res.ok) {
        fetchStrategies();
        if (selectedStrategy?.id === id) {
          setSelectedStrategy({ ...selectedStrategy, admin_approved: true });
        }
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm("Are you sure you want to reject this strategy? It will be set back to private.")) return;
    setProcessingId(id);
    try {
      const res = await fetch(`/api/admin/strategies/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (res.ok) {
        fetchStrategies();
        setSelectedStrategy(null);
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleHold = async (id: number) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/admin/strategies/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hold" }),
      });
      if (res.ok) {
        fetchStrategies();
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to permanently delete this strategy? This cannot be undone.")) return;
    setProcessingId(id);
    try {
      const res = await fetch(`/api/admin/strategies/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchStrategies();
        if (selectedStrategy?.id === id) {
          setSelectedStrategy(null);
        }
      }
    } finally {
      setProcessingId(null);
    }
  };

  const viewStrategy = async (strategy: AdminStrategy) => {
    setSelectedStrategy(strategy);
    try {
      const res = await fetch(`/api/admin/strategies/${strategy.id}/details`);
      if (res.ok) {
        const data = await res.json();
        setSelectedStrategy(data.strategy);
        setBacktests(data.backtests || []);
      }
    } catch (error) {
      console.error("Error fetching strategy details:", error);
    }
  };

  const runBacktest = async () => {
    if (!selectedStrategy) return;
    setRunningBacktest(true);
    try {
      const res = await fetch(`/api/admin/strategies/${selectedStrategy.id}/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeframe: backtestTimeframe }),
      });
      if (res.ok) {
        const data = await res.json();
        setBacktests(prev => [data.result, ...prev]);
        alert("Backtest completed successfully!");
      } else {
        const error = await res.json();
        alert(error.error || "Backtest failed");
      }
    } finally {
      setRunningBacktest(false);
    }
  };

  const TIMEFRAMES = [
    { value: "3minute", label: "3 Min" },
    { value: "5minute", label: "5 Min" },
    { value: "15minute", label: "15 Min" },
    { value: "60minute", label: "1 Hour" },
    { value: "day", label: "Daily" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/40 text-sm">Pending Approval</p>
                <p className="text-2xl font-bold text-white">
                  {strategies.filter(s => !s.admin_approved).length}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/20">
                <Clock className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/40 text-sm">Public Strategies</p>
                <p className="text-2xl font-bold text-white">
                  {strategies.filter(s => s.visibility === "public" && s.admin_approved).length}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/20">
                <Globe className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/40 text-sm">Invite-Only Strategies</p>
                <p className="text-2xl font-bold text-white">
                  {strategies.filter(s => s.visibility === "invite_only" && s.admin_approved).length}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/20">
                <Lock className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-yellow-400" />
              Strategy Approval & Management
            </CardTitle>
            <CardDescription className="text-white/40">
              Review, approve, and manage public and invite-only strategies.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v: "pending" | "approved" | "all") => setFilter(v)}>
              <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select value={visibilityFilter} onValueChange={(v: "all" | "public" | "invite_only") => setVisibilityFilter(v)}>
              <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="invite_only">Invite Only</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchStrategies}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-white/40" />
            </div>
          ) : strategies.length === 0 ? (
            <div className="p-8 border border-dashed border-white/20 rounded-lg text-center">
              <Target className="w-12 h-12 mx-auto text-white/20 mb-4" />
              <p className="text-white/40 text-sm">No strategies found matching filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {strategies.map((strategy) => (
                <div 
                  key={strategy.id}
                  className={`p-4 rounded-lg border ${
                    selectedStrategy?.id === strategy.id 
                      ? "bg-yellow-500/10 border-yellow-500/30" 
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium">{strategy.name}</span>
                        <Badge className={
                          strategy.visibility === "public" 
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-purple-500/20 text-purple-400 border-purple-500/30"
                        }>
                          {strategy.visibility === "invite_only" ? "Invite Only" : "Public"}
                        </Badge>
                        {strategy.admin_approved ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </div>
                      <p className="text-white/40 text-sm">{strategy.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
                        <span>By: {strategy.creator?.username || strategy.creator?.email || "Unknown"}</span>
                        <span>Created: {new Date(strategy.created_at).toLocaleDateString()}</span>
                        {strategy.stats && (
                          <>
                            <span className="text-green-400">{strategy.stats.win_rate?.toFixed(0)}% Win</span>
                            <span className={strategy.stats.net_pnl_percentage && strategy.stats.net_pnl_percentage >= 0 ? "text-green-400" : "text-red-400"}>
                              {strategy.stats.net_pnl_percentage && strategy.stats.net_pnl_percentage >= 0 ? "+" : ""}
                              {strategy.stats.net_pnl_percentage?.toFixed(1)}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewStrategy(strategy)}
                        className="border-white/20 text-white hover:bg-white/10"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {!strategy.admin_approved && (
                        <Button
                          size="sm"
                          onClick={() => handleApprove(strategy.id)}
                          disabled={processingId === strategy.id}
                          className="bg-green-500 hover:bg-green-600"
                        >
                          {processingId === strategy.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      {strategy.visibility === "public" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleHold(strategy.id)}
                          disabled={processingId === strategy.id}
                          className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                        >
                          <Pause className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReject(strategy.id)}
                        disabled={processingId === strategy.id}
                        className="text-orange-400 hover:text-orange-300 hover:bg-orange-400/10"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(strategy.id)}
                        disabled={processingId === strategy.id}
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStrategy && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white text-lg">Strategy Details: {selectedStrategy.name}</CardTitle>
              <CardDescription className="text-white/40">
                Full strategy logic and backtest results (Admin View Only)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedStrategy(null)}
              className="border-white/10 text-white hover:bg-white/5"
            >
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-medium">BUY Side Logic</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-white/40 text-xs uppercase mb-1">Entry Conditions</p>
                      <ul className="text-white/80">
                        {(selectedStrategy.buy_entry_logic as any)?.conditions?.map((c: string, i: number) => (
                          <li key={i}>• {c}</li>
                        )) || <li className="text-white/40">Not defined</li>}
                      </ul>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs uppercase mb-1">Stop Loss</p>
                      <p className="text-white/80">{(selectedStrategy.buy_stop_loss as any)?.description || "Not defined"}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs uppercase mb-1">Target</p>
                      <p className="text-white/80">{(selectedStrategy.buy_target as any)?.description || "Not defined"}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="w-5 h-5 text-red-400" />
                    <span className="text-red-400 font-medium">SELL Side Logic</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-white/40 text-xs uppercase mb-1">Entry Conditions</p>
                      <ul className="text-white/80">
                        {(selectedStrategy.sell_entry_logic as any)?.conditions?.map((c: string, i: number) => (
                          <li key={i}>• {c}</li>
                        )) || <li className="text-white/40">Not defined</li>}
                      </ul>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs uppercase mb-1">Stop Loss</p>
                      <p className="text-white/80">{(selectedStrategy.sell_stop_loss as any)?.description || "Not defined"}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs uppercase mb-1">Target</p>
                      <p className="text-white/80">{(selectedStrategy.sell_target as any)?.description || "Not defined"}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-yellow-400" />
                    <span className="text-yellow-400 font-medium">Hold / No-Trade Logic</span>
                  </div>
                  <ul className="text-white/80 text-sm">
                    {(selectedStrategy.hold_logic as any)?.conditions?.map((c: string, i: number) => (
                      <li key={i}>• {c}</li>
                    )) || <li className="text-white/40">Not defined</li>}
                  </ul>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white font-medium">Run Admin Backtest</span>
                  </div>
                  <div className="flex gap-2">
                    <Select value={backtestTimeframe} onValueChange={setBacktestTimeframe}>
                      <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1a] border-white/10">
                        {TIMEFRAMES.map((tf) => (
                          <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={runBacktest}
                      disabled={runningBacktest}
                      className="bg-cyan-500 hover:bg-cyan-600"
                    >
                      {runningBacktest ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                  <span className="text-white font-medium mb-4 block">Backtest History</span>
                  {backtests.length === 0 ? (
                    <p className="text-white/40 text-sm">No backtests available</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {backtests.map((bt, i) => (
                        <div key={i} className="p-3 bg-white/5 rounded-lg text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
                              {TIMEFRAMES.find(t => t.value === bt.timeframe)?.label || bt.timeframe}
                            </Badge>
                            <span className={`font-medium ${bt.net_pnl_percentage >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {bt.net_pnl_percentage >= 0 ? "+" : ""}{bt.net_pnl_percentage.toFixed(2)}%
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs text-white/60">
                            <span>Trades: {bt.total_trades}</span>
                            <span>Win: {bt.win_rate.toFixed(0)}%</span>
                            <span>DD: {bt.max_drawdown_percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedStrategy.raw_input && (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                    <span className="text-white font-medium mb-2 block">Original User Input</span>
                    <p className="text-white/60 text-sm italic">&quot;{selectedStrategy.raw_input}&quot;</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-white/10">
              {!selectedStrategy.admin_approved && (
                <Button
                  onClick={() => handleApprove(selectedStrategy.id)}
                  disabled={processingId === selectedStrategy.id}
                  className="flex-1 bg-green-500 hover:bg-green-600"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve Strategy
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => handleReject(selectedStrategy.id)}
                disabled={processingId === selectedStrategy.id}
                className="flex-1 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject & Set Private
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleDelete(selectedStrategy.id)}
                disabled={processingId === selectedStrategy.id}
                className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
