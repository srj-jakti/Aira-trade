export declare enum ZairothErrorCode {
    MISSING_STATE = "MISSING_STATE",
    MISSING_CERTAINTY = "MISSING_CERTAINTY",
    UNKNOWN_KEYWORD = "UNKNOWN_KEYWORD",
    AMBIGUOUS_CONDITION = "AMBIGUOUS_CONDITION",
    CONFLICTING_RULES = "CONFLICTING_RULES",
    INVALID_STRUCTURE = "INVALID_STRUCTURE",
    PARSING_ERROR = "PARSING_ERROR"
}
export declare class ZairothError extends Error {
    code: ZairothErrorCode;
    message: string;
    line?: number | undefined;
    details?: any | undefined;
    constructor(code: ZairothErrorCode, message: string, line?: number | undefined, details?: any | undefined);
}
//# sourceMappingURL=errors.d.ts.map