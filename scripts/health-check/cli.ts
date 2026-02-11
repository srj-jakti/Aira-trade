#!/usr/bin/env node
/**
 * CLI Interface for Health Check System
 */

import { Command } from 'commander';
import { loadConfig } from './config';
import { runAudit } from './orchestrator';
import { generateMarkdown, generateJSON, generateSummary } from './report-generator';
import { saveAudit, getLatestAudit, listAudits, compareAuditResults } from './history-manager';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import type { AuditCategory } from './types';

const program = new Command();

program
  .name('health-check')
  .description('System Health Audit and Connectivity Verification')
  .version('1.0.0');

program
  .option('-e, --env <environment>', 'Environment to audit', 'development')
  .option('-c, --category <category>', 'Specific category to audit')
  .option('--json', 'Output JSON only')
  .option('-v, --verbose', 'Verbose output')
  .option('--compare', 'Compare with previous audit')
  .option('--no-save', 'Do not save audit to history')
  .action(async (options) => {
    try {
      // Load configuration
      const config = await loadConfig();

      // Determine categories to audit
      let categories: AuditCategory[] = [
        'frontend',
        'backend',
        'workers',
        'redis',
        'integrations',
        'code-quality',
      ];

      if (options.category) {
        categories = [options.category as AuditCategory];
      }

      // Run audit
      const auditConfig = {
        environment: options.env,
        parallel: true,
        timeout: 300000, // 5 minutes
        categories,
        verbose: options.verbose || false,
      };

      console.log(`\nRunning health audit for ${options.env} environment...\n`);

      const result = await runAudit(auditConfig);

      // Save to history (unless --no-save)
      if (options.save !== false) {
        await saveAudit(result);
      }

      // Get comparison if requested
      let comparison;
      if (options.compare) {
        const previousAudit = await getLatestAudit();
        if (previousAudit && previousAudit.timestamp !== result.timestamp) {
          comparison = compareAuditResults(previousAudit, result);
        }
      }

      // Output results
      if (options.json) {
        console.log(generateJSON(result));
      } else {
        console.log(generateSummary(result));

        // Save markdown report
        const reportPath = join(
          process.cwd(),
          '.kiro',
          'audit-history',
          `report-${result.environment}-${result.timestamp.replace(/:/g, '-')}.md`
        );

        const markdown = generateMarkdown(result, comparison);
        await writeFile(reportPath, markdown, 'utf-8');

        console.log(`\nDetailed report saved to: ${reportPath}\n`);
      }

      // Exit with appropriate code
      const exitCode = getExitCode(result);
      process.exit(exitCode);
    } catch (error) {
      console.error('Error running health check:', error);
      process.exit(3);
    }
  });

program
  .command('history')
  .description('List audit history')
  .option('-l, --limit <number>', 'Limit number of results', '10')
  .action(async (options) => {
    try {
      const audits = await listAudits(parseInt(options.limit));

      console.log('\n=== Audit History ===\n');

      for (const audit of audits) {
        console.log(`${audit.timestamp} - ${audit.environment}`);
        console.log(`  Health: ${audit.overallHealth.toUpperCase()}`);
        console.log(`  Issues: ${audit.issueCount}`);
        console.log(`  Duration: ${(audit.duration / 1000).toFixed(1)}s\n`);
      }
    } catch (error) {
      console.error('Error listing audit history:', error);
      process.exit(1);
    }
  });

program
  .command('view <timestamp>')
  .description('View specific audit report')
  .action(async (timestamp) => {
    try {
      const { getAuditByTimestamp } = await import('./history-manager');
      const audit = await getAuditByTimestamp(timestamp);

      if (!audit) {
        console.error(`No audit found for timestamp: ${timestamp}`);
        process.exit(1);
      }

      const markdown = generateMarkdown(audit);
      console.log(markdown);
    } catch (error) {
      console.error('Error viewing audit:', error);
      process.exit(1);
    }
  });

/**
 * Determine exit code based on audit results
 */
function getExitCode(result: any): number {
  if (result.overallHealth === 'critical') {
    return 2; // Critical issues
  }
  if (result.overallHealth === 'degraded') {
    return 1; // Warnings/degraded
  }
  if (result.overallHealth === 'healthy') {
    return 0; // All good
  }
  return 3; // Unknown/error
}

// Parse command line arguments
program.parse();
