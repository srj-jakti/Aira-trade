"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, AlertCircle, Info } from "lucide-react";

interface Strategy {
  id: string;
  name: string;
  is_active: boolean;
}

export function ScannerSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [config, setConfig] = useState({
    selectedStrategies: [] as string[],
    dailyProfitTarget: 5000,
    dailyLossLimit: 2000,
    segments: ["NSE", "NFO"],
    orderType: "MIS",
    slicingEnabled: true,
    maxSlicingQuantity: 100
  });

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Load active strategies
        const { data: strategiesData } = await supabase
          .from("strategies")
          .select("id, name, is_active")
          .eq("is_active", true);
        
        setStrategies(strategiesData || []);

        // Load existing settings from the dedicated scanner settings API
        const response = await fetch('/api/scanner/settings');
        const data = await response.json();
        
        if (data.success && data.config) {
          setConfig(prev => ({
            ...prev,
            ...data.config
          }));
        }
      } catch (error) {
        console.error("Error loading scanner settings:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const response = await fetch('/api/scanner/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success("Scanner settings saved");
      } else {
        toast.error(data.error || "Failed to save settings");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const toggleStrategy = (id: string) => {
    setConfig(prev => ({
      ...prev,
      selectedStrategies: prev.selectedStrategies.includes(id)
        ? prev.selectedStrategies.filter(s => s !== id)
        : [...prev.selectedStrategies, id]
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
    <form onSubmit={handleSave} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <Label className="text-white text-sm font-medium mb-3 block">Active Strategies to Scan</Label>
            {strategies.length === 0 ? (
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex gap-3 items-start">
                <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-xs text-yellow-200/80">
                  No active strategies found. Please activate strategies in the Strategy page first.
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {strategies.map((strategy) => (
                  <div key={strategy.id} className="flex items-center space-x-2 bg-white/5 p-2 rounded-md border border-white/5 hover:border-white/10 transition-colors">
                    <Checkbox 
                      id={`strategy-${strategy.id}`} 
                      checked={config.selectedStrategies.includes(strategy.id)}
                      onCheckedChange={() => toggleStrategy(strategy.id)}
                    />
                    <label 
                      htmlFor={`strategy-${strategy.id}`}
                      className="text-sm text-white/80 cursor-pointer flex-1"
                    >
                      {strategy.name}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="segments">Trading Segments</Label>
            <div className="flex flex-wrap gap-2">
              {["NSE", "NFO", "CDS", "MCX"].map(segment => (
                <Button
                  key={segment}
                  type="button"
                  variant={config.segments.includes(segment) ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    const newSegments = config.segments.includes(segment)
                      ? config.segments.filter(s => s !== segment)
                      : [...config.segments, segment];
                    setConfig(prev => ({ ...prev, segments: newSegments }));
                  }}
                >
                  {segment}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profit">Daily Profit Target (₹)</Label>
              <Input 
                id="profit" 
                type="number"
                value={config.dailyProfitTarget}
                onChange={(e) => setConfig(prev => ({ ...prev, dailyProfitTarget: Number(e.target.value) }))}
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loss">Daily Loss Limit (₹)</Label>
              <Input 
                id="loss" 
                type="number"
                value={config.dailyLossLimit}
                onChange={(e) => setConfig(prev => ({ ...prev, dailyLossLimit: Number(e.target.value) }))}
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="orderType">Order Type</Label>
            <Select 
              value={config.orderType} 
              onValueChange={(val) => setConfig(prev => ({ ...prev, orderType: val }))}
            >
              <SelectTrigger className="bg-white/5 border-white/10">
                <SelectValue placeholder="Select order type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MIS">MIS (Intraday)</SelectItem>
                <SelectItem value="CNC">CNC (Delivery)</SelectItem>
                <SelectItem value="NRML">NRML (Normal)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-white">Iceberg Order Slicing</Label>
                <p className="text-[10px] text-white/40">Slice large orders into smaller chunks.</p>
              </div>
              <Checkbox 
                checked={config.slicingEnabled}
                onCheckedChange={(val) => setConfig(prev => ({ ...prev, slicingEnabled: !!val }))}
              />
            </div>
            
            {config.slicingEnabled && (
              <div className="space-y-2 pl-4 border-l border-white/10">
                <Label htmlFor="sliceQty" className="text-xs">Max Slice Quantity</Label>
                <Input 
                  id="sliceQty" 
                  type="number"
                  value={config.maxSlicingQuantity}
                  onChange={(e) => setConfig(prev => ({ ...prev, maxSlicingQuantity: Number(e.target.value) }))}
                  className="bg-white/5 border-white/10 h-8 text-xs"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/10 flex gap-3 items-start">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-200/60 leading-relaxed">
          The AI Scanner will automatically execute trades based on these settings when active. 
          Make sure your Zerodha account has sufficient balance and your API keys are valid.
        </p>
      </div>

      <Button 
        type="submit" 
        disabled={saving}
        className="w-full bg-white text-black hover:bg-white/90 font-bold"
      >
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Save Scanner Configuration
      </Button>
    </form>
  );
}
