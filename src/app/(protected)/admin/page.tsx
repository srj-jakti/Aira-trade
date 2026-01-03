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
    <div className="flex flex-col h-full bg-[#030303]">
      <div className="flex-1 p-4 md:p-8 pt-6 space-y-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push("/settings")}
            className="text-white/60 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Admin Panel</h1>
            <p className="text-white/50 text-sm">Manage global configurations and system health.</p>
          </div>
        </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="px-0">
                <TabsList className="flex h-auto sm:h-11 items-center justify-between gap-0.5 rounded-xl border border-white/10 bg-white/5 p-1 w-full sm:w-max overflow-x-auto scrollbar-hide">
                  <TabsTrigger 
                    value="zerodha" 
                    className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-orange-500 data-[state=active]:text-white rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                  >
                    <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="truncate w-full text-center sm:text-left">APIs</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="ai-config" 
                    className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-blue-500 data-[state=active]:text-white rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                  >
                    <BrainCircuit className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="truncate w-full text-center sm:text-left">AI</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="system-health" 
                    className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-green-500 data-[state=active]:text-white rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                  >
                    <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="truncate w-full text-center sm:text-left">Health</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="users" 
                    className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-purple-500 data-[state=active]:text-white rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                  >
                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="truncate w-full text-center sm:text-left">Users</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="market-data" 
                    className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-cyan-500 data-[state=active]:text-white rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                  >
                    <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="truncate w-full text-center sm:text-left">Data</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="strategies" 
                    className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 data-[state=active]:bg-yellow-500 data-[state=active]:text-white rounded-lg transition-all text-[9px] sm:text-xs md:text-sm flex-1 min-w-0"
                  >
                    <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="truncate w-full text-center sm:text-left">Strats</span>
                  </TabsTrigger>
                </TabsList>
              </div>

          <TabsContent value="zerodha" className="mt-0">
            <ZerodhaConfigManager />
          </TabsContent>

          <TabsContent value="ai-config" className="mt-0">
            <AIConfigManager />
          </TabsContent>

          <TabsContent value="system-health" className="mt-0">
            <SystemHealthDashboard />
          </TabsContent>

          <TabsContent value="users" className="mt-0">
            <UserManagement />
          </TabsContent>

          <TabsContent value="market-data" className="mt-0">
            <MarketDataManager />
          </TabsContent>

          <TabsContent value="strategies" className="mt-0">
            <StrategyApprovalManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ZerodhaConfigManager() {
  const [configs, setConfigs] = useState<ZerodhaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ZerodhaConfig | null>(null);
  const [loginInProgress, setLoginInProgress] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchConfigs();
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "ZERODHA_ADMIN_AUTH_SUCCESS") {
        fetchConfigs();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/zerodha-configs");
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.configs || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualLogin = (config: ZerodhaConfig) => {
    const loginUrl = `https://kite.trade/connect/login?v=3&api_key=${config.api_key}&redirect_params=admin_config_id=${config.id}`;
    const popup = window.open(
      loginUrl,
      "zerodha_admin_login",
      "width=500,height=700,scrollbars=yes,resizable=yes"
    );
    
    if (!popup) {
      alert("Popup blocked. Please allow popups for this site.");
      return;
    }

    setLoginInProgress(config.id);
    const checkPopup = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkPopup);
        setLoginInProgress(null);
        fetchConfigs();
      }
    }, 500);
  };

  const handleAutoLogin = async (configId: string) => {
    setLoginInProgress(configId);
    try {
      await fetch(`/api/admin/zerodha-configs/${configId}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggeredBy: "manual" }),
      });
      await fetchConfigs();
    } finally {
      setLoginInProgress(null);
    }
  };

  const handleDelete = async (configId: string) => {
    if (!confirm("Are you sure you want to delete this Zerodha configuration?")) return;
    await fetch(`/api/admin/zerodha-configs/${configId}`, { method: "DELETE" });
    fetchConfigs();
  };

  const handleToggleActive = async (configId: string, isActive: boolean) => {
    await fetch(`/api/admin/zerodha-configs/${configId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    fetchConfigs();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "connecting": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "error": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Key className="w-5 h-5 text-orange-400" />
              Zerodha API Configurations
            </CardTitle>
            <CardDescription className="text-white/40">
              Configure multiple Zerodha APIs for market data access. These are global keys used by all users.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchConfigs} className="border-white/20 text-white hover:bg-white/10">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowAddDialog(true)} className="bg-orange-500 hover:bg-orange-600">
              <Plus className="w-4 h-4 mr-2" />
              Add Config
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-white/40" />
            </div>
          ) : configs.length === 0 ? (
            <div className="p-8 border border-dashed border-white/20 rounded-lg text-center">
              <Key className="w-12 h-12 mx-auto text-white/20 mb-4" />
              <p className="text-white/40 text-sm mb-4">No Zerodha APIs configured yet.</p>
              <Button size="sm" onClick={() => setShowAddDialog(true)} className="bg-orange-500 hover:bg-orange-600">
                <Plus className="w-4 h-4 mr-2" />
                Add First Configuration
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {configs.map((config) => (
                <div 
                  key={config.id} 
                  className={`p-4 rounded-lg border ${config.is_active ? "bg-white/5 border-white/10" : "bg-white/2 border-white/5 opacity-60"}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium text-lg">{config.name}</span>
                        <Badge className={getStatusColor(config.connection_status)}>
                          {config.connection_status}
                        </Badge>
                        {!config.is_authorized && (
                          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                            <Globe className="w-3 h-3 mr-1" />
                            Login Required
                          </Badge>
                        )}
                        {config.priority === 1 && (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            <Star className="w-3 h-3 mr-1" />
                            Primary
                          </Badge>
                        )}
                      </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-white/40">API Key:</span>
                            <span className="text-white/70 ml-2 break-all">{config.api_key}</span>
                          </div>
                          <div>
                            <span className="text-white/40">User ID:</span>
                            <span className="text-white/70 ml-2 break-all">{config.user_id}</span>
                          </div>
                        <div>
                          <span className="text-white/40">Auto-Login:</span>
                          <span className="text-white/70 ml-2">
                            {config.auto_login_enabled ? config.auto_login_time : "Disabled"}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/40">Last Login:</span>
                          <span className="text-white/70 ml-2">
                            {config.last_login_at 
                              ? new Date(config.last_login_at).toLocaleString() 
                              : "Never"}
                          </span>
                        </div>
                      </div>
                      {config.last_error && (
                          <div className="flex items-start gap-2 mt-2 p-2 bg-red-500/10 rounded-lg">
                            <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <span className="text-red-400 text-sm">
                                {config.last_error.includes("first-time manual authorization") 
                                  ? "API key requires first-time authorization in browser"
                                  : config.last_error}
                              </span>
                              {config.last_error.includes("first-time manual authorization") && (
                                <div className="mt-2">
                                  <a 
                                    href={`https://kite.trade/connect/login?v=3&api_key=${config.api_key}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 text-sm underline"
                                  >
                                    Click here to authorize in browser →
                                  </a>
                                  <p className="text-white/40 text-xs mt-1">
                                    Log into Zerodha first, then click "Authorize" on the page
                                   </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Switch
                        checked={config.is_active}
                        onCheckedChange={(checked) => handleToggleActive(config.id, checked)}
                      />
                      {!config.is_authorized ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManualLogin(config)}
                          disabled={loginInProgress === config.id || !config.is_active}
                          className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                          title="First-time login required"
                        >
                          {loginInProgress === config.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Globe className="w-4 h-4 mr-1" />
                              Login
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAutoLogin(config.id)}
                          disabled={loginInProgress === config.id || !config.is_active}
                          className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                          title="Auto login"
                        >
                          {loginInProgress === config.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Power className="w-4 h-4 mr-1" />
                              Auto
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingConfig(config)}
                        className="border-white/20 text-white hover:bg-white/10"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(config.id)}
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

      <ZerodhaConfigDialog
        open={showAddDialog || !!editingConfig}
        onClose={() => {
          setShowAddDialog(false);
          setEditingConfig(null);
        }}
        onSuccess={fetchConfigs}
        editConfig={editingConfig}
      />
    </div>
  );
}

function ZerodhaConfigDialog({
  open,
  onClose,
  onSuccess,
  editConfig,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editConfig: ZerodhaConfig | null;
}) {
  const [form, setForm] = useState({
    name: "",
    apiKey: "",
    apiSecret: "",
    userId: "",
    password: "",
    totpSecret: "",
    autoLoginTime: "08:30",
    autoLoginEnabled: true,
    priority: 1,
  });
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    if (editConfig) {
      setForm({
        name: editConfig.name,
        apiKey: "",
        apiSecret: "",
        userId: "",
        password: "",
        totpSecret: "",
        autoLoginTime: editConfig.auto_login_time?.slice(0, 5) || "08:30",
        autoLoginEnabled: editConfig.auto_login_enabled,
        priority: editConfig.priority,
      });
    } else {
      setForm({
        name: "",
        apiKey: "",
        apiSecret: "",
        userId: "",
        password: "",
        totpSecret: "",
        autoLoginTime: "08:30",
        autoLoginEnabled: true,
        priority: 1,
      });
    }
  }, [editConfig, open]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = editConfig 
        ? `/api/admin/zerodha-configs/${editConfig.id}` 
        : "/api/admin/zerodha-configs";
      const method = editConfig ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const redirectUrl = `${baseUrl}/api/admin/zerodha-configs/callback`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editConfig ? "Edit" : "Add"} Zerodha Configuration</DialogTitle>
            <DialogDescription className="text-white/50">
              {editConfig 
                ? "Update the configuration. Leave credential fields empty to keep existing values."
                : "Add a new Zerodha API configuration for market data access."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-4">
            <div className="flex items-start gap-3">
              <Globe className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-blue-400 font-medium text-sm mb-1">Kite Connect Redirect URL</p>
                <p className="text-white/60 text-xs mb-2">
                  Use this URL as the Redirect URL when creating your Kite Connect app at{" "}
                  <a href="https://developers.kite.trade" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                    developers.kite.trade
                  </a>
                </p>
                <div className="flex items-center gap-2 p-2 bg-black/30 rounded border border-white/10">
                  <code className="text-green-400 text-xs flex-1 break-all">{redirectUrl}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(redirectUrl)}
                    className="text-white/60 hover:text-white h-7 px-2"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
            <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white/60">Configuration Name</Label>
                <Input 
                  placeholder="e.g., Primary Account"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/60">Priority</Label>
                <Select 
                  value={form.priority.toString()} 
                  onValueChange={(v) => setForm({ ...form, priority: parseInt(v) })}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    <SelectItem value="1">1 - Primary</SelectItem>
                    <SelectItem value="2">2 - Secondary</SelectItem>
                    <SelectItem value="3">3 - Tertiary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white/60">API Key</Label>
                <Input 
                  type={showSecrets ? "text" : "password"}
                  placeholder={editConfig ? "Leave empty to keep" : "Enter API Key"}
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/60">API Secret</Label>
                <Input 
                  type={showSecrets ? "text" : "password"}
                  placeholder={editConfig ? "Leave empty to keep" : "Enter API Secret"}
                  value={form.apiSecret}
                  onChange={(e) => setForm({ ...form, apiSecret: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white/60">User ID</Label>
                <Input 
                  type={showSecrets ? "text" : "password"}
                  placeholder={editConfig ? "Leave empty to keep" : "Enter User ID"}
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/60">Password</Label>
                <Input 
                  type={showSecrets ? "text" : "password"}
                  placeholder={editConfig ? "Leave empty to keep" : "Enter Password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
          <div className="space-y-2">
            <Label className="text-white/60">TOTP Secret (for auto-login)</Label>
            <Input 
              type={showSecrets ? "text" : "password"}
              placeholder={editConfig ? "Leave empty to keep" : "Enter TOTP Secret"}
              value={form.totpSecret}
              onChange={(e) => setForm({ ...form, totpSecret: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
            />
            <p className="text-xs text-white/40">Get this from Zerodha: Console → Settings → Setup TOTP → Can't scan?</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSecrets(!showSecrets)}
              className="text-white/60 hover:text-white"
            >
              {showSecrets ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              {showSecrets ? "Hide" : "Show"} Secrets
            </Button>
          </div>
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
            <div>
              <Label className="text-white">Auto Login</Label>
              <p className="text-xs text-white/40">Automatically refresh token daily at specified time</p>
            </div>
            <div className="flex items-center gap-3">
              <Input 
                type="time"
                value={form.autoLoginTime}
                onChange={(e) => setForm({ ...form, autoLoginTime: e.target.value })}
                className="bg-white/5 border-white/10 text-white w-32"
                disabled={!form.autoLoginEnabled}
              />
              <Switch
                checked={form.autoLoginEnabled}
                onCheckedChange={(checked) => setForm({ ...form, autoLoginEnabled: checked })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-white/20 text-white hover:bg-white/10">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={saving || (!editConfig && (!form.name || !form.apiKey || !form.apiSecret || !form.userId || !form.password || !form.totpSecret))}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {editConfig ? "Update" : "Save"} Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AIConfigManager() {
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [providers, setProviders] = useState<AIProviders>({});
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AIConfig | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{ [key: string]: "success" | "error" | null }>({});

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai-configs");
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.configs || []);
        setProviders(data.providers || {});
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (configId: string) => {
    setTestingId(configId);
    setTestResults((prev) => ({ ...prev, [configId]: null }));
    try {
      const res = await fetch(`/api/admin/ai-configs/${configId}/test`, { method: "POST" });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [configId]: data.success ? "success" : "error" }));
    } catch {
      setTestResults((prev) => ({ ...prev, [configId]: "error" }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (configId: string) => {
    if (!confirm("Are you sure you want to delete this AI configuration?")) return;
    await fetch(`/api/admin/ai-configs/${configId}`, { method: "DELETE" });
    fetchConfigs();
  };

  const handleToggleActive = async (configId: string, isActive: boolean) => {
    await fetch(`/api/admin/ai-configs/${configId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    fetchConfigs();
  };

  const handleSetDefault = async (configId: string) => {
    await fetch(`/api/admin/ai-configs/${configId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    fetchConfigs();
  };

  const getProviderIcon = (provider: string) => {
    const colors: { [key: string]: string } = {
      openai: "text-green-400",
      anthropic: "text-orange-400",
      google: "text-blue-400",
      groq: "text-purple-400",
    };
    return <BrainCircuit className={`w-5 h-5 ${colors[provider] || "text-white/60"}`} />;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-blue-400" />
              AI Service Configurations
            </CardTitle>
            <CardDescription className="text-white/40">
              Configure multiple AI providers and models. These are global keys used by all users.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchConfigs} className="border-white/20 text-white hover:bg-white/10">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowAddDialog(true)} className="bg-blue-500 hover:bg-blue-600">
              <Plus className="w-4 h-4 mr-2" />
              Add AI Provider
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-white/40" />
            </div>
          ) : configs.length === 0 ? (
            <div className="p-8 border border-dashed border-white/20 rounded-lg text-center">
              <BrainCircuit className="w-12 h-12 mx-auto text-white/20 mb-4" />
              <p className="text-white/40 text-sm mb-4">No AI providers configured yet.</p>
              <Button size="sm" onClick={() => setShowAddDialog(true)} className="bg-blue-500 hover:bg-blue-600">
                <Plus className="w-4 h-4 mr-2" />
                Add First AI Provider
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {configs.map((config) => (
                <div 
                  key={config.id} 
                  className={`p-4 rounded-lg border ${config.is_active ? "bg-white/5 border-white/10" : "bg-white/2 border-white/5 opacity-60"}`}
                >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1 w-full">
                          <div className="flex flex-wrap items-center gap-3">
                            {getProviderIcon(config.provider)}
                            <span className="text-white font-medium text-lg shrink-0">
                              {providers[config.provider]?.name || config.provider}
                            </span>
                            <Badge className="bg-white/10 text-white/70 border-white/20 shrink-0">
                              {config.model}
                            </Badge>
                            {config.is_default && (
                              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 shrink-0">
                                <Star className="w-3 h-3 mr-1" />
                                Default
                              </Badge>
                            )}
                            <div className="flex items-center gap-2">
                              {testResults[config.id] === "success" && (
                                <span className="flex items-center gap-1 text-green-400 text-sm whitespace-nowrap">
                                  <CheckCircle2 className="w-4 h-4" /> Working
                                </span>
                              )}
                              {testResults[config.id] === "error" && (
                                <span className="flex items-center gap-1 text-red-400 text-sm whitespace-nowrap">
                                  <XCircle className="w-4 h-4" /> Failed
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-white/40">API Key:</span>
                              <span className="text-white/70 ml-2 break-all">{config.api_key}</span>
                            </div>
                            <div>
                              <span className="text-white/40">Priority:</span>
                              <span className="text-white/70 ml-2">{config.priority}</span>
                            </div>
                            <div>
                              <span className="text-white/40">Requests:</span>
                              <span className="text-white/70 ml-2">{config.request_count}</span>
                            </div>
                            <div>
                              <span className="text-white/40">Status:</span>
                              <span className={`ml-2 ${config.is_active ? "text-green-400" : "text-white/40"}`}>
                                {config.is_active ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </div>
                          {config.last_error && (
                            <div className="flex items-start gap-2 mt-2 p-2 bg-red-500/10 rounded-lg">
                              <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                              <span className="text-red-400 text-sm break-words">{config.last_error}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
                          <Switch
                            checked={config.is_active}
                            onCheckedChange={(checked) => handleToggleActive(config.id, checked)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTest(config.id)}
                            disabled={testingId === config.id || !config.is_active}
                            className="border-white/20 text-white hover:bg-white/10"
                          >
                            {testingId === config.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <TestTube className="w-4 h-4" />
                            )}
                          </Button>
                          {!config.is_default && config.is_active && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetDefault(config.id)}
                              className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-400/10"
                            >
                              <Star className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingConfig(config)}
                            className="border-white/20 text-white hover:bg-white/10"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(config.id)}
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

      <AIConfigDialog
        open={showAddDialog || !!editingConfig}
        onClose={() => {
          setShowAddDialog(false);
          setEditingConfig(null);
        }}
        onSuccess={fetchConfigs}
        editConfig={editingConfig}
        providers={providers}
      />
    </div>
  );
}

function AIConfigDialog({
  open,
  onClose,
  onSuccess,
  editConfig,
  providers,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editConfig: AIConfig | null;
  providers: AIProviders;
}) {
  const [form, setForm] = useState({
    provider: "openai",
    model: "",
    apiKey: "",
    isDefault: false,
    priority: 1,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editConfig) {
      setForm({
        provider: editConfig.provider,
        model: editConfig.model,
        apiKey: "",
        isDefault: editConfig.is_default,
        priority: editConfig.priority,
      });
    } else {
      setForm({
        provider: "openai",
        model: providers["openai"]?.models[0] || "",
        apiKey: "",
        isDefault: false,
        priority: 1,
      });
    }
  }, [editConfig, open, providers]);

  const handleProviderChange = (provider: string) => {
    setForm({
      ...form,
      provider,
      model: providers[provider]?.models[0] || "",
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = editConfig 
        ? `/api/admin/ai-configs/${editConfig.id}` 
        : "/api/admin/ai-configs";
      const method = editConfig ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>{editConfig ? "Edit" : "Add"} AI Configuration</DialogTitle>
          <DialogDescription className="text-white/50">
            {editConfig 
              ? "Update the AI configuration. Leave API key empty to keep existing value."
              : "Add a new AI provider for analysis and predictions."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label className="text-white/60">Provider</Label>
            <Select value={form.provider} onValueChange={handleProviderChange}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                {Object.entries(providers).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-white/60">Model</Label>
            <Select value={form.model} onValueChange={(v) => setForm({ ...form, model: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                {(providers[form.provider]?.models || []).map((model) => (
                  <SelectItem key={model} value={model}>{model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-white/60">API Key</Label>
            <Input 
              type="password"
              placeholder={editConfig ? "Leave empty to keep existing" : "Enter API Key"}
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white/60">Priority</Label>
              <Select 
                value={form.priority.toString()} 
                onValueChange={(v) => setForm({ ...form, priority: parseInt(v) })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="1">1 - Primary</SelectItem>
                  <SelectItem value="2">2 - Secondary</SelectItem>
                  <SelectItem value="3">3 - Tertiary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <Label className="text-white">Set as Default</Label>
              <Switch
                checked={form.isDefault}
                onCheckedChange={(checked) => setForm({ ...form, isDefault: checked })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-white/20 text-white hover:bg-white/10">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={saving || (!editConfig && !form.apiKey)}
            className="bg-blue-500 hover:bg-blue-600"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {editConfig ? "Update" : "Save"} Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ScalingAnalysis {
  overall: "healthy" | "warning" | "critical";
  score: number;
  recommendations: Array<{
    category: string;
    severity: "critical" | "warning" | "info";
    title: string;
    description: string;
    action: string;
    threshold?: string;
    current?: string;
  }>;
  metrics: {
    apiKeys: { configured: number; active: number; needed: number; tiers: { CORE: boolean; POPULAR: boolean; TEMP: boolean } };
    subscriptions: { total: number; byTier: { CORE: number; POPULAR: number; TEMP: number }; capacity: number; utilizationPercent: number };
    websockets: { total: number; connected: number; fallbackActive: number };
    performance: { ticksPerSecond: number; avgQueryTime: number; errorRate: number };
    users: { total: number; activeToday: number; tradingEnabled: number };
    database: { ticksCount: number; candlesCount: number; signalsCount: number };
  };
  aiAnalysis?: string;
}

function SystemHealthDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [analysis, setAnalysis] = useState<ScalingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"overview" | "services" | "scaling" | "ai">("overview");

  useEffect(() => {
    fetchHealth();
    fetchAnalysis();
  }, []);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/system-health");
      if (res.ok) {
        const data = await res.json();
        setHealth(data.health);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const res = await fetch("/api/admin/system-health/analysis");
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      }
    } finally {
      setAnalysisLoading(false);
    }
  };

  const runAiAnalysis = async () => {
    if (!health || !analysis) return;
    setAiAnalyzing(true);
    try {
      const res = await fetch("/api/admin/system-health/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          health, 
          analysis,
          requestAiAnalysis: true 
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data.aiAnalysis || "AI analysis complete. No critical issues detected.");
      }
    } catch {
      setAiAnalysis("Failed to generate AI analysis. Please try again.");
    } finally {
      setAiAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500/10 border-red-500/30";
      case "warning": return "bg-yellow-500/10 border-yellow-500/30";
      case "info": return "bg-blue-500/10 border-blue-500/30";
      default: return "bg-gray-500/10 border-gray-500/30";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <XCircle className="w-5 h-5 text-red-400" />;
      case "warning": return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case "info": return <Zap className="w-5 h-5 text-blue-400" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "healthy": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "error": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "disconnected": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {analysis && (
        <Card className={`border-2 ${
          analysis.overall === "critical" ? "bg-red-500/10 border-red-500/30" :
          analysis.overall === "warning" ? "bg-yellow-500/10 border-yellow-500/30" :
          "bg-green-500/10 border-green-500/30"
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-full ${
                  analysis.overall === "critical" ? "bg-red-500/20" :
                  analysis.overall === "warning" ? "bg-yellow-500/20" :
                  "bg-green-500/20"
                }`}>
                  {analysis.overall === "critical" ? <XCircle className="w-8 h-8 text-red-400" /> :
                   analysis.overall === "warning" ? <AlertTriangle className="w-8 h-8 text-yellow-400" /> :
                   <CheckCircle2 className="w-8 h-8 text-green-400" />}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white capitalize">{analysis.overall} System</h3>
                  <p className="text-white/60">Overall Health Score: {analysis.score}/100</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => { fetchHealth(); fetchAnalysis(); }}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${analysisLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <div className="text-right">
                  <div className="text-4xl font-bold text-white">{analysis.score}</div>
                  <div className="text-white/40 text-sm">Score</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 border-b border-white/10 pb-2">
        {[
          { id: "overview", label: "Overview", icon: Activity },
          { id: "services", label: "Services", icon: Server },
          { id: "scaling", label: "Scaling", icon: TrendingUp },
          { id: "ai", label: "AI Analysis", icon: BrainCircuit },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeSection === tab.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveSection(tab.id as typeof activeSection)}
            className={activeSection === tab.id 
              ? "bg-white/10 text-white" 
              : "text-white/60 hover:text-white hover:bg-white/5"}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
          </Button>
        ))}
      </div>

      {activeSection === "overview" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-sm">API Keys</p>
                    <p className="text-2xl font-bold text-white">
                      {analysis?.metrics.apiKeys.active || 0}/{analysis?.metrics.apiKeys.needed || 3}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${(analysis?.metrics.apiKeys.active || 0) >= 3 ? "bg-green-500/20" : "bg-yellow-500/20"}`}>
                    <Key className={`w-6 h-6 ${(analysis?.metrics.apiKeys.active || 0) >= 3 ? "text-green-400" : "text-yellow-400"}`} />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Badge className={analysis?.metrics.apiKeys.tiers.CORE ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>CORE</Badge>
                  <Badge className={analysis?.metrics.apiKeys.tiers.POPULAR ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}>POPULAR</Badge>
                  <Badge className={analysis?.metrics.apiKeys.tiers.TEMP ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}>TEMP</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-sm">Subscriptions</p>
                    <p className="text-2xl font-bold text-white">
                      {analysis?.metrics.subscriptions.total || 0}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${(analysis?.metrics.subscriptions.utilizationPercent || 0) < 60 ? "bg-green-500/20" : (analysis?.metrics.subscriptions.utilizationPercent || 0) < 80 ? "bg-yellow-500/20" : "bg-red-500/20"}`}>
                    <Activity className={`w-6 h-6 ${(analysis?.metrics.subscriptions.utilizationPercent || 0) < 60 ? "text-green-400" : (analysis?.metrics.subscriptions.utilizationPercent || 0) < 80 ? "text-yellow-400" : "text-red-400"}`} />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-white/40 mb-1">
                    <span>Capacity</span>
                    <span>{analysis?.metrics.subscriptions.utilizationPercent || 0}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        (analysis?.metrics.subscriptions.utilizationPercent || 0) < 60 ? "bg-green-500" : 
                        (analysis?.metrics.subscriptions.utilizationPercent || 0) < 80 ? "bg-yellow-500" : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(analysis?.metrics.subscriptions.utilizationPercent || 0, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-sm">Total Users</p>
                    <p className="text-2xl font-bold text-white">{health?.database.totalUsers || analysis?.metrics.users.total || 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-500/20">
                    <Users className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  {health?.database.activeUsers24h || analysis?.metrics.users.activeToday || 0} active today • {analysis?.metrics.users.tradingEnabled || 0} trading
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-sm">Performance</p>
                    <p className="text-2xl font-bold text-white">{analysis?.metrics.performance.ticksPerSecond || 0} t/s</p>
                  </div>
                  <div className="p-3 rounded-lg bg-cyan-500/20">
                    <Zap className="w-6 h-6 text-cyan-400" />
                  </div>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  {((analysis?.metrics.database.ticksCount || 0) / 1000000).toFixed(1)}M ticks • {((analysis?.metrics.database.candlesCount || 0) / 1000).toFixed(0)}K candles
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-sm">Zerodha APIs</p>
                    <p className="text-2xl font-bold text-white">
                      {health?.zerodha.connected || 0}/{health?.zerodha.total || 0}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${(health?.zerodha.connected || 0) > 0 ? "bg-green-500/20" : "bg-red-500/20"}`}>
                    <Key className={`w-6 h-6 ${(health?.zerodha.connected || 0) > 0 ? "text-green-400" : "text-red-400"}`} />
                  </div>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  {health?.zerodha.errors || 0} errors • {health?.zerodha.disconnected || 0} disconnected
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-sm">AI Providers</p>
                    <p className="text-2xl font-bold text-white">
                      {health?.ai.active || 0}/{health?.ai.total || 0}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${(health?.ai.active || 0) > 0 ? "bg-green-500/20" : "bg-red-500/20"}`}>
                    <BrainCircuit className={`w-6 h-6 ${(health?.ai.active || 0) > 0 ? "text-green-400" : "text-red-400"}`} />
                  </div>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  {health?.ai.errors || 0} errors • {health?.ai.inactive || 0} inactive
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-sm">Database</p>
                    <p className="text-2xl font-bold text-white capitalize">{health?.database.status || "Unknown"}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${health?.database.status === "healthy" ? "bg-green-500/20" : "bg-yellow-500/20"}`}>
                    <Database className={`w-6 h-6 ${health?.database.status === "healthy" ? "text-green-400" : "text-yellow-400"}`} />
                  </div>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  {health?.database.totalTrades || 0} trades • {health?.database.totalStrategies || 0} strategies
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-sm">Errors (24h)</p>
                    <p className="text-2xl font-bold text-white">
                      {(health?.errors.zerodhaErrors24h || 0) + (health?.errors.aiErrors24h || 0) + (health?.errors.authErrors24h || 0)}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${((health?.errors.zerodhaErrors24h || 0) + (health?.errors.aiErrors24h || 0)) === 0 ? "bg-green-500/20" : "bg-red-500/20"}`}>
                    <AlertTriangle className={`w-6 h-6 ${((health?.errors.zerodhaErrors24h || 0) + (health?.errors.aiErrors24h || 0)) === 0 ? "text-green-400" : "text-red-400"}`} />
                  </div>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  API: {health?.errors.zerodhaErrors24h || 0} • AI: {health?.errors.aiErrors24h || 0} • Auth: {health?.errors.authErrors24h || 0}
                </p>
              </CardContent>
            </Card>
          </div>

          {health?.errors.recentErrors && health.errors.recentErrors.length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  Recent Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {health.errors.recentErrors.map((error, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-red-500/10 rounded-lg">
                      <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge className="text-xs bg-red-500/20 text-red-400">{error.type}</Badge>
                          <span className="text-white/40 text-xs">
                            {new Date(error.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-white/70 text-sm mt-1">{error.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeSection === "services" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Key className="w-5 h-5 text-orange-400" />
                Zerodha API Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {health?.zerodha.configs && health.zerodha.configs.length > 0 ? (
                <div className="space-y-3">
                  {health.zerodha.configs.map((config) => (
                    <div key={config.id} className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{config.name}</span>
                        <Badge className={getStatusColor(config.status)}>{config.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-white/40">
                        <div>Last Login: {config.lastLogin ? new Date(config.lastLogin).toLocaleString() : "Never"}</div>
                        <div>Token Expiry: {config.tokenExpiry ? new Date(config.tokenExpiry).toLocaleString() : "N/A"}</div>
                      </div>
                      {config.lastError && (
                        <div className="mt-2 p-2 bg-red-500/10 rounded text-xs text-red-400">
                          {config.lastError}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-white/40">
                  <Key className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No Zerodha APIs configured</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-blue-400" />
                AI Provider Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {health?.ai.configs && health.ai.configs.length > 0 ? (
                <div className="space-y-3">
                  {health.ai.configs.map((config) => (
                    <div key={config.id} className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium capitalize">{config.provider}</span>
                          <Badge variant="outline" className="text-xs border-white/20 text-white/60">{config.model}</Badge>
                          {config.isDefault && (
                            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                              <Star className="w-3 h-3 mr-1" />
                              Default
                            </Badge>
                          )}
                        </div>
                        <Badge className={config.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                          {config.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="text-xs text-white/40">
                        Requests: {config.requestCount}
                      </div>
                      {config.lastError && (
                        <div className="mt-2 p-2 bg-red-500/10 rounded text-xs text-red-400">
                          {config.lastError}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-white/40">
                  <BrainCircuit className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No AI providers configured</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Server className="w-5 h-5 text-purple-400" />
                  Infrastructure Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Globe className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Vercel</p>
                        <p className="text-white/40 text-xs">Frontend & API Routes</p>
                      </div>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400">Operational</Badge>
                    <p className="text-xs text-white/40 mt-2">Hosts Next.js app & serverless functions</p>
                  </div>

                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <Database className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Supabase</p>
                        <p className="text-white/40 text-xs">Database & Auth & Realtime</p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(health?.database.status || "unknown")}>
                      {health?.database.status || "Unknown"}
                    </Badge>
                    <p className="text-xs text-white/40 mt-2">PostgreSQL, Auth, Storage, Realtime</p>
                  </div>

                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Activity className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Railway - Market Data Worker</p>
                        <p className="text-white/40 text-xs">WebSocket & Tick Processing</p>
                      </div>
                    </div>
                    <Badge className={(health?.zerodha.connected || 0) > 0 ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}>
                      {(health?.zerodha.connected || 0) > 0 ? "Connected" : "Standby"}
                    </Badge>
                    <p className="text-xs text-white/40 mt-2">Zerodha WebSocket connection & tick data ingestion</p>
                  </div>

                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-orange-500/20 rounded-lg">
                        <Zap className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Railway - Trading Engine</p>
                        <p className="text-white/40 text-xs">Strategy Execution & Orders</p>
                      </div>
                    </div>
                    <Badge className={(health?.database.totalStrategies || 0) > 0 ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}>
                      {(health?.database.totalStrategies || 0) > 0 ? "Active" : "Standby"}
                    </Badge>
                    <p className="text-xs text-white/40 mt-2">Executes trading strategies & manages orders</p>
                  </div>
                </div>
              </CardContent>
            </Card>
        </div>
      )}

      {activeSection === "scaling" && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <div>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                Scaling Recommendations
              </CardTitle>
              <CardDescription className="text-white/40">
                Actionable insights for Vercel, Supabase, Railway, and API key scaling based on current usage
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {analysisLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-white/40" />
              </div>
            ) : !analysis?.recommendations || analysis.recommendations.length === 0 ? (
              <div className="p-8 border border-dashed border-green-500/30 rounded-lg text-center bg-green-500/5">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-400 mb-4" />
                <p className="text-green-400 font-medium">All Systems Optimally Configured</p>
                <p className="text-white/40 text-sm mt-2">No scaling recommendations at this time.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {analysis.recommendations.map((rec, index) => (
                  <div 
                    key={index}
                    className={`p-4 rounded-lg border ${getSeverityColor(rec.severity)}`}
                  >
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(rec.severity)}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-white font-medium">{rec.title}</span>
                          <Badge className={`text-xs ${
                            rec.category === "api_keys" ? "bg-orange-500/20 text-orange-400" :
                            rec.category === "vercel" ? "bg-purple-500/20 text-purple-400" :
                            rec.category === "supabase" ? "bg-green-500/20 text-green-400" :
                            rec.category === "railway" ? "bg-blue-500/20 text-blue-400" :
                            "bg-white/10 text-white/60"
                          }`}>
                            {rec.category.toUpperCase()}
                          </Badge>
                          {rec.threshold && rec.current && (
                            <span className="text-xs text-white/40">
                              {rec.current} / {rec.threshold}
                            </span>
                          )}
                        </div>
                        <p className="text-white/60 text-sm mb-2">{rec.description}</p>
                        <div className="flex items-center gap-2 p-2 bg-white/5 rounded">
                          <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
                          <p className="text-white/80 text-sm">{rec.action}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === "ai" && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-purple-400" />
                AI System Analysis
              </CardTitle>
              <CardDescription className="text-white/40">
                Get AI-powered insights about your system health, performance, and scaling recommendations
              </CardDescription>
            </div>
            <Button 
              onClick={runAiAnalysis}
              disabled={aiAnalyzing}
              className="bg-purple-500 hover:bg-purple-600"
            >
              {aiAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <BrainCircuit className="w-4 h-4 mr-2" />
                  Run AI Analysis
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            {aiAnalysis ? (
              <div className="p-6 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg shrink-0">
                    <BrainCircuit className="w-6 h-6 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-purple-400 font-medium mb-2">AI Analysis Report</h4>
                    <div className="text-white/80 text-sm whitespace-pre-wrap leading-relaxed">
                      {aiAnalysis}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 border border-dashed border-white/20 rounded-lg text-center">
                <BrainCircuit className="w-16 h-16 mx-auto text-white/20 mb-4" />
                <p className="text-white/60 mb-2">No AI analysis yet</p>
                <p className="text-white/40 text-sm">Click &quot;Run AI Analysis&quot; to get intelligent insights about your system</p>
              </div>
            )}

            <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
              <h4 className="text-white font-medium mb-3">What AI Analysis Covers:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white/80">System Health Assessment</p>
                    <p className="text-white/40 text-xs">Overall status of all services and connections</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white/80">Performance Bottlenecks</p>
                    <p className="text-white/40 text-xs">Identify slow queries, high latency issues</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white/80">Scaling Predictions</p>
                    <p className="text-white/40 text-xs">When to upgrade Vercel, Supabase, Railway plans</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white/80">Cost Optimization</p>
                    <p className="text-white/40 text-xs">Recommendations to reduce costs while maintaining performance</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white/80">Security Review</p>
                    <p className="text-white/40 text-xs">API key rotation, token expiry warnings</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white/80">User Growth Impact</p>
                    <p className="text-white/40 text-xs">How user growth affects system resources</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [planDialogUser, setPlanDialogUser] = useState<User | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("basic");
  const [selectedDuration, setSelectedDuration] = useState("1_month");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } finally {
      setLoading(false);
    }
  };

    const handleAction = async (userId: string, action: "approve" | "revoke" | "block" | "unblock") => {
      setActionLoading(userId);
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action })
        });
        
        if (res.ok) {
          const data = await res.json();
          toast.success(data.message || `User ${action}d successfully`);
          await fetchUsers();
        } else {
          toast.error(`Failed to ${action} user`);
        }
      } catch (err) {
        console.error(`Error ${action}ing user:`, err);
        toast.error(`Error ${action}ing user`);
      } finally {
        setActionLoading(null);
      }
    };
  
    const handleDelete = async (userId: string) => {
      if (!confirm("Are you sure you want to permanently delete this user? This action cannot be undone.")) return;
      setActionLoading(userId);
      try {
        const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
        if (res.ok) {
          toast.success("User deleted successfully");
          await fetchUsers();
        } else {
          toast.error("Failed to delete user");
        }
      } catch (err) {
        console.error("Error deleting user:", err);
        toast.error("Error deleting user");
      } finally {
        setActionLoading(null);
      }
    };
  
    const handleAssignPlan = async () => {
      if (!planDialogUser) return;
      setActionLoading(planDialogUser.id);
      try {
        const res = await fetch(`/api/admin/users/${planDialogUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            action: "assign_plan", 
            plan: selectedPlan, 
            duration: selectedDuration 
          })
        });
        
        const data = await res.json();
        
        if (res.ok) {
          const planLabel = PLANS.find(p => p.value === selectedPlan)?.label || selectedPlan;
          const durationLabel = DURATIONS.find(d => d.value === selectedDuration)?.label || selectedDuration;
          toast.success(`Successfully assigned ${planLabel} plan for ${durationLabel} to ${planDialogUser.email}`);
          
          setUsers(prevUsers => prevUsers.map(user => 
            user.id === planDialogUser.id 
              ? { 
                  ...user, 
                  plan: selectedPlan.toUpperCase(), 
                  plan_id: selectedPlan,
                  plan_expires: data.expiresAt || null,
                  is_admin_grant: true 
                }
              : user
          ));
          
          setPlanDialogUser(null);
        } else {
          toast.error(data.error || "Failed to assign plan");
        }
      } catch (err) {
        console.error("Error assigning plan:", err);
        toast.error("Error connecting to server");
      } finally {
        setActionLoading(null);
      }
    };
  
    const handleRevokePlan = async (userId: string) => {
      if (!confirm("Are you sure you want to revoke this user's plan?")) return;
      setActionLoading(userId);
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "revoke_plan" })
        });
        
        if (res.ok) {
          toast.success("Plan revoked successfully");
          await fetchUsers();
        } else {
          toast.error("Failed to revoke plan");
        }
      } catch (err) {
        console.error("Error revoking plan:", err);
        toast.error("Error revoking plan");
      } finally {
        setActionLoading(null);
      }
    };


  const PLANS = [
    { value: "basic", label: "Basic" },
    { value: "pro", label: "Pro" },
    { value: "elite", label: "Elite" },
    { value: "admin", label: "Admin (Full Access)" },
  ];

  const DURATIONS = [
    { value: "1_month", label: "1 Month" },
    { value: "3_months", label: "3 Months" },
    { value: "6_months", label: "6 Months" },
    { value: "1_year", label: "1 Year" },
    { value: "lifetime", label: "Lifetime" },
  ];

  return (
    <>
      <Card className="bg-white/5 border-white/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            User Management
          </CardTitle>
          <CardDescription className="text-white/40">
            Manage user access, approve registrations, block users, and view plans.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers} className="border-white/20 text-white hover:bg-white/10">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-white/40" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 border border-dashed border-white/20 rounded-lg text-center">
            <Users className="w-12 h-12 mx-auto text-white/20 mb-4" />
            <p className="text-white/40 text-sm">No users registered yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div 
                key={user.id} 
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border gap-4 ${
                  user.is_blocked 
                    ? "bg-red-500/5 border-red-500/20" 
                    : "bg-white/5 border-white/10"
                }`}
              >
<div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-white font-medium">{user.email}</span>
                      {user.is_admin && (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          <Shield className="w-3 h-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                        {user.is_blocked && (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                            <Shield className="w-3 h-3 mr-1" />
                            Blocked
                          </Badge>
                        )}
                      {user.plan && !user.is_admin && (
                        <Badge className={`${
                          user.plan === "ELITE" ? "bg-purple-500/20 text-purple-400 border-purple-500/30" :
                          user.plan === "PRO" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                          "bg-green-500/20 text-green-400 border-green-500/30"
                        }`}>
                          <Star className="w-3 h-3 mr-1" />
                          {user.plan}
                        </Badge>
                      )}
                      {!user.email_confirmed && (
                        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                          Email Unverified
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-white/40 flex flex-wrap gap-x-3">
                      {user.full_name && <span>{user.full_name}</span>}
                      <span>Joined: {new Date(user.created_at).toLocaleDateString('en-GB')}</span>
                      {user.last_sign_in_at && (
                        <span>Last login: {new Date(user.last_sign_in_at).toLocaleDateString('en-GB')}</span>
                      )}
                      {user.plan_expires && (
                        <span className="text-cyan-400">Expires: {new Date(user.plan_expires).toLocaleDateString('en-GB')}</span>
                      )}
                      {user.is_admin_grant && user.plan && !user.is_admin && (
                        <span className="text-purple-400">Admin Granted</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {actionLoading === user.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                    ) : (
                      <>
                        {!user.is_admin && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setPlanDialogUser(user);
                              setSelectedPlan(user.plan_id || "basic");
                              setSelectedDuration("1_month");
                            }}
                            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                            title="Assign plan"
                          >
                            <Star className="w-4 h-4 mr-1" />
                            Plan
                          </Button>
                        )}
                        {user.is_admin_grant && user.plan && !user.is_admin && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRevokePlan(user.id)}
                            className="text-orange-400 hover:text-orange-300 hover:bg-orange-400/10"
                            title="Revoke plan"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                          {!user.is_admin && (user.is_blocked ? (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleAction(user.id, "unblock")}
                            className="text-green-400 hover:text-green-300 hover:bg-green-400/10"
                            title="Unblock user"
                          >
                            <Shield className="w-4 h-4" />
                            <span className="ml-1 text-xs">Unblock</span>
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleAction(user.id, "block")}
                            className="text-orange-400 hover:text-orange-300 hover:bg-orange-400/10"
                            title="Block user"
                          >
                            <Shield className="w-4 h-4" />
                          </Button>
                        ))}
                        {!user.is_admin && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDelete(user.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                            title="Delete user permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    <Dialog open={!!planDialogUser} onOpenChange={(o) => !o && setPlanDialogUser(null)}>
      <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Plan</DialogTitle>
          <DialogDescription className="text-white/50">
            Assign a subscription plan to {planDialogUser?.email}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label className="text-white/60">Plan</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                {PLANS.map((plan) => (
                  <SelectItem key={plan.value} value={plan.value}>
                    {plan.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-white/60">Duration</Label>
            <Select value={selectedDuration} onValueChange={setSelectedDuration}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                {DURATIONS.map((dur) => (
                  <SelectItem key={dur.value} value={dur.value}>
                    {dur.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedPlan === "admin" && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">
                Admin plan grants full access to all features including the admin panel.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPlanDialogUser(null)} className="border-white/20 text-white hover:bg-white/10">
            Cancel
          </Button>
          <Button 
            onClick={handleAssignPlan}
            disabled={actionLoading === planDialogUser?.id}
            className="bg-purple-500 hover:bg-purple-600"
          >
            {actionLoading === planDialogUser?.id ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Star className="w-4 h-4 mr-2" />
            )}
            Assign Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}

  function MarketDataManager() {
    const [instruments, setInstruments] = useState<Array<{
      instrument_token: number;
      tradingsymbol: string;
      name: string;
      exchange: string;
    }>>([]);
    const [downloadedInstruments, setDownloadedInstruments] = useState<Array<{
      instrument_token: number;
      tradingsymbol: string;
      name: string;
      exchange: string;
      timeframes: string[];
    }>>([]);
    const [suggestions, setSuggestions] = useState<Array<{
      instrument_token: number;
      tradingsymbol: string;
      name: string;
      exchange: string;
    }>>([]);
    const [stats, setStats] = useState({ total: 0, subscribed: 0 });
    const [historicalStats, setHistoricalStats] = useState({ totalCandles: 0 });
    const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
    const [autoSyncDaily, setAutoSyncDaily] = useState(false);
    const [selectedInstrument, setSelectedInstrument] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
      fetchData();
    }, []);

    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsRes, historicalRes] = await Promise.all([
          fetch("/api/admin/market-data/instruments?limit=0"),
          fetch("/api/admin/market-data/historical"),
        ]);

        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data.stats || { total: 0, subscribed: 0 });
        }

        if (historicalRes.ok) {
          const data = await historicalRes.json();
          setHistoricalStats(data.stats || { totalCandles: 0 });
          
          if (data.instruments && data.coverage) {
            const downloaded = data.instruments.map((inst: any) => ({
              ...inst,
              timeframes: data.coverage[inst.instrument_token] || []
            }));
            setDownloadedInstruments(downloaded);
          }
        }

        // Fetch engine status for sync info
        const statusRes = await fetch("/api/admin/system-health");
        if (statusRes.ok) {
          const data = await statusRes.json();
          // Assuming status returns engine info
          const engine = data.health?.engines?.find((e: any) => e.type === "market_data");
          if (!engine) {
            // Fallback: check data_engine_status directly if health doesn't have engines
            // Actually, let's look at what system-health returns
          }
          
          if (engine) {
            setLastSyncAt(engine.last_instrument_sync_at);
            setAutoSyncDaily(!!engine.auto_sync_instruments);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    const handleSyncInstruments = async () => {
      setSyncing(true);
      try {
        const res = await fetch("/api/admin/market-data/instruments/sync", { method: "POST" });
        if (res.ok) {
          await fetchData();
        }
      } finally {
        setSyncing(false);
      }
    };

    const handleSearch = async (query: string) => {
      setSearchQuery(query);
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const res = await fetch(`/api/admin/market-data/instruments?search=${encodeURIComponent(query)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.instruments || []);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error("Search error:", error);
      }
    };

    const handleDownloadDefaultData = async (instrument: any) => {
      setDownloading(true);
      try {
        const res = await fetch("/api/admin/market-data/historical/default", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instrumentToken: instrument.instrument_token,
            autoSync: true // Enable daily updates by default for these
          }),
        });
        if (res.ok) {
          await fetchData();
          alert("Default historical data download started successfully.");
        }
      } finally {
        setDownloading(false);
      }
    };

    const handleDeleteData = async (instrument: any) => {
      if (!confirm(`Are you sure you want to delete all downloaded historical data for ${instrument.tradingsymbol}?`)) return;
      
      try {
        const res = await fetch("/api/admin/market-data/historical/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instrumentToken: instrument.instrument_token }),
        });
        if (res.ok) {
          await fetchData();
          if (selectedInstrument?.instrument_token === instrument.instrument_token) {
            setSelectedInstrument(null);
          }
        }
      } catch (error) {
        console.error("Delete error:", error);
      }
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/40 text-sm">Total Instruments</p>
                  <p className="text-2xl font-bold text-white">{(stats?.total || 0).toLocaleString()}</p>
                </div>
                <Database className="w-8 h-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/40 text-sm">Last Time Sync</p>
                  <p className="text-lg font-medium text-white">
                    {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "Never"}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/40 text-sm">Historical Data</p>
                  <p className="text-2xl font-bold text-white">{(historicalStats?.totalCandles || 0).toLocaleString()} Candles</p>
                </div>
                <BarChart3 className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-cyan-400" />
                Instrument Sync Management
              </CardTitle>
              <CardDescription className="text-white/40">
                Synchronize instrument master data from Zerodha and configure automatic updates.
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="sync-daily" className="text-white/60 text-sm">Sync Daily</Label>
                <Switch
                  id="sync-daily"
                  checked={autoSyncDaily}
                  onCheckedChange={async (checked) => {
                    setAutoSyncDaily(checked);
                    try {
                      await fetch("/api/admin/market-data/sync-config", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ enabled: checked }),
                      });
                    } catch (error) {
                      console.error("Failed to update sync config:", error);
                    }
                  }}
                />
              </div>
              <Button
                size="sm"
                onClick={handleSyncInstruments}
                disabled={syncing}
                className="bg-cyan-500 hover:bg-cyan-600"
              >
                {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Sync Instruments
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Label className="text-white/60 mb-2 block">Search Instrument</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    placeholder="Search by symbol or name (e.g., NIFTY, SBIN)..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    className="pl-10 bg-white/5 border-white/10 text-white"
                  />
                </div>

                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {suggestions.map((inst) => (
                      <button
                        key={String(inst.instrument_token)}
                        className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors flex items-center justify-between"
                        onClick={() => {
                          setSelectedInstrument(inst);
                          setSearchQuery(inst.tradingsymbol);
                          setShowSuggestions(false);
                        }}
                      >
                        <div>
                          <div className="text-white font-medium">{inst.tradingsymbol}</div>
                          <div className="text-white/40 text-xs">{inst.name}</div>
                        </div>
                        <Badge className="bg-white/10 text-white/60 border-white/20">{inst.exchange}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedInstrument && (
                <div className="mt-6 p-6 bg-white/5 border border-white/10 rounded-xl space-y-6 animate-in fade-in slide-in-from-top-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white">{selectedInstrument.tradingsymbol}</h3>
                      <p className="text-white/40 text-sm">{selectedInstrument.name} • {selectedInstrument.exchange}</p>
                      <p className="text-white/20 text-xs mt-1">Token: {String(selectedInstrument.instrument_token)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedInstrument(null)}
                        className="border-white/10 text-white hover:bg-white/5"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <Label className="text-white/60 block">Download Default Timeframe Data</Label>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="p-3 bg-white/5 border border-white/5 rounded-lg text-sm space-y-1">
                          <div className="flex justify-between text-white/80">
                            <span>3 Minute Timeframe</span>
                            <span className="text-cyan-400">1 Month</span>
                          </div>
                          <div className="flex justify-between text-white/80">
                            <span>5 Minute Timeframe</span>
                            <span className="text-cyan-400">3 Months</span>
                          </div>
                          <div className="flex justify-between text-white/80">
                            <span>15 Minute Timeframe</span>
                            <span className="text-cyan-400">6 Months</span>
                          </div>
                          <div className="flex justify-between text-white/80">
                            <span>1 Hour Timeframe</span>
                            <span className="text-cyan-400">1 Year</span>
                          </div>
                          <div className="flex justify-between text-white/80">
                            <span>Daily Timeframe</span>
                            <span className="text-cyan-400">3 Years</span>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleDownloadDefaultData(selectedInstrument)}
                          disabled={downloading}
                          className="w-full bg-cyan-500 hover:bg-cyan-600"
                        >
                          {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                          Download All Default Timeframes
                        </Button>
                        <p className="text-[10px] text-yellow-400/60 text-center font-medium">
                          This data is used ONLY for strategy backtesting. Live trading uses real-time WebSocket data.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label className="text-white/60 block">Manage Downloaded Data</Label>
                      <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-lg">
                        <p className="text-sm text-red-400/80 mb-4">
                          Remove all cached historical candles and disable automatic daily updates for this instrument.
                        </p>
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteData(selectedInstrument)}
                          className="w-full text-red-400 hover:text-red-300 hover:bg-red-400/10 border border-red-500/20"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete All Cached Data
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {downloadedInstruments.length > 0 && !selectedInstrument && (
                <div className="mt-8 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-white/60">Downloaded Instruments ({downloadedInstruments.length})</Label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {downloadedInstruments.map((inst) => (
                      <div 
                        key={inst.instrument_token}
                        className="p-3 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between group"
                      >
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => setSelectedInstrument(inst)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm">{inst.tradingsymbol}</span>
                            <Badge variant="outline" className="text-[10px] py-0 h-4 border-white/10 text-white/40">
                              {inst.exchange}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {inst.timeframes.map((tf) => (
                              <span key={tf} className="text-[9px] px-1 bg-cyan-500/10 text-cyan-400 rounded">
                                {tf}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteData(inst)}
                          className="h-7 w-7 p-0 text-white/20 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

interface AdminStrategy {
  id: number;
  name: string;
  description: string;
  visibility: string;
  admin_approved: boolean;
  is_active: boolean;
  selected_timeframes: string[];
  status: string;
  created_at: string;
  user_id: string;
  creator: { username?: string; email?: string };
  stats: { win_rate?: number; net_pnl_percentage?: number; total_trades?: number } | null;
  raw_input?: string;
  buy_entry_logic?: Record<string, unknown>;
  buy_stop_loss?: Record<string, unknown>;
  buy_target?: Record<string, unknown>;
  buy_trailing_sl?: Record<string, unknown>;
  sell_entry_logic?: Record<string, unknown>;
  sell_stop_loss?: Record<string, unknown>;
  sell_target?: Record<string, unknown>;
  sell_trailing_sl?: Record<string, unknown>;
  hold_logic?: Record<string, unknown>;
}

interface BacktestResult {
  id: number;
  timeframe: string;
  capital_used: number;
  total_trades: number;
  net_pnl: number;
  net_pnl_percentage: number;
  win_rate: number;
  max_drawdown_percentage: number;
  created_at: string;
}

function StrategyApprovalManager() {
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
