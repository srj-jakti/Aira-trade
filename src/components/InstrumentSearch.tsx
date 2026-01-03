"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2, TrendingUp, Building2, Globe, Coins, Factory } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface Instrument {
  instrument_token: number;
  tradingsymbol: string;
  name: string | null;
  exchange: string;
  segment: string | null;
  instrument_type: string | null;
  lot_size: number;
  tick_size: number;
  expiry?: string | null;
  strike?: number | null;
}

interface InstrumentSearchProps {
  onSelect: (instrument: Instrument) => void;
  selectedInstrument?: Instrument | null;
  placeholder?: string;
  className?: string;
}

function getSegmentIcon(segment: string | null, exchange: string) {
  const seg = segment?.toLowerCase() || "";
  if (seg === "indices") return <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />;
  if (seg.includes("nfo") || seg.includes("bfo")) return <Coins className="w-3.5 h-3.5 text-purple-400" />;
  if (seg.includes("cds")) return <Globe className="w-3.5 h-3.5 text-cyan-400" />;
  if (exchange === "MCX") return <Factory className="w-3.5 h-3.5 text-orange-400" />;
  return <Building2 className="w-3.5 h-3.5 text-blue-400" />;
}

function getSegmentLabel(segment: string | null, exchange: string, instrumentType: string | null) {
  const seg = segment?.toLowerCase() || "";
  if (seg === "indices") return "INDEX";
  if (seg.includes("nfo-opt") || seg.includes("bfo-opt")) return instrumentType === "CE" ? "CALL" : instrumentType === "PE" ? "PUT" : "OPT";
  if (seg.includes("nfo-fut") || seg.includes("bfo-fut") || seg.includes("mcx-fut")) return "FUT";
  if (seg.includes("cds")) return "CURRENCY";
  if (exchange === "MCX") return "COMMODITY";
  if (exchange === "NSE" || exchange === "BSE") return "EQUITY";
  return exchange;
}

function getSegmentColor(segment: string | null, exchange: string) {
  const seg = segment?.toLowerCase() || "";
  if (seg === "indices") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  if (seg.includes("nfo-opt") || seg.includes("bfo-opt")) return "bg-purple-500/20 text-purple-400 border-purple-500/30";
  if (seg.includes("nfo-fut") || seg.includes("bfo-fut")) return "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
  if (seg.includes("cds")) return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
  if (exchange === "MCX") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  if (exchange === "NSE") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (exchange === "BSE") return "bg-red-500/20 text-red-400 border-red-500/30";
  return "bg-white/10 text-white/60 border-white/20";
}

function formatExpiry(expiry: string | null) {
  if (!expiry) return null;
  const date = new Date(expiry);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function InstrumentSearch({
  onSelect,
  selectedInstrument,
  placeholder = "Search (e.g. NIFTY 50, RELIANCE, NIFTY 26000 CE, USDINR)...",
  className,
}: InstrumentSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Instrument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

      debounceRef.current = setTimeout(async () => {
        setIsLoading(true);
        try {
          const response = await fetch(`/api/market-data/instruments?search=${encodeURIComponent(query)}&limit=50`);
          if (response.ok) {
            const data = await response.json();
            setResults(data.instruments || []);
            setIsOpen(true);
          }
        } catch (error) {
          console.error("Search error:", error);
        } finally {
          setIsLoading(false);
        }
      }, 250);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const handleSelect = (instrument: Instrument) => {
    onSelect(instrument);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    onSelect(null as unknown as Instrument);
  };

  const groupedResults = results.reduce((acc, instrument) => {
    const seg = instrument.segment?.toLowerCase() || "";
    const type = instrument.instrument_type;
    let group = "Other";
    
    if (seg === "indices") group = "Indices";
    else if (instrument.exchange === "NSE" && seg === "nse" && type === "EQ") group = "NSE Equity";
    else if (instrument.exchange === "BSE" && seg === "bse" && type === "EQ") group = "BSE Equity";
    else if (seg.includes("nfo-fut") || seg.includes("bfo-fut") || seg.includes("mcx-fut")) group = "Futures";
    else if (seg.includes("nfo-opt") || seg.includes("bfo-opt") || type === "CE" || type === "PE") group = "Options (F&O)";
    else if (seg.includes("cds")) group = "Currency";
    else if (instrument.exchange === "MCX") group = "Commodities";
    
    if (!acc[group]) acc[group] = [];
    acc[group].push(instrument);
    return acc;
  }, {} as Record<string, Instrument[]>);

  const groupOrder = ["Indices", "NSE Equity", "BSE Equity", "Futures", "Options (F&O)", "Currency", "Commodities", "Other"];
  const sortedGroups = Object.entries(groupedResults).sort(
    (a, b) => groupOrder.indexOf(a[0]) - groupOrder.indexOf(b[0])
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <Input
          value={selectedInstrument ? `${selectedInstrument.tradingsymbol} - ${selectedInstrument.name || selectedInstrument.exchange}` : query}
          onChange={(e) => {
            if (selectedInstrument) {
              onSelect(null as unknown as Instrument);
            }
            setQuery(e.target.value);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="pl-10 pr-10 bg-white/5 border-white/10 h-10 md:h-12 text-white placeholder:text-white/30 text-sm md:text-base"
        />
        {(query || selectedInstrument) && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl max-h-[400px] overflow-y-auto">
          {sortedGroups.map(([group, instruments]) => (
            <div key={group}>
              <div className="sticky top-0 px-3 py-1.5 text-xs font-semibold text-white/40 bg-zinc-900/95 backdrop-blur-md border-b border-white/5 uppercase tracking-wider">
                {group}
              </div>
              {instruments.map((instrument) => (
                <button
                  key={instrument.instrument_token}
                  onClick={() => handleSelect(instrument)}
                  className="w-full px-3 py-2.5 text-left hover:bg-white/5 flex items-center gap-3 border-b border-white/5 last:border-0 transition-colors"
                >
                  {getSegmentIcon(instrument.segment, instrument.exchange)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">{instrument.tradingsymbol}</span>
                      {instrument.strike && (
                        <span className="text-xs text-white/40">@{instrument.strike}</span>
                      )}
                    </div>
                    <div className="text-xs text-white/40 truncate">
                      {instrument.name || "—"}
                      {instrument.expiry && (
                        <span className="ml-1.5 text-white/30">Exp: {formatExpiry(instrument.expiry)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded border",
                      getSegmentColor(instrument.segment, instrument.exchange)
                    )}>
                      {getSegmentLabel(instrument.segment, instrument.exchange, instrument.instrument_type)}
                    </span>
                    <span className="text-[10px] text-white/30">{instrument.exchange}</span>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {isOpen && results.length === 0 && query.length >= 2 && !isLoading && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl p-4 text-center text-white/50 text-sm">
          No instruments found for "{query}"
        </div>
      )}
    </div>
  );
}
