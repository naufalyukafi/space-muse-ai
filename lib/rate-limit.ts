// In-memory rate limiting implementation for the Next.js API routes.
// Limitation: Since this rate limit uses a module-level Map, it is stored in-memory
// and is scoped only to a single Vercel function instance/container. It will not
// be shared across multiple serverless instances.
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 5;
  const cutoff = now - windowMs;

  const timestamps = rateLimitMap.get(userId) || [];

  // Filter out timestamps older than 60 seconds
  const activeTimestamps = timestamps.filter((t) => t > cutoff);

  if (activeTimestamps.length >= maxRequests) {
    const oldestEntry = activeTimestamps[0];
    const retryAfter = Math.max(1, Math.ceil((oldestEntry + windowMs - now) / 1000));

    // Save the filtered timestamps to avoid memory growth on this user
    rateLimitMap.set(userId, activeTimestamps);

    return {
      allowed: false,
      retryAfter,
    };
  }

  // Push current timestamp for the allowed request
  activeTimestamps.push(now);
  rateLimitMap.set(userId, activeTimestamps);

  // Cap the Map at 500 entries total (evict oldest entry by insertion order when over limit)
  if (rateLimitMap.size > 500) {
    const oldestKey = rateLimitMap.keys().next().value;
    if (oldestKey !== undefined) {
      rateLimitMap.delete(oldestKey);
    }
  }

  return {
    allowed: true,
  };
}
