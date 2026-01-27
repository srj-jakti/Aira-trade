"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseZairothV2 = parseZairothV2;
const errors_1 = require("../errors");
function parseZairothV2(input) {
    const lines = input.split('\n').filter(line => line.trim() !== '');
    return lines.map((line, index) => {
        const trimmed = line.trim();
        // Check if it's a v2 WHEN/THEN line
        if (trimmed.toUpperCase().startsWith('WHEN ') && trimmed.toUpperCase().includes(' THEN ')) {
            const thenIndex = trimmed.toUpperCase().indexOf(' THEN ');
            const condition = trimmed.slice(5, thenIndex).trim();
            const actionPart = trimmed.slice(thenIndex + 6).trim();
            const parts = actionPart.split(/\s+/);
            if (parts.length < 5) {
                throw new errors_1.ZairothError(errors_1.ZairothErrorCode.INVALID_STRUCTURE, 'ZAIROTH v2.0: THEN part must have at least STATE, INTENT, ACTION, OBJECT, and CERTAINTY', index + 1);
            }
            const stateStr = parts[0];
            const certaintyStr = parts[parts.length - 1];
            if (!['RA', 'NA', 'VA', 'XA'].includes(stateStr)) {
                throw new errors_1.ZairothError(errors_1.ZairothErrorCode.MISSING_STATE, `ZAIROTH v2.0: Invalid state marker in THEN part: ${stateStr}`, index + 1);
            }
            let certainty;
            if (certaintyStr === '•••')
                certainty = 1.0;
            else if (certaintyStr === '••')
                certainty = 0.8;
            else if (certaintyStr === '•')
                certainty = 0.3;
            else {
                throw new errors_1.ZairothError(errors_1.ZairothErrorCode.MISSING_CERTAINTY, `ZAIROTH v2.0: Invalid certainty marker: ${certaintyStr}`, index + 1);
            }
            const intent = parts[1];
            const action = parts[2];
            const object = parts[3];
            const contextParts = parts.slice(4, parts.length - 1);
            const context = {};
            contextParts.forEach(part => {
                if (part.includes(':')) {
                    const [key, value] = part.split(':');
                    context[key] = value;
                }
                else if (part.includes('-')) {
                    const [key, value] = part.split('-');
                    context[key] = value;
                }
                else {
                    context[part] = 'true';
                }
            });
            return {
                state: stateStr,
                intent,
                action,
                object,
                context,
                certainty,
                raw: trimmed,
                condition,
                version: '2.0'
            };
        }
        else {
            // Fallback to v1 parsing but wrap it in v2 structure
            const parts = trimmed.split(/\s+/);
            if (parts.length < 5) {
                throw new errors_1.ZairothError(errors_1.ZairothErrorCode.INVALID_STRUCTURE, 'ZAIROTH v1.0 fallback: Instruction must have 5+ parts', index + 1);
            }
            const stateStr = parts[0];
            const certaintyStr = parts[parts.length - 1];
            if (!['RA', 'NA', 'VA', 'XA'].includes(stateStr)) {
                throw new errors_1.ZairothError(errors_1.ZairothErrorCode.MISSING_STATE, `Invalid state marker: ${stateStr}`, index + 1);
            }
            let certainty;
            if (certaintyStr === '•••')
                certainty = 1.0;
            else if (certaintyStr === '••')
                certainty = 0.8;
            else if (certaintyStr === '•')
                certainty = 0.3;
            else {
                throw new errors_1.ZairothError(errors_1.ZairothErrorCode.MISSING_CERTAINTY, `Invalid certainty marker: ${certaintyStr}`, index + 1);
            }
            return {
                state: stateStr,
                intent: parts[1],
                action: parts[2],
                object: parts[3],
                context: {}, // Simplified for fallback
                certainty,
                raw: trimmed,
                version: '2.0'
            };
        }
    });
}
//# sourceMappingURL=parser.js.map