export enum ZairothErrorCode {
  MISSING_STATE = 'MISSING_STATE',
  MISSING_CERTAINTY = 'MISSING_CERTAINTY',
  UNKNOWN_KEYWORD = 'UNKNOWN_KEYWORD',
  AMBIGUOUS_CONDITION = 'AMBIGUOUS_CONDITION',
  CONFLICTING_RULES = 'CONFLICTING_RULES',
  INVALID_STRUCTURE = 'INVALID_STRUCTURE',
  PARSING_ERROR = 'PARSING_ERROR',
}

export class ZairothError extends Error {
  constructor(
    public code: ZairothErrorCode,
    public message: string,
    public line?: number,
    public details?: any
  ) {
    super(`[${code}] ${message}${line ? ` at line ${line}` : ''}`);
    this.name = 'ZairothError';
  }
}
