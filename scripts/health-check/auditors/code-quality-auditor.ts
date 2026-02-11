/**
 * Code Quality Auditor - Verifies code quality, security, and build health
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { CheckResult } from '../types';

const execAsync = promisify(exec);

interface LintingResult {
  errorCount: number;
  warningCount: number;
  files: number;
  issues: LintIssue[];
}

interface LintIssue {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  rule: string;
  message: string;
}

interface TypeScriptCheck {
  compiles: boolean;
  errors: TypeScriptError[];
}

interface TypeScriptError {
  file: string;
  line: number;
  message: string;
}

interface SecurityConfigCheck {
  hasHSTS: boolean;
  hasXFrameOptions: boolean;
  hasCSP: boolean;
  middlewareProtection: boolean;
  issues: string[];
}

interface EncryptionCheck {
  keyConfigured: boolean;
  keyLength: number;
  expectedLength: number;
  isValid: boolean;
}

/**
 * Check linting
 */
export async function checkLinting(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    // Run ESLint
    const { stdout, stderr } = await execAsync('npx eslint . --format json', {
      cwd: process.cwd(),
      timeout: 60000,
    });

    const results = JSON.parse(stdout);

    let errorCount = 0;
    let warningCount = 0;
    const issues: LintIssue[] = [];

    for (const result of results) {
      errorCount += result.errorCount;
      warningCount += result.warningCount;

      for (const message of result.messages) {
        issues.push({
          file: result.filePath,
          line: message.line,
          column: message.column,
          severity: message.severity === 2 ? 'error' : 'warning',
          rule: message.ruleId || 'unknown',
          message: message.message,
        });
      }
    }

    const lintingResult: LintingResult = {
      errorCount,
      warningCount,
      files: results.length,
      issues: issues.slice(0, 10), // Limit to first 10 issues
    };

    if (errorCount === 0 && warningCount === 0) {
      return {
        name: 'Linting',
        status: 'pass',
        message: 'No linting errors or warnings',
        details: lintingResult,
        duration: Date.now() - startTime,
      };
    } else if (errorCount > 0) {
      return {
        name: 'Linting',
        status: 'fail',
        message: `${errorCount} errors, ${warningCount} warnings`,
        details: lintingResult,
        error: `${errorCount} linting errors found`,
        duration: Date.now() - startTime,
      };
    } else {
      return {
        name: 'Linting',
        status: 'warn',
        message: `${warningCount} warnings`,
        details: lintingResult,
        duration: Date.now() - startTime,
      };
    }
  } catch (error) {
    // ESLint exits with non-zero code when errors are found
    if (error instanceof Error && 'stdout' in error) {
      try {
        const results = JSON.parse((error as any).stdout);
        let errorCount = 0;
        let warningCount = 0;

        for (const result of results) {
          errorCount += result.errorCount;
          warningCount += result.warningCount;
        }

        return {
          name: 'Linting',
          status: errorCount > 0 ? 'fail' : 'warn',
          message: `${errorCount} errors, ${warningCount} warnings`,
          details: { errorCount, warningCount },
          duration: Date.now() - startTime,
        };
      } catch (parseError) {
        // Fall through to error handling
      }
    }

    return {
      name: 'Linting',
      status: 'skip',
      message: 'Could not run linting',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Check TypeScript compilation
 */
export async function checkTypeScript(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    await execAsync('npx tsc --noEmit', {
      cwd: process.cwd(),
      timeout: 60000,
    });

    return {
      name: 'TypeScript Compilation',
      status: 'pass',
      message: 'TypeScript compiles without errors',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    if (error instanceof Error && 'stdout' in error) {
      const output = (error as any).stdout || (error as any).stderr || '';
      const errorLines = output.split('\n').filter((line: string) => line.includes('error TS'));

      return {
        name: 'TypeScript Compilation',
        status: 'fail',
        message: `${errorLines.length} TypeScript errors`,
        error: errorLines.slice(0, 5).join('\n'),
        duration: Date.now() - startTime,
      };
    }

    return {
      name: 'TypeScript Compilation',
      status: 'skip',
      message: 'Could not run TypeScript compiler',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Check security configuration
 */
export async function checkSecurityConfig(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    const configPath = join(process.cwd(), 'next.config.ts');
    const configContent = await readFile(configPath, 'utf-8');

    const check: SecurityConfigCheck = {
      hasHSTS: false,
      hasXFrameOptions: false,
      hasCSP: false,
      middlewareProtection: false,
      issues: [],
    };

    // Check for security headers
    if (configContent.includes('Strict-Transport-Security') || configContent.includes('HSTS')) {
      check.hasHSTS = true;
    } else {
      check.issues.push('Missing HSTS header');
    }

    if (configContent.includes('X-Frame-Options')) {
      check.hasXFrameOptions = true;
    } else {
      check.issues.push('Missing X-Frame-Options header');
    }

    if (configContent.includes('Content-Security-Policy') || configContent.includes('CSP')) {
      check.hasCSP = true;
    } else {
      check.issues.push('Missing Content-Security-Policy header');
    }

    // Check middleware protection
    try {
      const middlewarePath = join(process.cwd(), 'src', 'middleware.ts');
      const middlewareContent = await readFile(middlewarePath, 'utf-8');

      if (middlewareContent.includes('CRON_SECRET') || middlewareContent.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        check.middlewareProtection = true;
      } else {
        check.issues.push('Middleware may not be protecting admin/cron routes');
      }
    } catch (error) {
      check.issues.push('Could not verify middleware protection');
    }

    if (check.issues.length === 0) {
      return {
        name: 'Security Configuration',
        status: 'pass',
        message: 'All security configurations are present',
        details: check,
        duration: Date.now() - startTime,
      };
    } else {
      return {
        name: 'Security Configuration',
        status: 'warn',
        message: `${check.issues.length} security configuration issues`,
        details: check,
        error: check.issues.join('; '),
        duration: Date.now() - startTime,
      };
    }
  } catch (error) {
    return {
      name: 'Security Configuration',
      status: 'skip',
      message: 'Could not check security configuration',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Check encryption configuration
 */
export async function checkEncryption(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    const encryptionKey = process.env.ENCRYPTION_KEY;

    const check: EncryptionCheck = {
      keyConfigured: !!encryptionKey,
      keyLength: encryptionKey ? encryptionKey.length : 0,
      expectedLength: 64, // 32 bytes = 64 hex characters
      isValid: false,
    };

    if (!check.keyConfigured) {
      return {
        name: 'Encryption Configuration',
        status: 'fail',
        message: 'ENCRYPTION_KEY not configured',
        details: check,
        error: 'ENCRYPTION_KEY environment variable is missing',
        duration: Date.now() - startTime,
      };
    }

    // Check if key is exactly 64 hex characters
    const isHex = /^[0-9a-fA-F]{64}$/.test(encryptionKey!);
    check.isValid = isHex && check.keyLength === 64;

    if (check.isValid) {
      return {
        name: 'Encryption Configuration',
        status: 'pass',
        message: 'ENCRYPTION_KEY is properly configured',
        details: check,
        duration: Date.now() - startTime,
      };
    } else {
      return {
        name: 'Encryption Configuration',
        status: 'fail',
        message: 'ENCRYPTION_KEY has invalid format',
        details: check,
        error: `Expected 64 hex characters, got ${check.keyLength} characters`,
        duration: Date.now() - startTime,
      };
    }
  } catch (error) {
    return {
      name: 'Encryption Configuration',
      status: 'fail',
      message: 'Failed to check encryption configuration',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Run all code quality checks
 */
export async function runCodeQualityAudit(): Promise<CheckResult[]> {
  return await Promise.all([
    checkLinting(),
    checkTypeScript(),
    checkSecurityConfig(),
    checkEncryption(),
  ]);
}
