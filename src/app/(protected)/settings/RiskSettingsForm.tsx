"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, Info, RotateCcw, FileText } from "lucide-react";
import { resetPaperBalance, togglePaperTrading } from "@/app/(protected)/dashboard/actions";

const SEGMENTS = [
  { id: "equity", label: "Equity Stocks", description: "Indices + NIFTY 500 & BSE 500 stocks (Unique companies, NSE preferred)" },
  { id: "indices_options", label: "Indices Options", description: "NIFTY, BANKNIFTY, FINNIFTY, SENSEX, BANKEX + 20 CE & 20 PE strikes near ATM" },
  { id: "futures", label: "Futures", description: "Index futures + NSE & BSE stock futures (NIFTY 100 & BSE 100, NSE preferred)" },
  { id: "currency", label: "Currency", description: "USDINR, EURINR, GBPINR, JPYINR + options (20 CE & 20 PE per pair)" },
];

export function RiskSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingPaper, setResettingPaper] = useState(false);
  const [automationConsent, setAutomationConsent] = useState(false);
  const [paperTradingEnabled, setPaperTradingEnabled] = useState(false);
  const [counts, setCounts] = useState({
    equity: 0,
    indices_options: 0,
    futures: 0,
    currency: 0
  });
  const [settings, setSettings] = useState({
    auto_trading_enabled: false,
    preferred_markets: [] as string[],
    daily_profit_limit: "",
    daily_loss_limit: "",
    daily_pnl_realized: 0,
    daily_quota_hit_at: null as string | null,
    daily_quota_reason: null as string | null
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
              daily_pnl_realized: parseFloat(data.settings.daily_pnl_realized) || 0,
              daily_quota_hit_at: data.settings.daily_quota_hit_at,
              daily_quota_reason: data.settings.daily_quota_reason
            });
            setPaperTradingEnabled(data.settings.paper_trading_enabled || false);
            if (data.settings.auto_trading_enabled) {
              setAutomationConsent(true);
            }
          }
          if (data.counts) {
            setCounts(data.counts);
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

  const handlePaperTradingToggle = async (checked: boolean) => {
    setPaperTradingEnabled(checked);
    const result = await togglePaperTrading(checked);
    if (result.error) {
      setPaperTradingEnabled(!checked);
      toast.error(result.error);
    } else {
      toast.success(checked ? "Paper trading enabled" : "Paper trading disabled");
    }
  };

  const handleResetPaperBalance = async () => {
    if (!confirm("This will delete all paper orders, positions, and trade history. Your virtual balance will be reset to ₹10,00,000. Continue?")) {
      return;
    }
    setResettingPaper(true);
    const result = await resetPaperBalance();
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Paper balance reset to ₹10,00,000");
    }
    setResettingPaper(false);
  };

    if (loading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/20" />
        </div>
      );
    }
  
    return (
      <form onSubmit={handleSave} className="space-y-8">
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <h3 className="font-semibold text-amber-600">Execution Automation Disclaimer</h3>
              <p className="text-xs text-amber-600/70 leading-relaxed">
                This automation executes only user-defined rules. AiRA does not make trading decisions. 
                You are fully responsible for all automated actions and their outcomes. Past performance 
                does not guarantee future results.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
            <Checkbox 
              id="automation-consent" 
              checked={automationConsent}
              onCheckedChange={(checked) => {
                setAutomationConsent(checked === true);
                if (!checked && settings.auto_trading_enabled) {
                  handleTradingToggle(false);
                }
              }}
              className="mt-0.5 border-amber-500/30 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
            />
            <label htmlFor="automation-consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
              I understand that AiRA is a software platform only and does not provide investment or trading advice. 
              I accept full responsibility for all automated actions executed based on my configured rules.
            </label>
          </div>
        </div>
  
          <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
            <div className="space-y-0.5">
              <Label className="text-base text-foreground">Execution Automation (User-Configured)</Label>
              <p className="text-xs text-muted-foreground">Allow system to execute your configured rules automatically.</p>
            </div>
            <Switch 
              checked={settings.auto_trading_enabled}
              onCheckedChange={handleTradingToggle}
              disabled={!automationConsent}
            />
          </div>
  
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-500" />
                <div className="space-y-0.5">
                  <Label className="text-base text-foreground">Paper Trading Mode</Label>
                  <p className="text-xs text-muted-foreground">Practice with virtual ₹10,00,000 balance. No real money involved.</p>
                </div>
              </div>
              <Switch 
                checked={paperTradingEnabled}
                onCheckedChange={handlePaperTradingToggle}
              />
            </div>
            
            {paperTradingEnabled && (
              <div className="pt-3 border-t border-blue-500/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetPaperBalance}
                  disabled={resettingPaper}
                  className="border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                >
                  {resettingPaper ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4 mr-2" />
                  )}
                  Reset Paper Balance
                </Button>
                <p className="text-xs text-blue-600/50 mt-2">
                  Clears all paper orders, positions, and history. Resets virtual balance to ₹10,00,000.
                </p>
              </div>
            )}
          </div>
  
          <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-600/80">
              All settings below are user-configured limits. The system will execute actions only within your defined parameters.
            </p>
          </div>
  
          {/* Daily Quota Status */}
          <div className="p-4 bg-card border border-border rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Daily Quota Status</Label>
              {settings.daily_quota_hit_at && (
                <span className="px-2 py-0.5 bg-red-500/20 text-red-600 text-[10px] font-bold rounded uppercase border border-red-500/30">
                  Quota Hit
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Current Daily P&L</p>
                <p className={`text-lg font-mono font-bold ${settings.daily_pnl_realized >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{settings.daily_pnl_realized.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Status</p>
                <p className="text-xs text-foreground mt-1">
                  {settings.daily_quota_hit_at 
                    ? settings.daily_quota_reason || "Limits reached"
                    : "Trading active within limits"
                  }
                </p>
              </div>
            </div>
  
            {(parseFloat(settings.daily_profit_limit) > 0 || parseFloat(settings.daily_loss_limit) > 0) && (
              <div className="space-y-3 pt-2">
                {parseFloat(settings.daily_profit_limit) > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] uppercase font-bold">
                      <span className="text-muted-foreground">Profit Target Progress</span>
                      <span className="text-green-600">₹{settings.daily_profit_limit}</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 transition-all duration-500"
                        style={{ 
                          width: `${Math.min(100, Math.max(0, (settings.daily_pnl_realized / parseFloat(settings.daily_profit_limit)) * 100))}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
                {parseFloat(settings.daily_loss_limit) > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] uppercase font-bold">
                      <span className="text-muted-foreground">Stop Loss Progress</span>
                      <span className="text-red-600">₹{settings.daily_loss_limit}</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 transition-all duration-500"
                        style={{ 
                          width: `${Math.min(100, Math.max(0, (Math.abs(Math.min(0, settings.daily_pnl_realized)) / parseFloat(settings.daily_loss_limit)) * 100))}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
  
            <div className="space-y-4">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Market Segments for AI to Scan & Trade</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SEGMENTS.map((segment) => {
                const count = counts[segment.id as keyof typeof counts] || 0;
                return (
                  <div key={segment.id} className="flex items-start space-x-3 p-4 bg-muted/30 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => toggleSegment(segment.id)}>
                    <Checkbox 
                      id={segment.id} 
                      checked={settings.preferred_markets.includes(segment.id)}
                      onCheckedChange={() => toggleSegment(segment.id)}
                      className="mt-0.5 border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                    <div className="flex flex-col gap-1">
                      <label htmlFor={segment.id} className="text-sm font-medium text-foreground cursor-pointer">{segment.label}</label>
                      <span className="text-[10px] text-muted-foreground">{segment.description}</span>
                      <span className="text-xs text-emerald-600 font-mono font-bold">{count.toLocaleString()} instruments</span>
                    </div>
                  </div>
                );
              })}
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
                className="bg-background border-border"
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
                className="bg-background border-border"
              />
            </div>
          </div>
  
        <Button 
          type="submit" 
          disabled={saving}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Configuration
        </Button>
      </form>
    );
}
