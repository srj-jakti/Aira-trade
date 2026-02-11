/**
 * Audit Orchestrator - Coordinates execution of all health checks
 */

import type { AuditConfig, AuditResult, AuditCategory, CategoryResult, CheckResult, Issue, AuditSummary, HealthStatus } from './types';
import { runFrontendAudit } from './auditors/frontend-auditor';
import { runBackendAudit } from './auditors/backend-auditor';
import { runWorkerAudit } from './auditors/worker-auditor';
import { runRedisAudit } from './auditors/redis-auditor';
import { runIntegrationAudit } from './auditors/integration-auditor';
import { runCodeQualityAudit } from './auditors/code-quality-auditor';
import { calculateHealthScore } from './report-generator';

/**
 * Run full audit
 */
export async function runAudit(config: AuditConfig): Promise<AuditResult> {
  const startTime = Date.now();

  console.log(`Starting health audit for ${config.environment} environment...`);

  // Run all category audits
  const categoryResults = await runAllCategories(config);

  // Extract issues from check results
  const issues = extractIssues(categoryResults);

  // Calculate summary
  const summary = calculateSummary(categoryResults, issues);

  // Determine overall health
  const overallHealth = determineOverallHealth(summary);

  const result: AuditResult = {
    timestamp: new Date().toISOString(),
    environment: config.environment,
    duration: Date.now() - startTime,
    overallHealth,
    categories: categoryResults,
    issues,
    summary,
  };

  console.log(`Audit completed in ${(result.duration / 1000).toFixed(1)}s`);
  console.log(`Overall Health: ${overallHealth.toUpperCase()}`);
  console.log(`Health Score: ${summary.healthScore}/100`);

  return result;
}

/**
 * Run specific category audit
 */
export async function runCategory(category: AuditCategory): Promise<CategoryResult> {
  const startTime = Date.now();

  let checks: CheckResult[] = [];

  try {
    switch (category) {
      case 'frontend':
        checks = await runFrontendAudit();
        break;
      case 'backend':
        checks = await runBackendAudit();
        break;
      case 'workers':
        checks = await runWorkerAudit();
        break;
      case 'redis':
        checks = await runRedisAudit();
        break;
      case 'integrations':
        checks = await runIntegrationAudit();
        break;
      case 'code-quality':
        checks = await runCodeQualityAudit();
        break;
      default:
        throw new Error(`Unknown category: ${category}`);
    }
  } catch (error) {
    console.error(`Error running ${category} audit:`, error);
    checks = [{
      name: `${category} audit`,
      status: 'fail',
      message: 'Audit execution failed',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    }];
  }

  const status = determineCategoryHealth(checks);

  return {
    status,
    checks,
    duration: Date.now() - startTime,
  };
}

/**
 * Run all category audits (with parallel execution)
 */
async function runAllCategories(config: AuditConfig): Promise<Record<AuditCategory, CategoryResult>> {
  const categories = config.categories;

  if (config.parallel) {
    // Run all categories in parallel
    const results = await Promise.allSettled(
      categories.map(category => runCategory(category))
    );

    const categoryResults: Record<string, CategoryResult> = {};

    categories.forEach((category, index) => {
      const result = results[index];
      if (result.status === 'fulfilled') {
        categoryResults[category] = result.value;
      } else {
        // Handle rejected promise
        categoryResults[category] = {
          status: 'unknown',
          checks: [{
            name: `${category} audit`,
            status: 'fail',
            message: 'Audit execution failed',
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            duration: 0,
          }],
          duration: 0,
        };
      }
    });

    return categoryResults as Record<AuditCategory, CategoryResult>;
  } else {
    // Run categories sequentially
    const categoryResults: Record<string, CategoryResult> = {};

    for (const category of categories) {
      try {
        categoryResults[category] = await runCategory(category);
      } catch (error) {
        categoryResults[category] = {
          status: 'unknown',
          checks: [{
            name: `${category} audit`,
            status: 'fail',
            message: 'Audit execution failed',
            error: error instanceof Error ? error.message : String(error),
            duration: 0,
          }],
          duration: 0,
        };
      }
    }

    return categoryResults as Record<AuditCategory, CategoryResult>;
  }
}

/**
 * Determine category health based on check results
 */
function determineCategoryHealth(checks: CheckResult[]): HealthStatus {
  const hasFailures = checks.some(c => c.status === 'fail');
  const hasWarnings = checks.some(c => c.status === 'warn');
  const allSkipped = checks.every(c => c.status === 'skip');

  if (allSkipped) return 'unknown';
  if (hasFailures) return 'critical';
  if (hasWarnings) return 'degraded';
  return 'healthy';
}

/**
 * Extract issues from category results
 */
function extractIssues(categoryResults: Record<AuditCategory, CategoryResult>): Issue[] {
  const issues: Issue[] = [];

  for (const [category, result] of Object.entries(categoryResults)) {
    for (const check of result.checks) {
      if (check.status === 'fail' || check.status === 'warn') {
        const severity = determineSeverity(category as AuditCategory, check);

        issues.push({
          id: `${category}-${check.name}-${Date.now()}`,
          category: category as AuditCategory,
          component: check.name,
          severity,
          title: check.message,
          description: check.error || check.message,
          recommendation: getRecommendation(category as AuditCategory, check),
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
        });
      }
    }
  }

  return issues;
}

/**
 * Determine issue severity
 */
function determineSeverity(category: AuditCategory, check: CheckResult): 'critical' | 'high' | 'medium' | 'low' {
  // Critical severity rules
  if (check.status === 'fail') {
    if (category === 'redis' || category === 'backend') {
      return 'critical';
    }
    if (category === 'workers' && check.name.includes('Status')) {
      return 'critical';
    }
    if (category === 'integrations' && check.name.includes('Zerodha')) {
      return 'high';
    }
    return 'high';
  }

  // Warning severity
  if (check.status === 'warn') {
    if (category === 'integrations') {
      return 'medium';
    }
    return 'low';
  }

  return 'low';
}

/**
 * Get recommendation for fixing an issue
 */
function getRecommendation(category: AuditCategory, check: CheckResult): string {
  const recommendations: Record<string, string> = {
    'Redis Connection': 'Ensure Redis service is running and REDIS_URL is correctly configured',
    'Database Connection': 'Check Supabase credentials and network connectivity',
    'Vercel Deployment Status': 'Review deployment logs in Vercel dashboard',
    'Railway Services Status': 'Check Railway dashboard for service status and logs',
    'Zerodha Integration': 'Verify Zerodha API credentials and regenerate if expired',
    'Razorpay Integration': 'Configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET',
    'Environment Variables': 'Set missing environment variables in deployment configuration',
    'Encryption Configuration': 'Generate a valid 64-character hex ENCRYPTION_KEY',
    'Security Configuration': 'Add security headers to next.config.ts',
    'Linting': 'Run npm run lint -- --fix to auto-fix linting issues',
    'TypeScript Compilation': 'Fix TypeScript errors reported by tsc',
  };

  return recommendations[check.name] || 'Review logs and configuration for this component';
}

/**
 * Calculate audit summary
 */
function calculateSummary(
  categoryResults: Record<AuditCategory, CategoryResult>,
  issues: Issue[]
): AuditSummary {
  let totalChecks = 0;
  let passedChecks = 0;
  let failedChecks = 0;
  let warnings = 0;
  let skippedChecks = 0;

  for (const result of Object.values(categoryResults)) {
    for (const check of result.checks) {
      totalChecks++;
      switch (check.status) {
        case 'pass':
          passedChecks++;
          break;
        case 'fail':
          failedChecks++;
          break;
        case 'warn':
          warnings++;
          break;
        case 'skip':
          skippedChecks++;
          break;
      }
    }
  }

  const criticalIssues = issues.filter(i => i.severity === 'critical').length;
  const highIssues = issues.filter(i => i.severity === 'high').length;
  const mediumIssues = issues.filter(i => i.severity === 'medium').length;
  const lowIssues = issues.filter(i => i.severity === 'low').length;

  const healthScore = calculateHealthScore(passedChecks, totalChecks, criticalIssues, highIssues);

  return {
    totalChecks,
    passedChecks,
    failedChecks,
    warnings,
    skippedChecks,
    criticalIssues,
    highIssues,
    mediumIssues,
    lowIssues,
    healthScore,
  };
}

/**
 * Determine overall health status
 */
function determineOverallHealth(summary: AuditSummary): HealthStatus {
  if (summary.criticalIssues > 0) {
    return 'critical';
  }
  if (summary.highIssues > 0 || summary.failedChecks > 0) {
    return 'degraded';
  }
  if (summary.warnings > 0) {
    return 'degraded';
  }
  return 'healthy';
}
