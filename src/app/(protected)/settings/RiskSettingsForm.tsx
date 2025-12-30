"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, TrendingUp, TrendingDown, Target } from "lucide-react";

const SEGMENTS = [
  { id: "equity", label: "Equity" },
  { id: "options", label: "Options (F&O)" },
  { id: "futures", label: "Futures" },
  { id: "commodity", label: "Commodity" },
  { id: "currency", label: "Currency" },
];

export function RiskSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    auto_trading_enabled: false,
    preferred_markets: [] as string[],
    daily_profit_limit: "",
    daily_loss_limit: "",
    max_allocation_per_trade: ""
  });
  const supabase = createClient();

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("trading_preferences")
            .select("*")
            .eq("user_id", user.id)
            .single();

          if (data) {
            setSettings({
              auto_trading_enabled: data.auto_trading_enabled || false,
              preferred_markets: data.preferred_markets || [],
              daily_profit_limit: data.daily_profit_limit?.toString() || "",
              daily_loss_limit: data.daily_loss_limit?.toString() || "",
              max_allocation_per_trade: data.max_allocation_per_trade?.toString() || ""
            });
          }
        }
      } catch (error) {
        console.error("Error loading risk settings:", error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("trading_preferences")
      .upsert({
        user_id: user.id,
        auto_trading_enabled: settings.auto_trading_enabled,
        preferred_markets: settings.preferred_markets,
        daily_profit_limit: parseFloat(settings.daily_profit_limit) || 0,
        daily_loss_limit: parseFloat(settings.daily_loss_limit) || 0,
        max_allocation_per_trade: parseFloat(settings.max_allocation_per_trade) || 0,
        updated_at: new Date().toISOString()
      });

    if (error) {
      toast.error("Failed to save risk settings");
    } else {
      toast.success("Risk settings updated successfully");
    }
    setSaving(false);
  };

  const toggleSegment = (id: string) => {
    setSettings(prev => ({
      ...prev,
      preferred_markets: prev.preferred_markets.includes(id)
        ? prev.preferred_markets.filter(m => m !== id)
        : [...prev.preferred_markets, id]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
        <div className="space-y-0.5">
          <Label className="text-base text-white">Auto-Trading</Label>
          <p className="text-xs text-white/40">Allow AI to execute trades automatically based on signals.</p>
        </div>
        <Switch 
          checked={settings.auto_trading_enabled}
          onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_trading_enabled: checked }))}
        />
      </div>

      <div className="space-y-4">
        <Label className="text-white/60 text-xs uppercase tracking-wider font-bold">Market Segments</Label>
        <div className="grid grid-cols-2 gap-4">
          {SEGMENTS.map((segment) => (
            <div key={segment.id} className="flex items-center space-x-3 p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/[0.08] transition-colors cursor-pointer" onClick={() => toggleSegment(segment.id)}>
              <Checkbox 
                id={segment.id} 
                checked={settings.preferred_markets.includes(segment.id)}
                onCheckedChange={() => toggleSegment(segment.id)}
                className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black"
              />
              <label htmlFor={segment.id} className="text-sm text-white cursor-pointer">{segment.label}</label>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profitLimit" className="flex items-center gap-2">
            <TrendingUp className="w-3 h-3 text-green-500" />
            Daily Profit Limit (₹)
          </Label>
          <Input 
            id="profitLimit" 
            type="number"
            value={settings.daily_profit_limit}
            onChange={(e) => setSettings(prev => ({ ...prev, daily_profit_limit: e.target.value }))}
            placeholder="e.g. 5000"
            className="bg-white/5 border-white/10"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lossLimit" className="flex items-center gap-2">
            <TrendingDown className="w-3 h-3 text-red-500" />
            Daily Loss Limit (₹)
          </Label>
          <Input 
            id="lossLimit" 
            type="number"
            value={settings.daily_loss_limit}
            onChange={(e) => setSettings(prev => ({ ...prev, daily_loss_limit: e.target.value }))}
            placeholder="e.g. 2000"
            className="bg-white/5 border-white/10"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="maxAlloc" className="flex items-center gap-2">
            <Target className="w-3 h-3 text-blue-500" />
            Max Allocation Per Trade (%)
          </Label>
          <Input 
            id="maxAlloc" 
            type="number"
            value={settings.max_allocation_per_trade}
            onChange={(e) => setSettings(prev => ({ ...prev, max_allocation_per_trade: e.target.value }))}
            placeholder="e.g. 10"
            className="bg-white/5 border-white/10"
          />
        </div>
      </div>

      <Button 
        type="submit" 
        disabled={saving}
        className="w-full bg-white text-black hover:bg-white/90"
      >
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Save Risk Preferences
      </Button>
    </form>
  );
}
