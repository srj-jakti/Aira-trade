"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";

export function TradingHistory() {
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function loadTrades() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("trade_history")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(10);

          setTrades(data || []);
        }
      } catch (error) {
        console.error("Error loading trades:", error);
      } finally {
        setLoading(false);
      }
    }
    loadTrades();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-white/20" />
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white/40 text-sm">No trading history found yet.</p>
        <p className="text-white/20 text-xs mt-1">Trades executed by the AI will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/5 hover:bg-transparent">
            <TableHead className="text-white/40 font-bold uppercase text-[10px]">Symbol</TableHead>
            <TableHead className="text-white/40 font-bold uppercase text-[10px]">Type</TableHead>
            <TableHead className="text-white/40 font-bold uppercase text-[10px]">Price</TableHead>
            <TableHead className="text-white/40 font-bold uppercase text-[10px]">Qty</TableHead>
            <TableHead className="text-white/40 font-bold uppercase text-[10px]">P&L</TableHead>
            <TableHead className="text-white/40 font-bold uppercase text-[10px] text-right">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => (
            <TableRow key={trade.id} className="border-white/5 hover:bg-white/[0.02]">
              <TableCell className="font-medium text-white">{trade.symbol}</TableCell>
              <TableCell>
                <Badge variant="outline" className={trade.type === 'BUY' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}>
                  {trade.type}
                </Badge>
              </TableCell>
              <TableCell className="text-white/60">₹{trade.price}</TableCell>
              <TableCell className="text-white/60">{trade.quantity}</TableCell>
              <TableCell>
                <span className={`flex items-center gap-1 ${trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {trade.pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  ₹{Math.abs(trade.pnl)}
                </span>
              </TableCell>
              <TableCell className="text-right text-white/40 text-xs">
                {new Date(trade.created_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
