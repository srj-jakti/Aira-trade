"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
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

function getSegmentLabel(segment: string | null, exchange: string, instrumentType: string | null) {
  const seg = segment?.toLowerCase() || "";
  if (seg === "indices") return "INDEX";
  if (seg.includes("opt")) return instrumentType || "OPT";
  if (seg.includes("fut")) return "FUT";
  if (exchange === "NSE" || exchange === "BSE") return "EQ";
  return exchange;
}

function getLabelColor(segment: string | null, exchange: string, instrumentType: string | null) {
  const seg = segment?.toLowerCase() || "";
  if (seg === "indices") return "text-yellow-500 bg-yellow-500/10";
  if (instrumentType === "CE") return "text-green-500 bg-green-500/10";
  if (instrumentType === "PE") return "text-red-500 bg-red-500/10";
  if (seg.includes("fut")) return "text-blue-500 bg-blue-500/10";
  return "text-zinc-400 bg-zinc-800";
}

function formatExpiry(expiry: string | null) {
  if (!expiry) return null;
  const date = new Date(expiry);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toUpperCase();
}

function HighlightedText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight.trim()) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${highlight})`, "gi"));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span key={i} className="text-orange-500 font-bold">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export function InstrumentSearch({
  onSelect,
  selectedInstrument,
  placeholder = "Search (e.g. NIFTY 50, RELIANCE, NIFTY 26000 CE)...",
  className,
}: InstrumentSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Instrument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    }, 200);

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

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input
          value={selectedInstrument ? selectedInstrument.tradingsymbol : query}
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
          className="pl-10 pr-10 bg-zinc-900 border-zinc-800 h-11 text-zinc-100 placeholder:text-zinc-600 focus:ring-1 focus:ring-orange-500/20"
        />
        {(query || selectedInstrument) && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-zinc-950 border border-zinc-800 rounded shadow-2xl max-h-[440px] overflow-y-auto">
          {results.map((instrument) => {
            const label = getSegmentLabel(instrument.segment, instrument.exchange, instrument.instrument_type);
            const labelColor = getLabelColor(instrument.segment, instrument.exchange, instrument.instrument_type);
            const expiry = formatExpiry(instrument.expiry || null);

            return (
              <button
                key={instrument.instrument_token}
                onClick={() => handleSelect(instrument)}
                className="w-full px-4 py-3 text-left hover:bg-zinc-900 flex items-center justify-between border-b border-zinc-900 last:border-0 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-zinc-100 text-sm tracking-tight">
                      <HighlightedText text={instrument.tradingsymbol} highlight={query} />
                    </span>
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", labelColor)}>
                      {label}
                    </span>
                    {expiry && (
                      <span className="text-[10px] text-zinc-500 font-medium">{expiry}</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 truncate font-medium">
                    <HighlightedText text={instrument.name || instrument.tradingsymbol} highlight={query} />
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className={cn(
                    "text-[10px] font-bold tracking-widest",
                    instrument.exchange === "NSE" ? "text-blue-500/60" : "text-red-500/60"
                  )}>
                    {instrument.exchange}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {isOpen && results.length === 0 && query.length >= 2 && !isLoading && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-zinc-950 border border-zinc-800 rounded shadow-xl p-4 text-center text-zinc-500 text-sm">
          No matches found for "<span className="text-zinc-300">{query}</span>"
        </div>
      )}
    </div>
  );
}
