/**
 * Core TypeScript interfaces and types for the Health Check System
 */

export type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';

export type AuditCategory = 
  | 'frontend' 
  | 'backend' 
  | 'workers' 
  | 'redis' 
  | 'integrations' 
  | 'code-quality';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface AuditConfig {
  environment: 'development' | 'staging' | 'production';
  parallel: boolean;
  timeout: number;
  categories: AuditCategory[];
  verbose: boolean;
}

export interface CheckResult {
  name: string;
  status: CheckStatus;
  message: string;
  details?: Record<string, any>;
  error?: string;
  duration: number;
}

export interface CategoryResult {
  status: HealthStatus;
  checks: CheckResult[];
  duration: number;
}

export interface Issue {
  id: string;
  category: AuditCategory;
  component: string;
  severity: IssueSeverity;
  title: string;
  description: string;
  recommendation: string;
  firstSeen: string;
  lastSeen: string;
}

export interface AuditSummary {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warnings: number;
  skippedChecks: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  healthScore: number;
}

export interface AuditResult {
  timestamp: string;
  environment: string;
  duration: number;
  overallHealth: HealthStatus;
  categories: Record<AuditCategory, CategoryResult>;
  issues: Issue[];
  summary: AuditSummary;
}

export interface AuditComparison {
  previousAudit: AuditResult;
  newIssues: Issue[];
  resolvedIssues: Issue[];
  persistentIssues: Issue[];
}
