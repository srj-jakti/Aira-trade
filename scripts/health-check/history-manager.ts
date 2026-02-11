/**
 * History Manager for storing and retrieving audit results
 */

import { readFile, writeFile, readdir, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { AuditResult, AuditComparison, Issue } from './types';

export interface AuditMetadata {
  timestamp: string;
  environment: string;
  overallHealth: string;
  issueCount: number;
  duration: number;
}

export interface StoredAuditResult extends AuditResult {
  version: string;
  config: any;
  metadata: {
    hostname: string;
    user: string;
    nodeVersion: string;
    platform: string;
  };
}

const HISTORY_DIR = join(process.cwd(), '.kiro', 'audit-history');
const MAX_AUDIT_AGE_DAYS = 30;

/**
 * Ensure history directory exists
 */
async function ensureHistoryDir(): Promise<void> {
  if (!existsSync(HISTORY_DIR)) {
    await mkdir(HISTORY_DIR, { recursive: true });
  }
}

/**
 * Generate filename for audit result
 */
function getAuditFilename(environment: string, timestamp: string): string {
  return `audit-${environment}-${timestamp.replace(/:/g, '-')}.json`;
}

/**
 * Save audit result to history
 */
export async function saveAudit(result: AuditResult): Promise<void> {
  await ensureHistoryDir();

  const storedResult: StoredAuditResult = {
    ...result,
    version: '1.0.0',
    config: {},
    metadata: {
      hostname: process.env.HOSTNAME || 'unknown',
      user: process.env.USER || process.env.USERNAME || 'unknown',
      nodeVersion: process.version,
      platform: process.platform,
    },
  };

  const filename = getAuditFilename(result.environment, result.timestamp);
  const filepath = join(HISTORY_DIR, filename);

  await writeFile(filepath, JSON.stringify(storedResult, null, 2), 'utf-8');
  console.log(`Audit saved to ${filepath}`);

  // Cleanup old audits
  await cleanupOldAudits();
}

/**
 * Get most recent audit
 */
export async function getLatestAudit(): Promise<AuditResult | null> {
  await ensureHistoryDir();

  const files = await readdir(HISTORY_DIR);
  const auditFiles = files.filter(f => f.startsWith('audit-') && f.endsWith('.json'));

  if (auditFiles.length === 0) {
    return null;
  }

  // Sort by filename (which includes timestamp)
  auditFiles.sort().reverse();
  const latestFile = auditFiles[0];

  return await loadAuditFromFile(join(HISTORY_DIR, latestFile));
}

/**
 * Get audit by timestamp
 */
export async function getAuditByTimestamp(timestamp: string): Promise<AuditResult | null> {
  await ensureHistoryDir();

  const files = await readdir(HISTORY_DIR);
  const normalizedTimestamp = timestamp.replace(/:/g, '-');
  
  const matchingFile = files.find(f => f.includes(normalizedTimestamp));

  if (!matchingFile) {
    return null;
  }

  return await loadAuditFromFile(join(HISTORY_DIR, matchingFile));
}

/**
 * List all audits
 */
export async function listAudits(limit?: number): Promise<AuditMetadata[]> {
  await ensureHistoryDir();

  const files = await readdir(HISTORY_DIR);
  const auditFiles = files.filter(f => f.startsWith('audit-') && f.endsWith('.json'));

  // Sort by filename (newest first)
  auditFiles.sort().reverse();

  const limitedFiles = limit ? auditFiles.slice(0, limit) : auditFiles;

  const metadata: AuditMetadata[] = [];

  for (const file of limitedFiles) {
    try {
      const audit = await loadAuditFromFile(join(HISTORY_DIR, file));
      if (audit) {
        metadata.push({
          timestamp: audit.timestamp,
          environment: audit.environment,
          overallHealth: audit.overallHealth,
          issueCount: audit.issues.length,
          duration: audit.duration,
        });
      }
    } catch (error) {
      console.error(`Error loading audit metadata from ${file}:`, error);
    }
  }

  return metadata;
}

/**
 * Load audit from file
 */
async function loadAuditFromFile(filepath: string): Promise<AuditResult | null> {
  try {
    const content = await readFile(filepath, 'utf-8');
    const stored = JSON.parse(content) as StoredAuditResult;
    
    // Extract AuditResult from StoredAuditResult
    const { version, config, metadata, ...auditResult } = stored;
    return auditResult as AuditResult;
  } catch (error) {
    console.error(`Error loading audit from ${filepath}:`, error);
    return null;
  }
}

/**
 * Cleanup audits older than MAX_AUDIT_AGE_DAYS
 */
async function cleanupOldAudits(): Promise<void> {
  try {
    const files = await readdir(HISTORY_DIR);
    const auditFiles = files.filter(f => f.startsWith('audit-') && f.endsWith('.json'));

    const now = Date.now();
    const maxAge = MAX_AUDIT_AGE_DAYS * 24 * 60 * 60 * 1000;

    for (const file of auditFiles) {
      const filepath = join(HISTORY_DIR, file);
      try {
        const audit = await loadAuditFromFile(filepath);
        if (audit) {
          const auditTime = new Date(audit.timestamp).getTime();
          if (now - auditTime > maxAge) {
            await unlink(filepath);
            console.log(`Deleted old audit: ${file}`);
          }
        }
      } catch (error) {
        console.error(`Error processing ${file} for cleanup:`, error);
      }
    }
  } catch (error) {
    console.error('Error during audit cleanup:', error);
  }
}

/**
 * Compare two audits
 */
export async function compareAudits(
  timestamp1: string,
  timestamp2: string
): Promise<AuditComparison | null> {
  const audit1 = await getAuditByTimestamp(timestamp1);
  const audit2 = await getAuditByTimestamp(timestamp2);

  if (!audit1 || !audit2) {
    return null;
  }

  const previousAudit = new Date(audit1.timestamp) < new Date(audit2.timestamp) ? audit1 : audit2;
  const currentAudit = new Date(audit1.timestamp) < new Date(audit2.timestamp) ? audit2 : audit1;

  return compareAuditResults(previousAudit, currentAudit);
}

/**
 * Compare current audit with previous audit
 */
export function compareAuditResults(
  previousAudit: AuditResult,
  currentAudit: AuditResult
): AuditComparison {
  const previousIssueMap = new Map(
    previousAudit.issues.map(issue => [getIssueKey(issue), issue])
  );
  const currentIssueMap = new Map(
    currentAudit.issues.map(issue => [getIssueKey(issue), issue])
  );

  const newIssues: Issue[] = [];
  const resolvedIssues: Issue[] = [];
  const persistentIssues: Issue[] = [];

  // Find new and persistent issues
  for (const [key, issue] of currentIssueMap) {
    if (previousIssueMap.has(key)) {
      persistentIssues.push(issue);
    } else {
      newIssues.push(issue);
    }
  }

  // Find resolved issues
  for (const [key, issue] of previousIssueMap) {
    if (!currentIssueMap.has(key)) {
      resolvedIssues.push(issue);
    }
  }

  return {
    previousAudit,
    newIssues,
    resolvedIssues,
    persistentIssues,
  };
}

/**
 * Generate unique key for issue matching
 */
function getIssueKey(issue: Issue): string {
  return `${issue.category}:${issue.component}:${issue.title}`;
}
