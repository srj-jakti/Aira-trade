/**
 * Configuration management for Health Check System
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { AuditCategory } from './types';

export interface HealthCheckConfig {
  version: string;
  environments: {
    [env: string]: EnvironmentConfig;
  };
  checks: {
    [category: string]: CategoryConfig;
  };
  thresholds: HealthThresholds;
  notifications: NotificationConfig;
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

export interface NotificationConfig {
  enabled: boolean;
  channels: ('email' | 'slack' | 'webhook')[];
  onCritical: boolean;
  onDegraded: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: HealthCheckConfig = {
  version: '1.0.0',
  environments: {
    development: {},
    staging: {},
    production: {},
  },
  checks: {
    frontend: {
      enabled: true,
      timeout: 30000,
      checks: ['deployment-status', 'api-routes', 'page-accessibility', 'build-config'],
    },
    backend: {
      enabled: true,
      timeout: 30000,
      checks: ['database-connection', 'auth-system', 'rls-policies', 'table-schemas'],
    },
    workers: {
      enabled: true,
      timeout: 30000,
      checks: ['services-status', 'environment-variables', 'service-logs'],
    },
    redis: {
      enabled: true,
      timeout: 30000,
      checks: ['connection', 'operations', 'server-info'],
    },
    integrations: {
      enabled: true,
      timeout: 30000,
      checks: ['zerodha-integration', 'razorpay-integration'],
    },
    'code-quality': {
      enabled: true,
      timeout: 60000,
      checks: ['linting', 'typescript', 'security-config', 'encryption'],
    },
  },
  thresholds: {
    healthyMinScore: 90,
    degradedMinScore: 70,
    criticalMaxIssues: 0,
    highMaxIssues: 2,
  },
  notifications: {
    enabled: false,
    channels: [],
    onCritical: true,
    onDegraded: false,
  },
};

/**
 * Load configuration from file with defaults
 * @param configPath - Path to configuration file
 * @returns Merged configuration with defaults
 */
export async function loadConfig(configPath?: string): Promise<HealthCheckConfig> {
  const defaultPath = join(process.cwd(), '.kiro', 'health-check-config.json');
  const path = configPath || defaultPath;

  // If config file doesn't exist, return defaults
  if (!existsSync(path)) {
    console.log(`Configuration file not found at ${path}, using defaults`);
    return DEFAULT_CONFIG;
  }

  try {
    const fileContent = await readFile(path, 'utf-8');
    const userConfig = JSON.parse(fileContent) as Partial<HealthCheckConfig>;

    // Deep merge user config with defaults
    return mergeConfig(DEFAULT_CONFIG, userConfig);
  } catch (error) {
    console.error(`Error loading configuration from ${path}:`, error);
    console.log('Using default configuration');
    return DEFAULT_CONFIG;
  }
}

/**
 * Deep merge configuration objects
 */
function mergeConfig(
  defaults: HealthCheckConfig,
  user: Partial<HealthCheckConfig>
): HealthCheckConfig {
  return {
    version: user.version || defaults.version,
    environments: {
      ...defaults.environments,
      ...user.environments,
    },
    checks: {
      ...defaults.checks,
      ...user.checks,
    },
    thresholds: {
      ...defaults.thresholds,
      ...user.thresholds,
    },
    notifications: {
      ...defaults.notifications,
      ...user.notifications,
    },
  };
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig(
  config: HealthCheckConfig,
  environment: string
): EnvironmentConfig {
  return config.environments[environment] || {};
}

/**
 * Get category-specific configuration
 */
export function getCategoryConfig(
  config: HealthCheckConfig,
  category: AuditCategory
): CategoryConfig {
  return config.checks[category] || {
    enabled: true,
    timeout: 30000,
    checks: [],
  };
}

/**
 * Check if a category is enabled
 */
export function isCategoryEnabled(
  config: HealthCheckConfig,
  category: AuditCategory
): boolean {
  const categoryConfig = getCategoryConfig(config, category);
  return categoryConfig.enabled;
}
