"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, TrendingUp, TrendingDown, Target, AlertTriangle, Info } from "lucide-react";

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
  const [automationConsent, setAutomationConsent] = useState(false);
  const [settings, setSettings] = useState({
    auto_trading_enabled: false,
    preferred_markets: [] as string[],
    daily_profit_limit: "",
    daily_loss_limit: "",
    max_allocation_per_trade: ""
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/trading/settings");
        if (response.ok) {
          const data = await response.json();
          if (data.settings) {
            setSettings({
              auto_trading_enabled: data.settings.auto_trading_enabled || false,
              preferred_markets: data.settings.preferred_markets || [],
              daily_profit_limit: data.settings.daily_profit_limit?.toString() || "",
              daily_loss_limit: data.settings.daily_loss_limit?.toString() || "",
              max_allocation_per_trade: data.settings.max_allocation_per_trade?.toString() || ""
            });
            if (data.settings.auto_trading_enabled) {
              setAutomationConsent(true);
            }
          }
        }
      } catch (error) {
        console.error("Error loading risk settings:", error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/trading/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auto_trading_enabled: settings.auto_trading_enabled,
          preferred_markets: settings.preferred_markets,
          daily_profit_limit: parseFloat(settings.daily_profit_limit) || 0,
          daily_loss_limit: parseFloat(settings.daily_loss_limit) || 0,
          max_allocation_per_trade: parseFloat(settings.max_allocation_per_trade) || 0,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      toast.success("Risk settings updated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save risk settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleSegment = (id: string) => {
    setSettings(prev => ({
      ...prev,
      preferred_markets: prev.preferred_markets.includes(id)
        ? prev.preferred_markets.filter(m => m !== id)
        : [...prev.preferred_markets, id]
    }));
  };

  const handleTradingToggle = async (checked: boolean) => {
    if (checked && !automationConsent) {
      toast.error("You must accept the automation disclaimer first.");
      return;
    }
    
    setSettings(prev => ({ ...prev, auto_trading_enabled: checked }));
    
    try {
      const response = await fetch("/api/trading/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });

      if (!response.ok) {
        setSettings(prev => ({ ...prev, auto_trading_enabled: !checked }));
        throw new Error("Failed to toggle automation");
      }

      toast.success(checked ? "Execution automation enabled" : "Execution automation disabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to toggle automation");
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
    <form onSubmit={handleSave} className="space-y-8">
      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-2">
            <h3 className="font-semibold text-amber-400">Execution Automation Disclaimer</h3>
            <p className="text-xs text-amber-300/70 leading-relaxed">
              This automation executes only user-defined rules. AiRA does not make trading decisions. 
              You are fully responsible for all automated actions and their outcomes. Past performance 
              does not guarantee future results.
            </p>
          </div>
        </div>
        
        <div className="flex items-start space-x-3 p-3 bg-black/20 rounded-lg">
          <Checkbox 
            id="automation-consent" 
            checked={automationConsent}
            onCheckedChange={(checked) => {
              setAutomationConsent(checked === true);
              if (!checked && settings.auto_trading_enabled) {
                handleTradingToggle(false);
              }
            }}
            className="mt-0.5 border-amber-400/30 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
          />
          <label htmlFor="automation-consent" className="text-xs text-white/70 leading-relaxed cursor-pointer">
            I understand that AiRA is a software platform only and does not provide investment or trading advice. 
            I accept full responsibility for all automated actions executed based on my configured rules.
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
        <div className="space-y-0.5">
          <Label className="text-base text-white">Execution Automation (User-Configured)</Label>
          <p className="text-xs text-white/40">Allow system to execute your configured rules automatically.</p>
        </div>
        <Switch 
          checked={settings.auto_trading_enabled}
          onCheckedChange={handleTradingToggle}
          disabled={!automationConsent}
        />
      </div>

      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-2">
        <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-300/80">
          All settings below are user-configured limits. The system will execute actions only within your defined parameters.
        </p>
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
            Daily Target Limit (₹)
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
            Max Allocation Per Position (%)
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
        Save Configuration
      </Button>
    </form>
  );
}
