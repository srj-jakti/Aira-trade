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
}

interface InstrumentSearchProps {
  onSelect: (instrument: Instrument) => void;
  selectedInstrument?: Instrument | null;
  placeholder?: string;
  className?: string;
}

export function InstrumentSearch({
  onSelect,
  selectedInstrument,
  placeholder = "Search instrument (e.g. NIFTY 50, RELIANCE)...",
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
        const response = await fetch(`/api/market-data/instruments?search=${encodeURIComponent(query)}&limit=20`);
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
    }, 300);

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
  };

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
          className="pl-10 pr-10 bg-white/5 border-white/10 h-10 md:h-12 text-white placeholder:text-white/20"
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
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-zinc-900 border border-white/10 rounded-lg shadow-xl max-h-[300px] overflow-y-auto">
          {results.map((instrument) => (
            <button
              key={instrument.instrument_token}
              onClick={() => handleSelect(instrument)}
              className="w-full px-4 py-3 text-left hover:bg-white/5 flex items-center justify-between border-b border-white/5 last:border-0"
            >
              <div>
                <div className="font-medium text-white">{instrument.tradingsymbol}</div>
                <div className="text-xs text-white/50">{instrument.name || "—"}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-blue-400">{instrument.exchange}</div>
                <div className="text-xs text-white/40">{instrument.segment}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && results.length === 0 && query.length >= 2 && !isLoading && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-zinc-900 border border-white/10 rounded-lg shadow-xl p-4 text-center text-white/50 text-sm">
          No instruments found for "{query}"
        </div>
      )}
    </div>
  );
}
