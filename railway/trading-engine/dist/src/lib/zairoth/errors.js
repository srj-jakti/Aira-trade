"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZairothError = exports.ZairothErrorCode = void 0;
var ZairothErrorCode;
(function (ZairothErrorCode) {
    ZairothErrorCode["MISSING_STATE"] = "MISSING_STATE";
    ZairothErrorCode["MISSING_CERTAINTY"] = "MISSING_CERTAINTY";
    ZairothErrorCode["UNKNOWN_KEYWORD"] = "UNKNOWN_KEYWORD";
    ZairothErrorCode["AMBIGUOUS_CONDITION"] = "AMBIGUOUS_CONDITION";
    ZairothErrorCode["CONFLICTING_RULES"] = "CONFLICTING_RULES";
    ZairothErrorCode["INVALID_STRUCTURE"] = "INVALID_STRUCTURE";
    ZairothErrorCode["PARSING_ERROR"] = "PARSING_ERROR";
})(ZairothErrorCode || (exports.ZairothErrorCode = ZairothErrorCode = {}));
class ZairothError extends Error {
    code;
    message;
    line;
    details;
    constructor(code, message, line, details) {
        super(`[${code}] ${message}${line ? ` at line ${line}` : ''}`);
        this.code = code;
        this.message = message;
        this.line = line;
        this.details = details;
        this.name = 'ZairothError';
    }
}
exports.ZairothError = ZairothError;
//# sourceMappingURL=errors.js.map