"use client";

import { useState, useEffect } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight } from "lucide-react";

interface Trade {
  id: string;
  symbol: string;
  type: string;
  price: number;
  quantity: number;
  pnl: number;
  executed_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function TradingHistory() {
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });

  const loadTrades = async (page: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/user/trading-history?page=${page}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setTrades(data.trades || []);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error loading trades:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrades(1);
  }, []);

    if (loading && trades.length === 0) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/20" />
        </div>
      );
    }
  
    if (trades.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">No trading history found yet.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Trades executed by the AI will appear here.</p>
        </div>
      );
    }
  
    return (
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px]">Symbol</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px]">Type</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px]">Price</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px]">Qty</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px]">P&L</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px] text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => (
                <TableRow key={trade.id} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium text-foreground">{trade.symbol}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={trade.type === 'BUY' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}>
                      {trade.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">₹{trade.price}</TableCell>
                  <TableCell className="text-muted-foreground">{trade.quantity}</TableCell>
                  <TableCell>
                    <span className={`flex items-center gap-1 font-medium ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {trade.pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      ₹{Math.abs(trade.pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                    {new Date(trade.executed_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
  
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-2 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Showing {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 w-8 p-0 border-border hover:bg-muted"
                onClick={() => loadTrades(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 w-8 p-0 border-border hover:bg-muted"
                onClick={() => loadTrades(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
}
