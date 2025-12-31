"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Key, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";

export function ApiKeysForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keys, setKeys] = useState({ apiKey: "", apiSecret: "" });
  const [maskedKeys, setMaskedKeys] = useState({ apiKey: "", apiSecret: "" });
  const [status, setStatus] = useState<"connected" | "disconnected" | "checking">("disconnected");

  useEffect(() => {
    async function loadKeys() {
      try {
        const response = await fetch("/api/credentials");
        if (response.ok) {
          const data = await response.json();
          const creds = data.credentials || {};
          setMaskedKeys({
            apiKey: creds.zerodha_api_key || "",
            apiSecret: creds.zerodha_api_secret || "",
          });
          if (creds.zerodha_api_key && creds.zerodha_api_secret) {
            setStatus("connected");
          }
        }
      } catch (error) {
        console.error("Error loading API keys:", error);
      } finally {
        setLoading(false);
      }
    }
    loadKeys();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!keys.apiKey.trim() && !keys.apiSecret.trim()) {
      toast.error("Please enter at least one credential");
      return;
    }

    setSaving(true);
    
    try {
      const payload: Record<string, string> = {};
      if (keys.apiKey.trim()) payload.zerodha_api_key = keys.apiKey;
      if (keys.apiSecret.trim()) payload.zerodha_api_secret = keys.apiSecret;

      const response = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      toast.success("API keys saved securely");
      setStatus("connected");
      setKeys({ apiKey: "", apiSecret: "" });
      
      const refreshResponse = await fetch("/api/credentials");
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        const creds = data.credentials || {};
        setMaskedKeys({
          apiKey: creds.zerodha_api_key || "",
          apiSecret: creds.zerodha_api_secret || "",
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save API keys");
    } finally {
      setSaving(false);
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
      <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${status === 'connected' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            {status === 'connected' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-sm font-medium text-white">Connection Status</p>
            <p className="text-xs text-white/40">{status === 'connected' ? 'Credentials stored securely' : 'Not configured'}</p>
          </div>
        </div>
      </div>

      {status === 'connected' && (maskedKeys.apiKey || maskedKeys.apiSecret) && (
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2">
          <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Stored Credentials (Masked)</p>
          {maskedKeys.apiKey && (
            <p className="text-sm text-white/70 font-mono">API Key: {maskedKeys.apiKey}</p>
          )}
          {maskedKeys.apiSecret && (
            <p className="text-sm text-white/70 font-mono">API Secret: {maskedKeys.apiSecret}</p>
          )}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apiKey">Zerodha API Key {status === 'connected' && '(Update)'}</Label>
          <div className="relative">
            <Key className="absolute left-3 top-2.5 h-4 w-4 text-white/20" />
            <Input 
              id="apiKey" 
              value={keys.apiKey}
              onChange={(e) => setKeys(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder={status === 'connected' ? "Enter new key to update" : "Enter your API key"}
              className="bg-white/5 border-white/10 pl-10"
              type="password"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiSecret">Zerodha API Secret {status === 'connected' && '(Update)'}</Label>
          <div className="relative">
            <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-white/20" />
            <Input 
              id="apiSecret" 
              value={keys.apiSecret}
              onChange={(e) => setKeys(prev => ({ ...prev, apiSecret: e.target.value }))}
              placeholder={status === 'connected' ? "Enter new secret to update" : "Enter your API secret"}
              className="bg-white/5 border-white/10 pl-10"
              type="password"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="pt-2">
          <Button 
            type="submit" 
            disabled={saving}
            className="w-full bg-white text-black hover:bg-white/90"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {status === 'connected' ? 'Update Credentials' : 'Save & Connect'}
          </Button>
        </div>
      </form>
      
      <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
        <p className="text-[10px] text-blue-400/80 leading-relaxed">
          Your API keys are encrypted with AES-256-GCM before storage. We never share your credentials with third parties. 
          Make sure you have enabled the required permissions in your Zerodha developer console.
        </p>
      </div>
    </div>
  );
}
