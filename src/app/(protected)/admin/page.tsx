"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  EyeOff
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
  created_at: string;
  plan: string | null;
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
          <TabsList className="flex h-11 items-center justify-start gap-1 rounded-xl border border-white/10 bg-white/5 p-1 overflow-x-auto no-scrollbar w-full md:w-max">
            <TabsTrigger 
              value="zerodha" 
              className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white rounded-lg transition-all text-xs md:text-sm whitespace-nowrap"
            >
              <Key className="w-4 h-4 shrink-0" />
              <span>Zerodha APIs</span>
            </TabsTrigger>
            <TabsTrigger 
              value="ai-config" 
              className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white rounded-lg transition-all text-xs md:text-sm whitespace-nowrap"
            >
              <BrainCircuit className="w-4 h-4 shrink-0" />
              <span>AI Services</span>
            </TabsTrigger>
            <TabsTrigger 
              value="system-health" 
              className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-green-500 data-[state=active]:text-white rounded-lg transition-all text-xs md:text-sm whitespace-nowrap"
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span>System Health</span>
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white rounded-lg transition-all text-xs md:text-sm whitespace-nowrap"
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Users</span>
            </TabsTrigger>
          </TabsList>

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

  const handleLogin = async (configId: string) => {
    setLoginInProgress(configId);
    try {
      const res = await fetch(`/api/admin/zerodha-configs/${configId}/login`, {
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
                        {config.priority === 1 && (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            <Star className="w-3 h-3 mr-1" />
                            Primary
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-white/40">API Key:</span>
                          <span className="text-white/70 ml-2">{config.api_key}</span>
                        </div>
                        <div>
                          <span className="text-white/40">User ID:</span>
                          <span className="text-white/70 ml-2">{config.user_id}</span>
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
                          <span className="text-red-400 text-sm">{config.last_error}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Switch
                        checked={config.is_active}
                        onCheckedChange={(checked) => handleToggleActive(config.id, checked)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLogin(config.id)}
                        disabled={loginInProgress === config.id || !config.is_active}
                        className="border-white/20 text-white hover:bg-white/10"
                      >
                        {loginInProgress === config.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Power className="w-4 h-4" />
                        )}
                      </Button>
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editConfig ? "Edit" : "Add"} Zerodha Configuration</DialogTitle>
          <DialogDescription className="text-white/50">
            {editConfig 
              ? "Update the configuration. Leave credential fields empty to keep existing values."
              : "Add a new Zerodha API configuration for market data access."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
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
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        {getProviderIcon(config.provider)}
                        <span className="text-white font-medium text-lg">
                          {providers[config.provider]?.name || config.provider}
                        </span>
                        <Badge className="bg-white/10 text-white/70 border-white/20">
                          {config.model}
                        </Badge>
                        {config.is_default && (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            <Star className="w-3 h-3 mr-1" />
                            Default
                          </Badge>
                        )}
                        {testResults[config.id] === "success" && (
                          <span className="flex items-center gap-1 text-green-400 text-sm">
                            <CheckCircle2 className="w-4 h-4" /> Working
                          </span>
                        )}
                        {testResults[config.id] === "error" && (
                          <span className="flex items-center gap-1 text-red-400 text-sm">
                            <XCircle className="w-4 h-4" /> Failed
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-white/40">API Key:</span>
                          <span className="text-white/70 ml-2">{config.api_key}</span>
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
                          <span className="text-red-400 text-sm">{config.last_error}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
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

function SystemHealthDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);

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
        setRecommendations(data.recommendations || []);
      }
    } finally {
      setAnalysisLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "warning": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "info": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/40 text-sm">Zerodha Status</p>
                <p className="text-2xl font-bold text-white">
                  {health?.zerodha.connected}/{health?.zerodha.total}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${health?.zerodha.connected === health?.zerodha.total ? "bg-green-500/20" : "bg-yellow-500/20"}`}>
                <Key className={`w-6 h-6 ${health?.zerodha.connected === health?.zerodha.total ? "text-green-400" : "text-yellow-400"}`} />
              </div>
            </div>
            <p className="text-xs text-white/40 mt-2">
              {health?.zerodha.errors || 0} errors, {health?.zerodha.disconnected || 0} disconnected
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/40 text-sm">AI Services</p>
                <p className="text-2xl font-bold text-white">
                  {health?.ai.active}/{health?.ai.total}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${health?.ai.active === health?.ai.total ? "bg-green-500/20" : "bg-yellow-500/20"}`}>
                <BrainCircuit className={`w-6 h-6 ${health?.ai.active === health?.ai.total ? "text-green-400" : "text-yellow-400"}`} />
              </div>
            </div>
            <p className="text-xs text-white/40 mt-2">
              {health?.ai.errors || 0} with errors, {health?.ai.inactive || 0} inactive
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/40 text-sm">Total Users</p>
                <p className="text-2xl font-bold text-white">{health?.database.totalUsers || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/20">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <p className="text-xs text-white/40 mt-2">
              {health?.database.totalStrategies || 0} strategies created
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/40 text-sm">Database</p>
                <p className="text-2xl font-bold text-green-400">{health?.database.status || "Unknown"}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/20">
                <Server className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <p className="text-xs text-white/40 mt-2">
              {health?.database.totalTrades || 0} total trades
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              AI System Analysis & Recommendations
            </CardTitle>
            <CardDescription className="text-white/40">
              Intelligent insights about system health and suggested actions.
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { fetchHealth(); fetchAnalysis(); }}
            className="border-white/20 text-white hover:bg-white/10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${analysisLoading ? "animate-spin" : ""}`} />
            Refresh Analysis
          </Button>
        </CardHeader>
        <CardContent>
          {analysisLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-white/40" />
            </div>
          ) : recommendations.length === 0 ? (
            <div className="p-8 border border-dashed border-green-500/30 rounded-lg text-center bg-green-500/5">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-400 mb-4" />
              <p className="text-green-400 font-medium">All Systems Healthy</p>
              <p className="text-white/40 text-sm mt-2">No issues or recommendations at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-lg border ${getSeverityColor(rec.severity)}`}
                >
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(rec.severity)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium">{rec.title}</span>
                        <Badge className="text-xs" variant="outline">{rec.category}</Badge>
                      </div>
                      <p className="text-white/60 text-sm mb-2">{rec.description}</p>
                      <p className="text-white/80 text-sm">
                        <span className="text-white/40">Suggested Action:</span> {rec.action}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {health?.errors.recentErrors && health.errors.recentErrors.length > 0 && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
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
    </div>
  );
}

function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleApprove = async (userId: string, approve: boolean) => {
    await fetch("/api/admin/users/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, approve })
    });
    fetchUsers();
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    fetchUsers();
  };

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            User Management
          </CardTitle>
          <CardDescription className="text-white/40">
            Manage user access, approve registrations, and view plans.
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
                className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{user.email}</span>
                    {user.is_approved ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Approved</Badge>
                    ) : (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>
                    )}
                  </div>
                  <div className="text-xs text-white/40">
                    {user.full_name && <span>{user.full_name} • </span>}
                    Joined: {new Date(user.created_at).toLocaleDateString()}
                    {user.plan && <span> • Plan: {user.plan}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user.is_approved ? (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleApprove(user.id, false)}
                      className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10"
                    >
                      <UserX className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleApprove(user.id, true)}
                      className="text-green-400 hover:text-green-300 hover:bg-green-400/10"
                    >
                      <UserCheck className="w-4 h-4" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDelete(user.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
