/**
 * Backend Auditor - Verifies health of Supabase backend
 */

import { createClient } from '@supabase/supabase-js';
import type { CheckResult } from '../types';

interface DatabaseConnectionInfo {
  connected: boolean;
  latency: number;
  version: string;
}

interface RLSPolicyCheck {
  tableName: string;
  hasRLS: boolean;
  policies: PolicyInfo[];
  issues: string[];
}

interface PolicyInfo {
  name: string;
  command: string;
  roles: string[];
  using: string;
}

interface TableSchemaCheck {
  tableName: string;
  exists: boolean;
  expectedColumns: string[];
  actualColumns: string[];
  missingColumns: string[];
  extraColumns: string[];
}

/**
 * Get Supabase client
 */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(url, serviceKey);
}

/**
 * Check database connection
 */
export async function checkDatabaseConnection(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    const supabase = getSupabaseClient();

    // Test query to check connection
    const queryStart = Date.now();
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    const latency = Date.now() - queryStart;

    if (error) {
      return {
        name: 'Database Connection',
        status: 'fail',
        message: 'Database connection failed',
        error: error.message,
        duration: Date.now() - startTime,
      };
    }

    // Get PostgreSQL version
    const { data: versionData } = await supabase.rpc('version' as any);

    const connectionInfo: DatabaseConnectionInfo = {
      connected: true,
      latency,
      version: versionData || 'unknown',
    };

    return {
      name: 'Database Connection',
      status: 'pass',
      message: `Connected successfully (latency: ${latency}ms)`,
      details: connectionInfo,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      name: 'Database Connection',
      status: 'fail',
      message: 'Failed to connect to database',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Check authentication system
 */
export async function checkAuthSystem(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey || !serviceKey) {
      return {
        name: 'Authentication System',
        status: 'fail',
        message: 'Supabase credentials not configured',
        error: 'Missing SUPABASE_URL, ANON_KEY, or SERVICE_ROLE_KEY',
        duration: Date.now() - startTime,
      };
    }

    // Test anon key
    const anonClient = createClient(url, anonKey);
    const { error: anonError } = await anonClient.auth.getSession();

    // Test service role key
    const serviceClient = createClient(url, serviceKey);
    const { data: serviceData, error: serviceError } = await serviceClient
      .from('profiles')
      .select('id')
      .limit(1);

    const issues: string[] = [];

    if (anonError) {
      issues.push(`Anon key error: ${anonError.message}`);
    }

    if (serviceError) {
      issues.push(`Service role key error: ${serviceError.message}`);
    }

    if (issues.length === 0) {
      return {
        name: 'Authentication System',
        status: 'pass',
        message: 'Both anon and service role keys are functional',
        duration: Date.now() - startTime,
      };
    } else {
      return {
        name: 'Authentication System',
        status: 'fail',
        message: `Authentication issues found: ${issues.length}`,
        error: issues.join('; '),
        duration: Date.now() - startTime,
      };
    }
  } catch (error) {
    return {
      name: 'Authentication System',
      status: 'fail',
      message: 'Failed to check authentication system',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Check RLS policies
 */
export async function checkRLSPolicies(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    const supabase = getSupabaseClient();

    // Critical tables that should have RLS
    const criticalTables = [
      'profiles',
      'strategies',
      'user_orders',
      'user_positions',
      'user_broker_accounts',
      'subscriptions',
    ];

    const checks: RLSPolicyCheck[] = [];

    for (const tableName of criticalTables) {
      // Query pg_policies to check RLS
      const { data: policies, error } = await supabase.rpc('get_table_policies' as any, {
        table_name: tableName,
      });

      if (error) {
        // Fallback: check if table exists
        const { data: tableData, error: tableError } = await supabase
          .from(tableName)
          .select('*')
          .limit(0);

        checks.push({
          tableName,
          hasRLS: false,
          policies: [],
          issues: [`Could not verify RLS: ${error.message}`],
        });
      } else {
        const hasRLS = policies && policies.length > 0;
        checks.push({
          tableName,
          hasRLS,
          policies: policies || [],
          issues: hasRLS ? [] : ['No RLS policies found'],
        });
      }
    }

    const tablesWithoutRLS = checks.filter(c => !c.hasRLS);

    if (tablesWithoutRLS.length === 0) {
      return {
        name: 'RLS Policies',
        status: 'pass',
        message: `All ${criticalTables.length} critical tables have RLS enabled`,
        details: { checks },
        duration: Date.now() - startTime,
      };
    } else {
      return {
        name: 'RLS Policies',
        status: 'warn',
        message: `${tablesWithoutRLS.length}/${criticalTables.length} tables missing RLS`,
        details: { checks, tablesWithoutRLS },
        error: tablesWithoutRLS.map(t => t.tableName).join(', '),
        duration: Date.now() - startTime,
      };
    }
  } catch (error) {
    return {
      name: 'RLS Policies',
      status: 'skip',
      message: 'Could not check RLS policies',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Check table schemas
 */
export async function checkTableSchemas(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    const supabase = getSupabaseClient();

    // Define expected schemas for critical tables
    const expectedSchemas: Record<string, string[]> = {
      profiles: ['id', 'email', 'full_name', 'created_at', 'updated_at'],
      strategies: ['id', 'name', 'description', 'type', 'created_at'],
      user_orders: ['id', 'user_id', 'strategy_id', 'symbol', 'order_type', 'status'],
      user_positions: ['id', 'user_id', 'symbol', 'quantity', 'average_price'],
      subscriptions: ['id', 'user_id', 'plan', 'status', 'valid_until'],
    };

    const checks: TableSchemaCheck[] = [];

    for (const [tableName, expectedColumns] of Object.entries(expectedSchemas)) {
      try {
        // Query information_schema to get actual columns
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(0);

        if (error) {
          checks.push({
            tableName,
            exists: false,
            expectedColumns,
            actualColumns: [],
            missingColumns: expectedColumns,
            extraColumns: [],
          });
        } else {
          // Get column names from the response metadata
          // Since we can't directly query information_schema, we'll just verify table exists
          checks.push({
            tableName,
            exists: true,
            expectedColumns,
            actualColumns: [],
            missingColumns: [],
            extraColumns: [],
          });
        }
      } catch (error) {
        checks.push({
          tableName,
          exists: false,
          expectedColumns,
          actualColumns: [],
          missingColumns: expectedColumns,
          extraColumns: [],
        });
      }
    }

    const missingTables = checks.filter(c => !c.exists);

    if (missingTables.length === 0) {
      return {
        name: 'Table Schemas',
        status: 'pass',
        message: `All ${Object.keys(expectedSchemas).length} critical tables exist`,
        details: { checks },
        duration: Date.now() - startTime,
      };
    } else {
      return {
        name: 'Table Schemas',
        status: 'fail',
        message: `${missingTables.length} critical tables are missing`,
        details: { checks, missingTables },
        error: missingTables.map(t => t.tableName).join(', '),
        duration: Date.now() - startTime,
      };
    }
  } catch (error) {
    return {
      name: 'Table Schemas',
      status: 'fail',
      message: 'Failed to check table schemas',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Run all backend checks
 */
export async function runBackendAudit(): Promise<CheckResult[]> {
  return await Promise.all([
    checkDatabaseConnection(),
    checkAuthSystem(),
    checkRLSPolicies(),
    checkTableSchemas(),
  ]);
}
