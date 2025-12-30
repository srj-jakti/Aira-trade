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
  Save,
  TestTube,
  CheckCircle2,
  XCircle,
  Trash2,
  Eye,
  UserCheck,
  UserX
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_approved: boolean;
  created_at: string;
  plan: string | null;
}

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("historical-data");
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
      <div className="flex-1 p-4 md:p-8 pt-6 space-y-6 max-w-6xl mx-auto w-full">
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
            <p className="text-white/50 text-sm">Manage system configuration and users.</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex h-11 items-center justify-start gap-1 rounded-xl border border-white/10 bg-white/5 p-1 overflow-x-auto no-scrollbar w-full md:w-max">
            <TabsTrigger 
              value="historical-data" 
              className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white rounded-lg transition-all text-xs md:text-sm whitespace-nowrap"
            >
              <Database className="w-4 h-4 shrink-0" />
              <span>Historical Data</span>
            </TabsTrigger>
            <TabsTrigger 
              value="zerodha" 
              className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white rounded-lg transition-all text-xs md:text-sm whitespace-nowrap"
            >
              <Key className="w-4 h-4 shrink-0" />
              <span>Zerodha API</span>
            </TabsTrigger>
            <TabsTrigger 
              value="ai-config" 
              className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white rounded-lg transition-all text-xs md:text-sm whitespace-nowrap"
            >
              <BrainCircuit className="w-4 h-4 shrink-0" />
              <span>AI Config</span>
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white rounded-lg transition-all text-xs md:text-sm whitespace-nowrap"
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>User Management</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="historical-data" className="mt-0">
            <HistoricalDataManager />
          </TabsContent>

          <TabsContent value="zerodha" className="mt-0">
            <ZerodhaConfigManager />
          </TabsContent>

          <TabsContent value="ai-config" className="mt-0">
            <AIConfigManager />
          </TabsContent>

          <TabsContent value="users" className="mt-0">
            <UserManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function HistoricalDataManager() {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <Database className="w-5 h-5 text-purple-400" />
          Historical Data Manager
        </CardTitle>
        <CardDescription className="text-white/40">
          Manage historical market data for backtesting and analysis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-8 border border-dashed border-white/20 rounded-lg text-center">
          <Database className="w-12 h-12 mx-auto text-white/20 mb-4" />
          <p className="text-white/40 text-sm">
            Historical data manager will be available once Zerodha is connected.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ZerodhaConfigManager() {
  const [config, setConfig] = useState({
    apiKey: "",
    apiSecret: "",
    userId: "",
    password: "",
    totpSecret: ""
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "zerodha", config })
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "zerodha" })
      });
      setTestResult(res.ok ? "success" : "error");
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <Key className="w-5 h-5 text-orange-400" />
          Zerodha API Configuration
        </CardTitle>
        <CardDescription className="text-white/40">
          Configure Zerodha Kite Connect API credentials for market data and trading.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-white/60">API Key</Label>
            <Input 
              type="password"
              placeholder="Enter API Key"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/60">API Secret</Label>
            <Input 
              type="password"
              placeholder="Enter API Secret"
              value={config.apiSecret}
              onChange={(e) => setConfig({ ...config, apiSecret: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/60">User ID</Label>
            <Input 
              placeholder="Enter User ID"
              value={config.userId}
              onChange={(e) => setConfig({ ...config, userId: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/60">Password</Label>
            <Input 
              type="password"
              placeholder="Enter Password"
              value={config.password}
              onChange={(e) => setConfig({ ...config, password: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-white/60">TOTP Secret</Label>
            <Input 
              type="password"
              placeholder="Enter TOTP Secret for auto-login"
              value={config.totpSecret}
              onChange={(e) => setConfig({ ...config, totpSecret: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <Button 
            onClick={handleSave}
            disabled={saving}
            className="bg-purple-500 hover:bg-purple-600"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Configuration
          </Button>
          <Button 
            variant="outline"
            onClick={handleTest}
            disabled={testing}
            className="border-white/20 text-white hover:bg-white/10"
          >
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
            Test Connection
          </Button>
          {testResult === "success" && (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Connected
            </span>
          )}
          {testResult === "error" && (
            <span className="flex items-center gap-1 text-red-400 text-sm">
              <XCircle className="w-4 h-4" /> Connection Failed
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AIConfigManager() {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ai", config: { apiKey } })
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ai" })
      });
      setTestResult(res.ok ? "success" : "error");
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-blue-400" />
          AI API Configuration
        </CardTitle>
        <CardDescription className="text-white/40">
          Configure AI model API key for trading analysis and predictions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-white/60">AI API Key</Label>
          <Input 
            type="password"
            placeholder="Enter AI API Key (OpenAI, Claude, etc.)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="bg-white/5 border-white/10 text-white"
          />
        </div>

        <div className="flex items-center gap-3 pt-4">
          <Button 
            onClick={handleSave}
            disabled={saving}
            className="bg-purple-500 hover:bg-purple-600"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Configuration
          </Button>
          <Button 
            variant="outline"
            onClick={handleTest}
            disabled={testing}
            className="border-white/20 text-white hover:bg-white/10"
          >
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
            Test Connection
          </Button>
          {testResult === "success" && (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <CheckCircle2 className="w-4 h-4" /> API Working
            </span>
          )}
          {testResult === "error" && (
            <span className="flex items-center gap-1 text-red-400 text-sm">
              <XCircle className="w-4 h-4" /> API Error
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

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
      <CardHeader>
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-green-400" />
          User Management
        </CardTitle>
        <CardDescription className="text-white/40">
          Manage user access, view plans, and delete accounts.
        </CardDescription>
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
