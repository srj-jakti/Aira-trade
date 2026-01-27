import { StrategyRule } from "@/lib/types/strategy";

export function formatStrategyRule(rule: any): string {
  if (!rule) return "Unknown rule";
  
  // If it's already a string, just return it
  if (typeof rule === "string") return rule;

  // Handle StrategyRule objects
  switch (rule.type) {
    case "indicator":
      return `${rule.name}${rule.period ? `(${rule.period})` : ""} ${rule.operator} ${rule.value}`;
    
    case "price_vs_indicator":
      return `${rule.priceField} ${rule.operator} ${rule.indicator}${rule.indicatorPeriod ? `(${rule.indicatorPeriod})` : ""}`;
    
    case "indicator_vs_indicator":
      return `${rule.indicator1}${rule.period1 ? `(${rule.period1})` : ""} ${rule.operator} ${rule.indicator2}${rule.period2 ? `(${rule.period2})` : ""}`;
    
    case "trend":
      if (rule.indicator === "SUPERTREND") {
        return `Supertrend is ${rule.direction || "BULLISH"}`;
      }
      return `ADX ${rule.direction === "BULLISH" ? ">" : "<"} ${rule.threshold || 25}`;
    
    case "pattern":
      return `Pattern: ${rule.pattern}`;
    
    case "price_action":
      return `Price Action: ${rule.action.replace(/_/g, " ")}`;
    
    case "volume":
      if (rule.compareToAverage) {
        return `Volume ${rule.operator} ${rule.averagePeriod || 20}-period average`;
      }
      return `Volume ${rule.operator} ${rule.value}`;
    
    default:
      // Fallback for unexpected object structure
      if (rule.indicator && rule.operator && rule.value !== undefined) {
        return `${rule.indicator} ${rule.operator} ${rule.value}`;
      }
      return JSON.stringify(rule);
  }
}
