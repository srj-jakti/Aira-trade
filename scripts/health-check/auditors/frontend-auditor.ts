/**
 * Frontend Auditor - Verifies health of Next.js application on Vercel
 */

import type { CheckResult } from '../types';

interface DeploymentInfo {
  id: string;
  state: 'READY' | 'ERROR' | 'BUILDING' | 'QUEUED' | 'CANCELED';
  url: string;
  createdAt: string;
  buildTime: number;
  errors: string[];
}

interface APIRouteCheck {
  path: string;
  method: string;
  expectedStatus: number;
  actualStatus?: number;
  responseTime?: number;
  error?: string;
}

/**
 * Vercel API Client
 */
class VercelClient {
  private token: string;
  private projectId?: string;

  constructor(token: string, projectId?: string) {
    this.token = token;
    this.projectId = projectId;
  }

  async getLatestDeployment(): Promise<DeploymentInfo | null> {
    try {
      const url = this.projectId
        ? `https://api.vercel.com/v6/deployments?projectId=${this.projectId}&limit=1`
        : `https://api.vercel.com/v6/deployments?limit=1`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Vercel API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.deployments || data.deployments.length === 0) {
        return null;
      }

      const deployment = data.deployments[0];

      return {
        id: deployment.uid,
        state: deployment.state,
        url: deployment.url,
        createdAt: new Date(deployment.created).toISOString(),
        buildTime: deployment.buildingAt ? Date.now() - deployment.buildingAt : 0,
        errors: deployment.errorMessage ? [deployment.errorMessage] : [],
      };
    } catch (error) {
      console.error('Error fetching Vercel deployment:', error);
      return null;
    }
  }
}

/**
 * Check Vercel deployment status
 */
export async function checkDeploymentStatus(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    const token = process.env.VERCEL_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;

    if (!token) {
      return {
        name: 'Vercel Deployment Status',
        status: 'skip',
        message: 'VERCEL_TOKEN not configured',
        duration: Date.now() - startTime,
      };
    }

    const client = new VercelClient(token, projectId);
    const deployment = await client.getLatestDeployment();

    if (!deployment) {
      return {
        name: 'Vercel Deployment Status',
        status: 'fail',
        message: 'No deployments found',
        duration: Date.now() - startTime,
      };
    }

    if (deployment.state === 'READY') {
      return {
        name: 'Vercel Deployment Status',
        status: 'pass',
        message: `Deployment is ready (${deployment.url})`,
        details: deployment,
        duration: Date.now() - startTime,
      };
    } else if (deployment.state === 'ERROR') {
      return {
        name: 'Vercel Deployment Status',
        status: 'fail',
        message: `Deployment failed: ${deployment.errors.join(', ')}`,
        details: deployment,
        error: deployment.errors.join(', '),
        duration: Date.now() - startTime,
      };
    } else {
      return {
        name: 'Vercel Deployment Status',
        status: 'warn',
        message: `Deployment in ${deployment.state} state`,
        details: deployment,
        duration: Date.now() - startTime,
      };
    }
  } catch (error) {
    return {
      name: 'Vercel Deployment Status',
      status: 'fail',
      message: 'Failed to check deployment status',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Check API routes accessibility
 */
export async function checkAPIRoutes(): Promise<CheckResult> {
  const startTime = Date.now();

  const routes: APIRouteCheck[] = [
    { path: '/api/health', method: 'GET', expectedStatus: 200 },
    { path: '/api/auth/session', method: 'GET', expectedStatus: 200 },
  ];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const results = await Promise.all(
      routes.map(async (route) => {
        const routeStartTime = Date.now();
        try {
          const response = await fetch(`${baseUrl}${route.path}`, {
            method: route.method,
            signal: AbortSignal.timeout(5000),
          });

          return {
            ...route,
            actualStatus: response.status,
            responseTime: Date.now() - routeStartTime,
          };
        } catch (error) {
          return {
            ...route,
            error: error instanceof Error ? error.message : String(error),
            responseTime: Date.now() - routeStartTime,
          };
        }
      })
    );

    const failedRoutes = results.filter(
      r => r.error || r.actualStatus !== r.expectedStatus
    );

    if (failedRoutes.length === 0) {
      return {
        name: 'API Routes Accessibility',
        status: 'pass',
        message: `All ${routes.length} API routes are accessible`,
        details: { routes: results },
        duration: Date.now() - startTime,
      };
    } else {
      return {
        name: 'API Routes Accessibility',
        status: 'fail',
        message: `${failedRoutes.length}/${routes.length} API routes failed`,
        details: { routes: results, failedRoutes },
        error: failedRoutes.map(r => `${r.path}: ${r.error || `Expected ${r.expectedStatus}, got ${r.actualStatus}`}`).join('; '),
        duration: Date.now() - startTime,
      };
    }
  } catch (error) {
    return {
      name: 'API Routes Accessibility',
      status: 'fail',
      message: 'Failed to check API routes',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Check page accessibility
 */
export async function checkPageAccessibility(): Promise<CheckResult> {
  const startTime = Date.now();

  const pages = [
    { path: '/', name: 'Home' },
    { path: '/login', name: 'Login' },
  ];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const results = await Promise.all(
      pages.map(async (page) => {
        try {
          const response = await fetch(`${baseUrl}${page.path}`, {
            signal: AbortSignal.timeout(5000),
          });

          return {
            ...page,
            status: response.status,
            accessible: response.status === 200 || response.status === 304,
          };
        } catch (error) {
          return {
            ...page,
            status: 0,
            accessible: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );

    const inaccessiblePages = results.filter(p => !p.accessible);

    if (inaccessiblePages.length === 0) {
      return {
        name: 'Page Accessibility',
        status: 'pass',
        message: `All ${pages.length} pages are accessible`,
        details: { pages: results },
        duration: Date.now() - startTime,
      };
    } else {
      return {
        name: 'Page Accessibility',
        status: 'fail',
        message: `${inaccessiblePages.length}/${pages.length} pages are inaccessible`,
        details: { pages: results, inaccessiblePages },
        error: inaccessiblePages.map(p => `${p.name} (${p.path})`).join(', '),
        duration: Date.now() - startTime,
      };
    }
  } catch (error) {
    return {
      name: 'Page Accessibility',
      status: 'fail',
      message: 'Failed to check page accessibility',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Check build configuration
 */
export async function checkBuildConfig(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    const { readFile } = await import('fs/promises');
    const { join } = await import('path');

    const configPath = join(process.cwd(), 'next.config.ts');
    const configContent = await readFile(configPath, 'utf-8');

    const issues: string[] = [];

    // Check for ignoreBuildErrors
    if (configContent.includes('ignoreBuildErrors: true')) {
      issues.push('ignoreBuildErrors is set to true (should be false in production)');
    }

    // Check for ignoreDuringBuilds
    if (configContent.includes('ignoreDuringBuilds: true')) {
      issues.push('ignoreDuringBuilds is set to true (should be false in production)');
    }

    if (issues.length === 0) {
      return {
        name: 'Build Configuration',
        status: 'pass',
        message: 'Build configuration is correct',
        duration: Date.now() - startTime,
      };
    } else {
      return {
        name: 'Build Configuration',
        status: 'warn',
        message: `Build configuration has ${issues.length} issue(s)`,
        details: { issues },
        error: issues.join('; '),
        duration: Date.now() - startTime,
      };
    }
  } catch (error) {
    return {
      name: 'Build Configuration',
      status: 'skip',
      message: 'Could not read build configuration',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Run all frontend checks
 */
export async function runFrontendAudit(): Promise<CheckResult[]> {
  return await Promise.all([
    checkDeploymentStatus(),
    checkAPIRoutes(),
    checkPageAccessibility(),
    checkBuildConfig(),
  ]);
}
