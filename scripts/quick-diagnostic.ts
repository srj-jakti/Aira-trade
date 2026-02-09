#!/usr/bin/env tsx
/**
 * Quick Diagnostic Script - Immediate System Health Check
 * Provides rapid feedback on critical system components
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface DiagnosticResult {
  component: string;
  status: '✓' | '✗' | '⚠';
  message: string;
  details?: string;
}

const results: DiagnosticResult[] = [];

async function checkEnvironmentVariables() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ENCRYPTION_KEY',
    'REDIS_URL',
    'CRON_SECRET'
  ];

  const missing = required.filter(v => !process.env[v]);
  
  if (missing.length === 0) {
    results.push({
      component: 'Environment Variables',
      status: '✓',
      message: 'All required variables configured'
    });
  } else {
    results.push({
      component: 'Environment Variables',
      status: '✗',
      message: `Missing: ${missing.join(', ')}`,
      details: 'Check .env.local file'
    });
  }
}

async function checkSupabase() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    
    if (error) throw error;

    results.push({
      component: 'Supabase Database',
      status: '✓',
      message: 'Connected successfully'
    });
  } catch (error: any) {
    results.push({
      component: 'Supabase Database',
      status: '✗',
      message: 'Connection failed',
      details: error.message
    });
  }
}

async function checkRedis() {
  let redis: Redis | null = null;
  try {
    redis = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000
    });

    await redis.ping();
    
    results.push({
      component: 'Redis Cache',
      status: '✓',
      message: 'Connected successfully'
    });
  } catch (error: any) {
    results.push({
      component: 'Redis Cache',
      status: '✗',
      message: 'Connection failed',
      details: error.message.includes('ECONNREFUSED') ? 'Redis service not running' : error.message
    });
  } finally {
    if (redis) await redis.quit();
  }
}

async function checkRailway() {
  try {
    const { stdout } = await execAsync('railway status');
    
    if (stdout.includes('Project:')) {
      results.push({
        component: 'Railway CLI',
        status: '✓',
        message: 'Connected to project',
        details: stdout.split('\n').slice(0, 3).join(' | ')
      });
    } else {
      results.push({
        component: 'Railway CLI',
        status: '⚠',
        message: 'Not linked to project',
        details: 'Run: railway link'
      });
    }
  } catch (error: any) {
    results.push({
      component: 'Railway CLI',
      status: '✗',
      message: 'Not installed or not in PATH',
      details: 'Install from: https://docs.railway.app/develop/cli'
    });
  }
}

async function checkVercel() {
  try {
    const { stdout } = await execAsync('vercel --version');
    results.push({
      component: 'Vercel CLI',
      status: '✓',
      message: `Installed (${stdout.trim()})`,
    });
  } catch (error) {
    results.push({
      component: 'Vercel CLI',
      status: '⚠',
      message: 'Not installed',
      details: 'Install with: npm i -g vercel'
    });
  }
}

async function checkBuild() {
  try {
    const { stdout, stderr } = await execAsync('npm run lint', { timeout: 30000 });
    const errorMatch = stdout.match(/(\d+) problems \((\d+) errors?, (\d+) warnings?\)/);
    
    if (errorMatch) {
      const [, total, errors, warnings] = errorMatch;
      if (parseInt(errors) === 0) {
        results.push({
          component: 'Code Quality (ESLint)',
          status: '✓',
          message: `${warnings} warnings, 0 errors`
        });
      } else {
        results.push({
          component: 'Code Quality (ESLint)',
          status: '✗',
          message: `${errors} errors, ${warnings} warnings`,
          details: 'Run: npm run lint'
        });
      }
    }
  } catch (error: any) {
    results.push({
      component: 'Code Quality (ESLint)',
      status: '⚠',
      message: 'Could not run linter',
      details: error.message
    });
  }
}

async function checkRailwayServices() {
  try {
    const { stdout } = await execAsync('railway status');
    
    // Try to get service list
    try {
      const { stdout: serviceList } = await execAsync('railway service list');
      results.push({
        component: 'Railway Services',
        status: '✓',
        message: 'Services configured',
        details: serviceList.trim()
      });
    } catch {
      results.push({
        component: 'Railway Services',
        status: '⚠',
        message: 'Could not list services',
        details: 'Check Railway dashboard'
      });
    }
  } catch (error) {
    results.push({
      component: 'Railway Services',
      status: '✗',
      message: 'Not connected',
      details: 'Run: railway link'
    });
  }
}

async function main() {
  console.log('\n🔍 AiRA System Quick Diagnostic\n');
  console.log('═'.repeat(60));
  
  await checkEnvironmentVariables();
  await checkSupabase();
  await checkRedis();
  await checkRailway();
  await checkRailwayServices();
  await checkVercel();
  await checkBuild();
  
  console.log('\n📊 Results:\n');
  
  for (const result of results) {
    console.log(`${result.status} ${result.component}`);
    console.log(`  ${result.message}`);
    if (result.details) {
      console.log(`  ℹ ${result.details}`);
    }
    console.log('');
  }
  
  console.log('═'.repeat(60));
  
  const passed = results.filter(r => r.status === '✓').length;
  const failed = results.filter(r => r.status === '✗').length;
  const warnings = results.filter(r => r.status === '⚠').length;
  
  console.log(`\n✓ Passed: ${passed} | ✗ Failed: ${failed} | ⚠ Warnings: ${warnings}\n`);
  
  if (failed > 0) {
    console.log('❌ Critical issues detected. Review failed components above.\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('⚠️  System operational with warnings.\n');
    process.exit(0);
  } else {
    console.log('✅ All systems operational!\n');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error during diagnostic:', error);
  process.exit(2);
});
