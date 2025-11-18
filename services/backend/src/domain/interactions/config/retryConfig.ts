export const RETRY_CONFIG = {
    no_session: {
        maxAttempts: 30,
        initialDelay: 12 * 60 * 60 * 1000, // 12 hours
        backoffMultiplier: 2,
        maxDelay: 48 * 60 * 60 * 1000, // 48 hours max
    },
    failed: {
        maxAttempts: 30,
        initialDelay: 3 * 60 * 60 * 1000, // 3 hours
        backoffMultiplier: 2,
        maxDelay: 48 * 60 * 60 * 1000, // 48 hours max
    },
    execution_failed: {
        maxAttempts: 50,
        initialDelay: 2 * 60 * 1000, // 2 minutes
        backoffMultiplier: 2,
        maxDelay: 60 * 60 * 1000, // 1 hour max
    },
} as const;

export type RetryStatus = keyof typeof RETRY_CONFIG;

/**
 * Calculate next retry time with exponential backoff
 */
export function calculateNextRetry(
    status: RetryStatus,
    retryCount: number
): Date {
    const config = RETRY_CONFIG[status];

    const delay = Math.min(
        config.initialDelay * config.backoffMultiplier ** (retryCount - 1),
        config.maxDelay
    );

    return new Date(Date.now() + delay);
}

/**
 * Check if interaction has exceeded max retry attempts
 */
export function hasExceededMaxRetries(
    status: RetryStatus,
    retryCount: number
): boolean {
    const config = RETRY_CONFIG[status];
    return retryCount > config.maxAttempts;
}
