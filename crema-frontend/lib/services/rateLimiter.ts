/**
 * Simple in-memory rate limiter for API routes.
 * Note: For production, use Redis-based rate limiting instead.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  maxRequests: 5,
  windowSeconds: 60,
};

/**
 * Rate limiter that checks if a given key has exceeded the request limit.
 * Returns an object with `allowed` boolean and response headers.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = DEFAULT_OPTIONS,
): { allowed: boolean; headers: Record<string, string> } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    // First request or window expired — reset
    store.set(key, {
      count: 1,
      resetAt: now + options.windowSeconds * 1000,
    });
    return {
      allowed: true,
      headers: {
        "X-RateLimit-Limit": String(options.maxRequests),
        "X-RateLimit-Remaining": String(options.maxRequests - 1),
        "X-RateLimit-Reset": String(Math.ceil((now + options.windowSeconds * 1000) / 1000)),
      },
    };
  }

  // Increment count
  entry.count += 1;
  const remaining = Math.max(0, options.maxRequests - entry.count);
  const allowed = entry.count <= options.maxRequests;

  return {
    allowed,
    headers: {
      "X-RateLimit-Limit": String(options.maxRequests),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
    },
  };
}
