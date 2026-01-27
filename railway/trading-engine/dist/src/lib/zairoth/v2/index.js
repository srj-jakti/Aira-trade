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
exports.processZairothV2 = processZairothV2;
const parser_1 = require("./parser");
const validator_1 = require("./validator");
__exportStar(require("./parser"), exports);
__exportStar(require("./validator"), exports);
function processZairothV2(input) {
    const instructions = (0, parser_1.parseZairothV2)(input);
    const validation = (0, validator_1.validateZairothV2)(instructions);
    return {
        instructions,
        validation,
        version: '2.0'
    };
}
//# sourceMappingURL=index.js.map