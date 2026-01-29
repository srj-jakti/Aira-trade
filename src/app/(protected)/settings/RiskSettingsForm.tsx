"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Loader2, ShieldAlert, Save } from "lucide-react";
import { toast } from "sonner";

export function RiskSettingsForm() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [maxCapital, setMaxCapital] = useState(100000);
  const [dailyLossLimit, setDailyLossLimit] = useState(5000);
  const [dailyProfitTarget, setDailyProfitTarget] = useState(10000);
  const [maxPositions, setMaxPositions] = useState(5);
  const [killSwitchEnabled, setKillSwitchEnabled] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchRiskProfile();
  }, []);

  const fetchRiskProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_risk_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching risk profile:", error);
      }

      if (data) {
        setEnabled(data.is_active);
        setMaxCapital(data.max_capital_per_trade || 100000);
        setDailyLossLimit(data.daily_loss_limit || 5000);
        setDailyProfitTarget(data.daily_profit_target || 10000);
        setMaxPositions(data.max_open_positions || 5);
        setKillSwitchEnabled(data.kill_switch_enabled);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const updates = {
        user_id: user.id,
        is_active: enabled,
        max_capital_per_trade: maxCapital,
        daily_loss_limit: dailyLossLimit,
        daily_profit_target: dailyProfitTarget,
        max_open_positions: maxPositions,
        kill_switch_enabled: killSwitchEnabled,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("user_risk_profiles")
        .upsert(updates);

      if (error) throw error;
      toast.success("Risk profile updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update risk profile");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card className="border-red-500/20 bg-red-500/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-500" />
          <CardTitle>Risk Management Profile</CardTitle>
        </div>
        <CardDescription>
          Configure your autonomous risk guardrails. The "Sentry" worker will enforce these limits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
          <div className="space-y-0.5">
            <Label className="text-base">Enable Sentry Mode</Label>
            <p className="text-sm text-muted-foreground">
              Automatically monitor and close positions if limits are breached.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Daily Loss Limit (₹)</Label>
            <Input 
              type="number" 
              value={dailyLossLimit} 
              onChange={(e) => setDailyLossLimit(Number(e.target.value))} 
            />
            <p className="text-xs text-muted-foreground">Stop trading if daily loss exceeds this amount.</p>
          </div>

          <div className="space-y-2">
            <Label>Daily Profit Target (₹)</Label>
            <Input 
              type="number" 
              value={dailyProfitTarget} 
              onChange={(e) => setDailyProfitTarget(Number(e.target.value))} 
            />
            <p className="text-xs text-muted-foreground">Lock profits if daily gain exceeds this amount.</p>
          </div>

          <div className="space-y-2">
            <Label>Max Capital Per Trade (₹)</Label>
            <Input 
              type="number" 
              value={maxCapital} 
              onChange={(e) => setMaxCapital(Number(e.target.value))} 
            />
          </div>

          <div className="space-y-2">
            <Label>Max Open Positions</Label>
            <Input 
              type="number" 
              value={maxPositions} 
              onChange={(e) => setMaxPositions(Number(e.target.value))} 
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border border-red-500/20 rounded-lg bg-red-500/10">
          <div className="space-y-0.5">
            <Label className="text-base text-red-400">Kill Switch</Label>
            <p className="text-sm text-red-300/70">
              Force close all positions immediately when loss limit is hit.
            </p>
          </div>
          <Switch checked={killSwitchEnabled} onCheckedChange={setKillSwitchEnabled} />
        </div>

        <Button onClick={handleSave} disabled={loading} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Risk Profile
        </Button>
      </CardContent>
    </Card>
  );
}
