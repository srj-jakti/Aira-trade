interface RateLimitBucket {
  count: number;
  resetAt: number;
}

class ZerodhaRateLimiter {
  private static instance: ZerodhaRateLimiter;
  private buckets: Map<string, RateLimitBucket> = new Map();
  private readonly maxRequestsPerSecond = 10;
  private readonly windowMs = 1000;
  private queue: Map<string, Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }>> = new Map();
  private processing: Set<string> = new Set();

  private constructor() {}

  static getInstance(): ZerodhaRateLimiter {
    if (!ZerodhaRateLimiter.instance) {
      ZerodhaRateLimiter.instance = new ZerodhaRateLimiter();
    }
    return ZerodhaRateLimiter.instance;
  }

  async throttle(apiKey: string): Promise<void> {
    const now = Date.now();
    let bucket = this.buckets.get(apiKey);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(apiKey, bucket);
    }

    if (bucket.count < this.maxRequestsPerSecond) {
      bucket.count++;
      return;
    }

    const waitTime = bucket.resetAt - now;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    return this.throttle(apiKey);
  }

  async enqueue<T>(apiKey: string, fn: () => Promise<T>): Promise<T> {
    await this.throttle(apiKey);
    return fn();
  }

  async throttleAndExecute<T>(
    apiKey: string,
    fn: () => Promise<T>,
    options?: { 
      maxRetries?: number; 
      retryDelay?: number;
    }
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? 3;
    const retryDelay = options?.retryDelay ?? 1000;
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.throttle(apiKey);
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (this.isRateLimitError(error)) {
          const backoff = Math.min(retryDelay * Math.pow(2, attempt), 30000);
          console.warn(`[RateLimiter] Rate limit hit for ${apiKey}, backing off ${backoff}ms`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError || new Error("Max retries exceeded");
  }

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("rate limit") ||
        message.includes("too many requests") ||
        message.includes("429")
      );
    }
    return false;
  }

  getUsage(apiKey: string): { count: number; limit: number; resetIn: number } {
    const bucket = this.buckets.get(apiKey);
    const now = Date.now();
    
    if (!bucket || now >= bucket.resetAt) {
      return { count: 0, limit: this.maxRequestsPerSecond, resetIn: 0 };
    }
    
    return {
      count: bucket.count,
      limit: this.maxRequestsPerSecond,
      resetIn: bucket.resetAt - now,
    };
  }

  reset(apiKey?: string): void {
    if (apiKey) {
      this.buckets.delete(apiKey);
    } else {
      this.buckets.clear();
    }
  }
}

export const zerodhaRateLimiter = ZerodhaRateLimiter.getInstance();

export async function rateLimitedFetch(
  apiKey: string,
  url: string,
  options?: RequestInit
): Promise<Response> {
  return zerodhaRateLimiter.throttleAndExecute(apiKey, () => fetch(url, options));
}
