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
    segments: ["NSE", "NFO"],
    scanInterval: "5" // Default 5 minutes
  });

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Load existing settings from the dedicated scanner settings API
        const response = await fetch('/api/scanner/settings');
        const data = await response.json();
        
        if (data.success && data.config) {
          setConfig({
            segments: data.config.segments || ["NSE", "NFO"],
            scanInterval: data.config.scanInterval || "5"
          });
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
          <div className="space-y-2">
            <Label htmlFor="segments" className="text-white text-sm font-medium">Trading Segments to Scan</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {["NSE", "NFO", "CDS", "MCX"].map(segment => (
                <Button
                  key={segment}
                  type="button"
                  variant={config.segments.includes(segment) ? "default" : "outline"}
                  size="sm"
                  className={`text-xs h-8 px-4 ${config.segments.includes(segment) ? 'bg-white text-black hover:bg-white/90' : 'bg-transparent border-white/10 hover:bg-white/5'}`}
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
            <p className="text-[10px] text-white/40 pt-1">The AI will identify opportunities in these markets.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scanInterval" className="text-white text-sm font-medium">Scan Interval</Label>
            <Select 
              value={config.scanInterval} 
              onValueChange={(val) => setConfig(prev => ({ ...prev, scanInterval: val }))}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                <SelectItem value="1">1 Minute</SelectItem>
                <SelectItem value="5">5 Minutes</SelectItem>
                <SelectItem value="15">15 Minutes</SelectItem>
                <SelectItem value="30">30 Minutes</SelectItem>
                <SelectItem value="60">1 Hour</SelectItem>
                <SelectItem value="strategy">Strategy Timeframe</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-white/40 pt-1">Frequency at which the scanner evaluates market conditions.</p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/10 flex gap-3 items-start">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-200/60 leading-relaxed">
          The scanner runs based on all your <strong>Active Strategies</strong>. 
          It will automatically use your account's daily profit/loss limits and risk settings configured in general settings.
        </p>
      </div>

      <Button 
        type="submit" 
        disabled={saving}
        className="w-full bg-white text-black hover:bg-white/90 font-bold h-11"
      >
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Save Scanner Configuration
      </Button>
    </form>
  );
}
