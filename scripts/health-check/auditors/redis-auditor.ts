/**
 * Redis Auditor - Verifies Redis connectivity and operational status
 */

import Redis from 'ioredis';
import type { CheckResult } from '../types';

interface RedisConnectionInfo {
  connected: boolean;
  host: string;
  port: number;
  latency: number;
  version: string;
}

interface RedisOperationCheck {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  testKey: string;
  error?: string;
}

interface RedisServerInfo {
  version: string;
  uptime: number;
  connectedClients: number;
  usedMemory: number;
  maxMemory: number;
  memoryUsagePercent: number;
}

/**
 * Create Redis client
 */
function createRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return null;
  }

  try {
    return new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 100, 2000);
      },
    });
  } catch (error) {
    console.error('Error creating Redis client:', error);
    return null;
  }
}

/**
 * Check Redis connection
 */
export async function checkConnection(): Promise<CheckResult> {
  const startTime = Date.now();
  let client: Redis | null = null;

  try {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      return {
        name: 'Redis Connection',
        status: 'skip',
        message: 'REDIS_URL not configured',
        duration: Date.now() - startTime,
      };
    }

    client = createRedisClient();

    if (!client) {
      return {
        name: 'Redis Connection',
        status: 'fail',
        message: 'Failed to create Redis client',
        duration: Date.now() - startTime,
      };
    }

    // Test connection with PING
    const pingStart = Date.now();
    const pong = await client.ping();
    const latency = Date.now() - pingStart;

    if (pong !== 'PONG') {
      return {
        name: 'Redis Connection',
        status: 'fail',
        message: 'Redis PING failed',
        error: `Expected PONG, got ${pong}`,
        duration: Date.now() - startTime,
      };
    }

    // Get server info
    const info = await client.info('server');
    const versionMatch = info.match(/redis_version:([^\r\n]+)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';

    // Parse connection details from URL
    const url = new URL(redisUrl);

    const connectionInfo: RedisConnectionInfo = {
      connected: true,
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      latency,
      version,
    };

    return {
      name: 'Redis Connection',
      status: 'pass',
      message: `Connected successfully (latency: ${latency}ms)`,
      details: connectionInfo,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      name: 'Redis Connection',
      status: 'fail',
      message: 'Failed to connect to Redis',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  } finally {
    if (client) {
      await client.quit();
    }
  }
}

/**
 * Check Redis operations (SET, GET, DEL)
 */
export async function checkOperations(): Promise<CheckResult> {
  const startTime = Date.now();
  let client: Redis | null = null;

  try {
    client = createRedisClient();

    if (!client) {
      return {
        name: 'Redis Operations',
        status: 'skip',
        message: 'Redis client not available',
        duration: Date.now() - startTime,
      };
    }

    const testKey = `health-check:test:${Date.now()}`;
    const testValue = 'health-check-value';

    const operationCheck: RedisOperationCheck = {
      canRead: false,
      canWrite: false,
      canDelete: false,
      testKey,
    };

    // Test SET
    try {
      await client.set(testKey, testValue, 'EX', 60); // Expire in 60 seconds
      operationCheck.canWrite = true;
    } catch (error) {
      operationCheck.error = `SET failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    // Test GET
    try {
      const value = await client.get(testKey);
      if (value === testValue) {
        operationCheck.canRead = true;
      } else {
        operationCheck.error = `GET returned unexpected value: ${value}`;
      }
    } catch (error) {
      operationCheck.error = `GET failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    // Test DEL
    try {
      await client.del(testKey);
      operationCheck.canDelete = true;
    } catch (error) {
      operationCheck.error = `DEL failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    if (operationCheck.canRead && operationCheck.canWrite && operationCheck.canDelete) {
      return {
        name: 'Redis Operations',
        status: 'pass',
        message: 'All operations (SET, GET, DEL) successful',
        details: operationCheck,
        duration: Date.now() - startTime,
      };
    } else {
      return {
        name: 'Redis Operations',
        status: 'fail',
        message: 'Some Redis operations failed',
        details: operationCheck,
        error: operationCheck.error,
        duration: Date.now() - startTime,
      };
    }
  } catch (error) {
    return {
      name: 'Redis Operations',
      status: 'fail',
      message: 'Failed to test Redis operations',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  } finally {
    if (client) {
      await client.quit();
    }
  }
}

/**
 * Check Redis server info
 */
export async function checkServerInfo(): Promise<CheckResult> {
  const startTime = Date.now();
  let client: Redis | null = null;

  try {
    client = createRedisClient();

    if (!client) {
      return {
        name: 'Redis Server Info',
        status: 'skip',
        message: 'Redis client not available',
        duration: Date.now() - startTime,
      };
    }

    // Get server info
    const serverInfo = await client.info('server');
    const memoryInfo = await client.info('memory');
    const statsInfo = await client.info('stats');

    // Parse version
    const versionMatch = serverInfo.match(/redis_version:([^\r\n]+)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';

    // Parse uptime
    const uptimeMatch = serverInfo.match(/uptime_in_seconds:(\d+)/);
    const uptime = uptimeMatch ? parseInt(uptimeMatch[1]) : 0;

    // Parse memory
    const usedMemoryMatch = memoryInfo.match(/used_memory:(\d+)/);
    const usedMemory = usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0;

    const maxMemoryMatch = memoryInfo.match(/maxmemory:(\d+)/);
    const maxMemory = maxMemoryMatch ? parseInt(maxMemoryMatch[1]) : 0;

    // Parse connected clients
    const clientsMatch = statsInfo.match(/connected_clients:(\d+)/);
    const connectedClients = clientsMatch ? parseInt(clientsMatch[1]) : 0;

    const memoryUsagePercent = maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0;

    const info: RedisServerInfo = {
      version,
      uptime,
      connectedClients,
      usedMemory,
      maxMemory,
      memoryUsagePercent,
    };

    const warnings: string[] = [];

    if (memoryUsagePercent > 90) {
      warnings.push(`High memory usage: ${memoryUsagePercent.toFixed(1)}%`);
    }

    if (connectedClients > 100) {
      warnings.push(`High number of connected clients: ${connectedClients}`);
    }

    if (warnings.length > 0) {
      return {
        name: 'Redis Server Info',
        status: 'warn',
        message: `Server info retrieved with warnings: ${warnings.join(', ')}`,
        details: info,
        duration: Date.now() - startTime,
      };
    }

    return {
      name: 'Redis Server Info',
      status: 'pass',
      message: `Redis ${version} running (uptime: ${Math.floor(uptime / 3600)}h)`,
      details: info,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      name: 'Redis Server Info',
      status: 'fail',
      message: 'Failed to get Redis server info',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  } finally {
    if (client) {
      await client.quit();
    }
  }
}

/**
 * Run all Redis checks
 */
export async function runRedisAudit(): Promise<CheckResult[]> {
  return await Promise.all([
    checkConnection(),
    checkOperations(),
    checkServerInfo(),
  ]);
}
