"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateZairothV2 = validateZairothV2;
const validator_1 = require("../validator");
function validateZairothV2(instructions) {
    // Use v1 validation as base
    const result = (0, validator_1.validateZairothSafe)(instructions);
    // Add v2 specific validation
    instructions.forEach((inst, index) => {
        if (inst.condition) {
            // Rule: WHEN conditions must not be empty
            if (inst.condition.trim() === '') {
                result.valid = false;
                result.errors.push({
                    line: index + 1,
                    code: 'EMPTY_CONDITION',
                    message: 'ZAIROTH v2.0: WHEN condition cannot be empty'
                });
            }
            // Rule: WHEN conditions must not exceed 200 chars (safety limit)
            if (inst.condition.length > 200) {
                result.valid = false;
                result.errors.push({
                    line: index + 1,
                    code: 'CONDITION_TOO_LONG',
                    message: 'ZAIROTH v2.0: WHEN condition is too complex'
                });
            }
        }
        // Rule: v2 opt-in check (already handled by parser choosing this function)
        if (inst.version !== '2.0') {
            result.warnings.push({
                line: index + 1,
                message: 'Instruction is not v2 compatible'
            });
        }
    });
    return result;
}
//# sourceMappingURL=validator.js.map