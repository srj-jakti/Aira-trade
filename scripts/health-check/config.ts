/**
 * Configuration management for Health Check System
 */

import { AuditConfig } from './types';

export interface HealthCheckConfig {
  version: string;
  environments: {
    [env: string]: EnvironmentConfig;
  };
  checks: {
    [category: string]: CategoryConfig;
  };
  thresholds: HealthThresholds;
}

export interface EnvironmentConfig {
  vercelProjectId?: string;
  railwayProjectId?: string;
  supabaseProjectRef?: string;
  redisUrl?: string;
}

export interface CategoryConfig {
  enabled: boolean;
  timeout: number;
  checks: string[];
}

export interface HealthThresholds {
  healthyMinScore: number;
  degradedMinScore: number;
  criticalMaxIssues: number;
  highMaxIssues: number;
}

export const DEFAULT_CONFIG: HealthCheckConfig = {
  version: '1.0.0',
  environments: {
    development: {},
    staging: {},
    production: {}
  },
  checks: {
    frontend: {
      enabled: true,
      timeout: 30000,
      checks: ['deployment', 'api-routes', 'pages', 'build-config']
    },
    backend: {
      enabled: true,
      timeout: 30000,
      checks: ['connection', 'auth', 'rls', 'schemas']
    },
    workers: {
      enabled: true,
      timeout: 30000,
      checks: ['status', 'env-vars', 'logs']
    },
    redis: {
      enabled: true,
      timeout: 10000,
      checks: ['connection', 'operations', 'info']
    },
    integrations: {
      enabled: true,
      timeout: 30000,
      checks: ['zerodha', 'razorpay']
    },
    'code-quality': {
      enabled: true,
      timeout: 60000,
      checks: ['linting', 'typescript', 'security', 'encryption']
    }
  },
  thresholds: {
    healthyMinScore: 90,
    degradedMinScore: 70,
    criticalMaxIssues: 0,
    highMaxIssues: 2
  }
};

export const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  environment: 'development',
  parallel: true,
  timeout: 300000, // 5 minutes
  categories: ['frontend', 'backend', 'workers', 'redis', 'integrations', 'code-quality'],
  verbose: false
};
