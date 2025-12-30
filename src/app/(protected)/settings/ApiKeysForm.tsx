"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Key, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";

export function ApiKeysForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keys, setKeys] = useState({ apiKey: "", apiSecret: "" });
  const [status, setStatus] = useState<"connected" | "disconnected" | "checking">("disconnected");
  const supabase = createClient();

  useEffect(() => {
    async function loadKeys() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("user_config")
          .select("preferences")
          .eq("user_id", user.id)
          .single();

        if (data?.preferences) {
          const prefs = data.preferences as any;
          setKeys({
            apiKey: prefs.zerodha_api_key || "",
            apiSecret: prefs.zerodha_api_secret || ""
          });
          if (prefs.zerodha_api_key && prefs.zerodha_api_secret) {
            setStatus("connected");
          }
        }
      }
      setLoading(false);
    }
    loadKeys();
  }, [supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("user_config")
      .upsert({
        user_id: user.id,
        preferences: {
          zerodha_api_key: keys.apiKey,
          zerodha_api_secret: keys.apiSecret,
          updated_at: new Date().toISOString()
        }
      });

    if (error) {
      toast.error("Failed to save API keys");
    } else {
      toast.success("API keys saved successfully");
      setStatus("connected");
    }
    setSaving(false);
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
            <p className="text-xs text-white/40">{status === 'connected' ? 'Successfully connected to Zerodha' : 'Not connected'}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="border-white/10 text-white hover:bg-white/5" onClick={() => setStatus("checking")}>
          {status === "checking" ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null}
          Check Connection
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apiKey">Zerodha API Key</Label>
          <div className="relative">
            <Key className="absolute left-3 top-2.5 h-4 w-4 text-white/20" />
            <Input 
              id="apiKey" 
              value={keys.apiKey}
              onChange={(e) => setKeys(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="Enter your API key"
              className="bg-white/5 border-white/10 pl-10"
              type="password"
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
              placeholder="Enter your API secret"
              className="bg-white/5 border-white/10 pl-10"
              type="password"
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
            Save & Connect
          </Button>
        </div>
      </form>
      
      <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
        <p className="text-[10px] text-blue-400/80 leading-relaxed">
          Your API keys are encrypted and stored securely. We never share your credentials with third parties. 
          Make sure you have enabled the required permissions in your Zerodha developer console.
        </p>
      </div>
    </div>
  );
}
