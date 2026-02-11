/**
 * Report Generator for creating human-readable and machine-readable audit reports
 */

import type { AuditResult, AuditComparison, Issue, CheckResult } from './types';

/**
 * Generate markdown report
 */
export function generateMarkdown(
  result: AuditResult,
  comparison?: AuditComparison
): string {
  const sections: string[] = [];

  // Header
  sections.push('# System Health Audit Report\n');
  sections.push(`**Date:** ${new Date(result.timestamp).toUTCString()}`);
  sections.push(`**Environment:** ${result.environment}`);
  sections.push(`**Duration:** ${(result.duration / 1000).toFixed(1)}s`);
  sections.push(`**Overall Health:** ${result.overallHealth.toUpperCase()}`);
  sections.push(`**Health Score:** ${result.summary.healthScore}/100\n`);

  // Executive Summary
  sections.push('## Executive Summary\n');
  sections.push(`- Total Checks: ${result.summary.totalChecks}`);
  sections.push(`- Passed: ${result.summary.passedChecks}`);
  sections.push(`- Failed: ${result.summary.failedChecks}`);
  sections.push(`- Warnings: ${result.summary.warnings}`);
  sections.push(`- Critical Issues: ${result.summary.criticalIssues}`);
  sections.push(`- High Issues: ${result.summary.highIssues}`);
  sections.push(`- Medium Issues: ${result.summary.mediumIssues}`);
  sections.push(`- Low Issues: ${result.summary.lowIssues}\n`);

  // Issues by Severity
  if (result.issues.length > 0) {
    sections.push('## Issues by Severity\n');

    const issuesBySeverity = groupIssuesBySeverity(result.issues);

    if (issuesBySeverity.critical.length > 0) {
      sections.push(`### Critical Issues (${issuesBySeverity.critical.length})\n`);
      issuesBySeverity.critical.forEach((issue, index) => {
        sections.push(formatIssue(issue, index + 1));
      });
    }

    if (issuesBySeverity.high.length > 0) {
      sections.push(`### High Issues (${issuesBySeverity.high.length})\n`);
      issuesBySeverity.high.forEach((issue, index) => {
        sections.push(formatIssue(issue, index + 1));
      });
    }

    if (issuesBySeverity.medium.length > 0) {
      sections.push(`### Medium Issues (${issuesBySeverity.medium.length})\n`);
      issuesBySeverity.medium.forEach((issue, index) => {
        sections.push(formatIssue(issue, index + 1));
      });
    }

    if (issuesBySeverity.low.length > 0) {
      sections.push(`### Low Issues (${issuesBySeverity.low.length})\n`);
      issuesBySeverity.low.forEach((issue, index) => {
        sections.push(formatIssue(issue, index + 1));
      });
    }
  } else {
    sections.push('## Issues\n');
    sections.push('No issues found! System is healthy. ✅\n');
  }

  // Category Details
  sections.push('## Category Details\n');
  for (const [category, categoryResult] of Object.entries(result.categories)) {
    sections.push(`### ${formatCategoryName(category)}\n`);
    sections.push(`**Status:** ${categoryResult.status.toUpperCase()}`);
    sections.push(`**Duration:** ${(categoryResult.duration / 1000).toFixed(2)}s`);
    sections.push(`**Checks:** ${categoryResult.checks.length}\n`);

    categoryResult.checks.forEach(check => {
      const icon = getCheckIcon(check.status);
      sections.push(`- ${icon} **${check.name}**: ${check.message}`);
      if (check.error) {
        sections.push(`  - Error: ${check.error}`);
      }
    });
    sections.push('');
  }

  // Comparison with previous audit
  if (comparison) {
    sections.push('## Changes Since Last Audit\n');
    sections.push(`**Previous Audit:** ${new Date(comparison.previousAudit.timestamp).toUTCString()}\n`);
    sections.push(`- **New Issues:** ${comparison.newIssues.length}`);
    sections.push(`- **Resolved Issues:** ${comparison.resolvedIssues.length}`);
    sections.push(`- **Persistent Issues:** ${comparison.persistentIssues.length}\n`);

    if (comparison.newIssues.length > 0) {
      sections.push('### New Issues\n');
      comparison.newIssues.forEach(issue => {
        sections.push(`- ${issue.title} (${issue.severity.toUpperCase()})`);
      });
      sections.push('');
    }

    if (comparison.resolvedIssues.length > 0) {
      sections.push('### Resolved Issues\n');
      comparison.resolvedIssues.forEach(issue => {
        sections.push(`- ${issue.title} (${issue.severity.toUpperCase()})`);
      });
      sections.push('');
    }
  }

  return sections.join('\n');
}

/**
 * Generate JSON report
 */
export function generateJSON(result: AuditResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Generate summary for CLI output
 */
export function generateSummary(result: AuditResult): string {
  const lines: string[] = [];

  lines.push('\n=== System Health Audit Summary ===\n');
  lines.push(`Environment: ${result.environment}`);
  lines.push(`Overall Health: ${result.overallHealth.toUpperCase()}`);
  lines.push(`Health Score: ${result.summary.healthScore}/100`);
  lines.push(`Duration: ${(result.duration / 1000).toFixed(1)}s\n`);

  lines.push(`Checks: ${result.summary.passedChecks}/${result.summary.totalChecks} passed`);
  
  if (result.summary.criticalIssues > 0) {
    lines.push(`⚠️  Critical Issues: ${result.summary.criticalIssues}`);
  }
  if (result.summary.highIssues > 0) {
    lines.push(`⚠️  High Issues: ${result.summary.highIssues}`);
  }
  if (result.summary.mediumIssues > 0) {
    lines.push(`⚠️  Medium Issues: ${result.summary.mediumIssues}`);
  }
  if (result.summary.lowIssues > 0) {
    lines.push(`ℹ️  Low Issues: ${result.summary.lowIssues}`);
  }

  if (result.issues.length === 0) {
    lines.push('\n✅ No issues found! System is healthy.');
  }

  lines.push('\n===================================\n');

  return lines.join('\n');
}

/**
 * Group issues by severity
 */
function groupIssuesBySeverity(issues: Issue[]): Record<string, Issue[]> {
  const grouped: Record<string, Issue[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  for (const issue of issues) {
    grouped[issue.severity].push(issue);
  }

  return grouped;
}

/**
 * Format issue for markdown
 */
function formatIssue(issue: Issue, index: number): string {
  const lines: string[] = [];
  
  lines.push(`${index}. **${issue.title}**`);
  lines.push(`   - Component: ${issue.component}`);
  lines.push(`   - Category: ${issue.category}`);
  lines.push(`   - Description: ${issue.description}`);
  lines.push(`   - Recommendation: ${issue.recommendation}\n`);

  return lines.join('\n');
}

/**
 * Format category name for display
 */
function formatCategoryName(category: string): string {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get icon for check status
 */
function getCheckIcon(status: string): string {
  switch (status) {
    case 'pass':
      return '✅';
    case 'fail':
      return '❌';
    case 'warn':
      return '⚠️';
    case 'skip':
      return '⏭️';
    default:
      return '❓';
  }
}

/**
 * Calculate health score based on check results
 */
export function calculateHealthScore(
  passedChecks: number,
  totalChecks: number,
  criticalIssues: number,
  highIssues: number
): number {
  if (totalChecks === 0) return 100;

  // Base score from passed checks
  const baseScore = (passedChecks / totalChecks) * 100;

  // Penalties
  const criticalPenalty = criticalIssues * 20;
  const highPenalty = highIssues * 10;

  const finalScore = Math.max(0, baseScore - criticalPenalty - highPenalty);

  return Math.round(finalScore);
}
