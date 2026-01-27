"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processZairoth = processZairoth;
exports.processZairothSafe = processZairothSafe;
exports.evaluateSafety = evaluateSafety;
const parser_1 = require("./parser");
const validator_1 = require("./validator");
const compiler_1 = require("./compiler");
const errors_1 = require("./errors");
const v2_1 = require("./v2");
__exportStar(require("./parser"), exports);
__exportStar(require("./validator"), exports);
__exportStar(require("./compiler"), exports);
__exportStar(require("./errors"), exports);
__exportStar(require("./v2"), exports);
function processZairoth(input, version = '1.0') {
    if (version === '2.0') {
        return (0, v2_1.processZairothV2)(input);
    }
    try {
        const instructions = (0, parser_1.parseZairoth)(input);
        (0, validator_1.validateZairoth)(instructions);
        const validation = (0, validator_1.validateZairothSafe)(instructions);
        const canonical = (0, compiler_1.compileZairoth)(instructions);
        return {
            instructions,
            validation,
            canonical,
            version: '1.0'
        };
    }
    catch (error) {
        if (error instanceof errors_1.ZairothError) {
            throw error;
        }
        throw new errors_1.ZairothError(errors_1.ZairothErrorCode.PARSING_ERROR, error instanceof Error ? error.message : 'Unknown parsing error');
    }
}
function processZairothSafe(input, version = '1.0') {
    try {
        const result = processZairoth(input, version);
        return { success: true, result };
    }
    catch (error) {
        if (error instanceof errors_1.ZairothError) {
            return {
                success: false,
                error: error.message,
                validation: { valid: false, errors: [{ line: error.line || 0, code: error.code, message: error.message }], warnings: [] }
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
function evaluateSafety(instructions, context) {
    return (0, validator_1.checkHardKillSwitches)(instructions, context);
}
//# sourceMappingURL=index.js.map