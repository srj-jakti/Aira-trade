"use client";

import { useState, useMemo } from "react";
import { Search, X, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TRADING_TOOLS,
  TOOL_CATEGORIES,
  TradingTool,
  ToolCategory,
  searchTools,
  getToolsByCategory,
} from "@/lib/trading-tools";

interface TradingToolboxProps {
  onInsertTool: (tool: TradingTool) => void;
  className?: string;
}

export function TradingToolbox({ onInsertTool, className }: TradingToolboxProps) {
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<ToolCategory>>(
    new Set(["trend", "momentum"])
  );

  const filteredTools = useMemo(() => {
    if (search.trim()) {
      return searchTools(search);
    }
    return null;
  }, [search]);

  const toggleCategory = (category: ToolCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const renderTool = (tool: TradingTool) => (
    <TooltipProvider key={tool.id}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onInsertTool(tool)}
            className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-700/50 transition-colors group flex items-center justify-between"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-mono text-xs bg-cyan-500/10 px-1.5 py-0.5 rounded">
                  {tool.shortName}
                </span>
                <span className="text-sm text-slate-300 truncate">{tool.name}</span>
              </div>
            </div>
            <Plus className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs bg-popover border-border">
          <div className="space-y-2">
            <p className="font-medium text-foreground">{tool.name}</p>
            <p className="text-xs text-muted-foreground">{tool.description}</p>
            <div className="text-xs space-y-1">
              <p className="text-green-400">Bullish: {tool.signals.bullish}</p>
              <p className="text-red-400">Bearish: {tool.signals.bearish}</p>
            </div>
            {tool.parameters.length > 0 && (
              <div className="text-xs text-slate-500">
                Params: {tool.parameters.map((p) => p.name).join(", ")}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className={`bg-card border border-border rounded-lg overflow-hidden ${className}`}>
      <div className="p-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground mb-2">Trading Toolbox</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search indicators, patterns..."
            className="pl-8 pr-8 h-8 text-sm bg-background/50 border-input"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1">{TRADING_TOOLS.length} tools available</p>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="p-2">
          {filteredTools ? (
            <div className="space-y-1">
              {filteredTools.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No tools found</p>
              ) : (
                filteredTools.map(renderTool)
              )}
            </div>
          ) : (
            Object.entries(TOOL_CATEGORIES).map(([categoryId, category]) => {
              const tools = getToolsByCategory(categoryId as ToolCategory);
              const isExpanded = expandedCategories.has(categoryId as ToolCategory);

              return (
                <Collapsible
                  key={categoryId}
                  open={isExpanded}
                  onOpenChange={() => toggleCategory(categoryId as ToolCategory)}
                >
                  <CollapsibleTrigger className="w-full flex items-center justify-between px-2 py-2 hover:bg-accent rounded-md transition-colors">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium text-foreground">
                        {category.name}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">
                      {tools.length}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-2 pl-2 border-l border-slate-700 space-y-0.5 py-1">
                      {tools.map(renderTool)}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
