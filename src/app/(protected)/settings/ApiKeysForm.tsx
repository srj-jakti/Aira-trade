"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Key, ShieldCheck, CheckCircle2, XCircle, ExternalLink, Globe, Copy, Check } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function ApiKeysFormContent() {
  const supabase = createClient();
  const [copied, setCopied] = useState(false);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const redirectUrl = `${baseUrl}/api/user/broker/callback`;

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Redirect URL copied!");
    setTimeout(() => setCopied(false), 2000);
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [keys, setKeys] = useState({ apiKey: "", apiSecret: "" });
  const [maskedKeys, setMaskedKeys] = useState({ apiKey: "", apiSecret: "" });
  const [status, setStatus] = useState<"connected" | "disconnected" | "keys_saved">("disconnected");
  const [brokerAccount, setBrokerAccount] = useState<{ is_connected: boolean; user_id_broker?: string } | null>(null);
  const searchParams = useSearchParams();

  const loadData = useCallback(async () => {
    try {
      const [credsRes, brokerRes] = await Promise.all([
        fetch("/api/credentials"),
        fetch("/api/user/broker"),
      ]);

      if (credsRes.ok) {
        const data = await credsRes.json();
        const creds = data.credentials || {};
        setMaskedKeys({
          apiKey: creds.zerodha_api_key || "",
          apiSecret: creds.zerodha_api_secret || "",
        });
        if (creds.zerodha_api_key && creds.zerodha_api_secret) {
          setStatus("keys_saved");
        }
      }

      if (brokerRes.ok) {
        const data = await brokerRes.json();
        if (data.account) {
          setBrokerAccount(data.account);
          if (data.account.is_connected) {
            setStatus("connected");
          }
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const brokerError = searchParams.get("broker_error");
    if (brokerError) {
      const errorMessages: Record<string, string> = {
        auth_failed: "Zerodha authentication failed. Please try again.",
        missing_user: "Session expired. Please login again.",
        no_account: "Please save your API keys first.",
        no_secret: "API Secret not found. Please save your credentials.",
        token_failed: "Failed to get access token. Please try again.",
        server_error: "Server error. Please try again later.",
      };
      toast.error(errorMessages[brokerError] || "Connection failed");
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "ZERODHA_AUTH_SUCCESS") {
        toast.success("Zerodha connected successfully!");
        setConnecting(false);
        loadData();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [loadData]);

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!keys.apiKey.trim() || !keys.apiSecret.trim()) {
      toast.error("Both API Key and API Secret are required");
      return;
    }

    setSaving(true);
    
    try {
      const response = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zerodha_api_key: keys.apiKey,
          zerodha_api_secret: keys.apiSecret,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      await fetch("/api/user/broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keys.apiKey }),
      });

      toast.success("API keys saved! Now connect to Zerodha.");
      setStatus("keys_saved");
      setKeys({ apiKey: "", apiSecret: "" });
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save API keys");
    } finally {
      setSaving(false);
    }
  };

  const handleConnectZerodha = async () => {
    if (!maskedKeys.apiKey) {
      toast.error("Please save your API keys first");
      return;
    }

    setConnecting(true);

    try {
      const [credsRes, { data: { user } }] = await Promise.all([
        fetch("/api/credentials"),
        supabase.auth.getUser()
      ]);
      
      if (!credsRes.ok) throw new Error("Failed to get credentials");
      
      const credsData = await credsRes.json();
      const rawApiKey = credsData.raw?.zerodha_api_key;
      
      if (!rawApiKey) {
        toast.error("API Key not found. Please re-enter your credentials.");
        setConnecting(false);
        return;
      }

      const userId = user?.id || "";

      const loginUrl = userId 
        ? `https://kite.trade/connect/login?v=3&api_key=${rawApiKey}&redirect_params=user_id%3D${userId}`
        : `https://kite.trade/connect/login?v=3&api_key=${rawApiKey}`;
      
      const popup = window.open(
        loginUrl,
        "zerodha_login",
        "width=500,height=700,scrollbars=yes,resizable=yes"
      );

      if (!popup) {
        toast.error("Popup blocked. Please allow popups for this site.");
        setConnecting(false);
        return;
      }

      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          setConnecting(false);
          loadData();
        }
      }, 500);

    } catch (error) {
      console.error("Connect error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to initiate connection");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const response = await fetch("/api/user/broker", { method: "DELETE" });
      if (response.ok) {
        toast.success("Broker disconnected");
        setBrokerAccount(null);
        setStatus("keys_saved");
        await loadData();
      }
    } catch {
      toast.error("Failed to disconnect");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-white/20" />
      </div>
    );
  }

    return (
      <div className="space-y-6">
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-blue-400 font-medium text-sm mb-1">Kite Connect Redirect URL</p>
              <p className="text-white/60 text-xs mb-2">
                When creating your Kite Connect app at{" "}
                <a href="https://developers.kite.trade" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  developers.kite.trade
                </a>
                , use this URL as the Redirect URL:
              </p>
              <div className="flex items-center gap-2 p-2 bg-black/30 rounded border border-white/10">
                <code className="text-green-400 text-xs flex-1 break-all">{redirectUrl}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(redirectUrl)}
                  className="text-white/60 hover:text-white h-7 px-2"
                >
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${status === 'connected' ? 'bg-green-500/10 text-green-500' : status === 'keys_saved' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
            {status === 'connected' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {status === 'connected' ? 'Zerodha Connected' : status === 'keys_saved' ? 'Keys Saved - Login Required' : 'Not Connected'}
            </p>
            <p className="text-xs text-white/40">
              {status === 'connected' && brokerAccount?.user_id_broker 
                ? `Broker ID: ${brokerAccount.user_id_broker}` 
                : status === 'keys_saved' 
                  ? 'Click "Connect to Zerodha" to authenticate'
                  : 'Save your API credentials to get started'}
            </p>
          </div>
        </div>
        {status === 'connected' && (
          <Button 
            variant="outline" 
            size="sm"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            onClick={handleDisconnect}
          >
            Disconnect
          </Button>
        )}
      </div>

      {status === 'keys_saved' && (
        <Button
          onClick={handleConnectZerodha}
          disabled={connecting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {connecting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ExternalLink className="w-4 h-4 mr-2" />
          )}
          {connecting ? 'Waiting for login...' : 'Connect to Zerodha'}
        </Button>
      )}

      {status !== 'connected' && (
        <form onSubmit={handleSaveKeys} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">Zerodha API Key</Label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-white/20" />
              <Input 
                id="apiKey" 
                value={keys.apiKey}
                onChange={(e) => setKeys(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder={maskedKeys.apiKey ? `Current: ${maskedKeys.apiKey}` : "Enter your API key"}
                className="bg-white/5 border-white/10 pl-10"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiSecret">Zerodha API Secret</Label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-white/20" />
              <Input 
                id="apiSecret" 
                value={keys.apiSecret}
                onChange={(e) => setKeys(prev => ({ ...prev, apiSecret: e.target.value }))}
                placeholder={maskedKeys.apiSecret ? `Current: ${maskedKeys.apiSecret}` : "Enter your API secret"}
                className="bg-white/5 border-white/10 pl-10"
                type="password"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button 
              type="submit" 
              disabled={saving || !keys.apiKey.trim() || !keys.apiSecret.trim()}
              className="w-full bg-white text-black hover:bg-white/90"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {status === 'keys_saved' ? 'Update API Keys' : 'Save API Keys'}
            </Button>
          </div>
        </form>
      )}
      
      <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
        <p className="text-[10px] text-blue-400/80 leading-relaxed">
          <strong>How it works:</strong> 1) Save your API Key & Secret from Zerodha Developer Console. 
          2) Click "Connect to Zerodha" to login with your Zerodha credentials. 
          3) After login, your broker will be connected automatically.
        </p>
      </div>
    </div>
  );
}

export function ApiKeysForm() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-white/20" />
      </div>
    }>
      <ApiKeysFormContent />
    </Suspense>
  );
}
