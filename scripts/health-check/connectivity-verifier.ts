/**
 * Connectivity Verifier - Tests network connections between services
 */

import type { CheckResult } from './types';

interface ConnectivityTest {
  service: string;
  target: string;
  status: 'connected' | 'failed' | 'timeout';
  responseTime?: number;
  error?: string;
}

/**
 * Test connectivity to a service
 */
async function testConnection(
  service: string,
  url: string,
  timeout: number = 5000
): Promise<ConnectivityTest> {
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeout),
    });

    const responseTime = Date.now() - startTime;

    return {
      service,
      target: url,
      status: response.ok ? 'connected' : 'failed',
      responseTime,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    if (error instanceof Error && error.name === 'TimeoutError') {
      return {
        service,
        target: url,
        status: 'timeout',
        responseTime,
        error: 'Connection timeout',
      };
    }

    return {
      service,
      target: url,
      status: 'failed',
      responseTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run connectivity test suite
 */
export async function runConnectivityTests(): Promise<CheckResult> {
  const startTime = Date.now();

  const tests: ConnectivityTest[] = [];

  // Test Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    tests.push(await testConnection('Supabase', `${supabaseUrl}/rest/v1/`, 2000));
  }

  // Test Frontend
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    tests.push(await testConnection('Frontend', appUrl, 5000));
  }

  // Test Redis (can't test via HTTP, would need Redis client)
  // Skipped for now

  const failedTests = tests.filter(t => t.status === 'failed' || t.status === 'timeout');
  const slowTests = tests.filter(t => t.responseTime && t.responseTime > 2000);

  if (failedTests.length === 0 && slowTests.length === 0) {
    return {
      name: 'Connectivity Tests',
      status: 'pass',
      message: `All ${tests.length} connectivity tests passed`,
      details: { tests },
      duration: Date.now() - startTime,
    };
  } else if (failedTests.length > 0) {
    return {
      name: 'Connectivity Tests',
      status: 'fail',
      message: `${failedTests.length}/${tests.length} connectivity tests failed`,
      details: { tests, failedTests },
      error: failedTests.map(t => `${t.service}: ${t.error}`).join('; '),
      duration: Date.now() - startTime,
    };
  } else {
    return {
      name: 'Connectivity Tests',
      status: 'warn',
      message: `${slowTests.length} services have slow response times`,
      details: { tests, slowTests },
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Generate connectivity matrix
 */
export function generateConnectivityMatrix(tests: ConnectivityTest[]): string {
  const lines: string[] = [];

  lines.push('## Connectivity Matrix\n');
  lines.push('| Service | Target | Status | Response Time |');
  lines.push('|---------|--------|--------|---------------|');

  for (const test of tests) {
    const status = test.status === 'connected' ? '✅' : '❌';
    const responseTime = test.responseTime ? `${test.responseTime}ms` : 'N/A';
    lines.push(`| ${test.service} | ${test.target} | ${status} | ${responseTime} |`);
  }

  return lines.join('\n');
}
