"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileZairoth = compileZairoth;
function compileZairoth(instructions) {
    return instructions.map(inst => {
        let state;
        switch (inst.state) {
            case 'RA':
                state = 'fact';
                break;
            case 'NA':
                state = 'active';
                break;
            case 'VA':
                state = 'intent';
                break;
            case 'XA':
                state = 'prohibited';
                break;
        }
        // Map action and object to canonical format
        // Example: VA trade-buy Lun NIFTY tf-5m risk-low••
        // results in:
        // {
        //   "state": "intent",
        //   "action": "trade_buy",
        //   "market": "NIFTY",
        //   "timeframe": "5m",
        //   "risk": "low",
        //   "confidence": 0.8
        // }
        const canonical = {
            state,
            action: inst.intent.replace('-', '_'),
            confidence: inst.certainty,
            params: { ...inst.context },
            raw: inst.raw
        };
        // Extract common fields from context or object
        if (inst.object && inst.object !== 'none') {
            // In some cases object is the market
            if (['NIFTY', 'BANKNIFTY', 'FINNIFTY'].includes(inst.object.toUpperCase())) {
                canonical.market = inst.object.toUpperCase();
            }
            else {
                canonical.params.object = inst.object;
            }
        }
        if (inst.context.tf)
            canonical.timeframe = inst.context.tf;
        if (inst.context.risk)
            canonical.risk = inst.context.risk;
        // Cleanup params if they were moved to top level
        delete canonical.params.tf;
        delete canonical.params.risk;
        return canonical;
    });
}
//# sourceMappingURL=compiler.js.map