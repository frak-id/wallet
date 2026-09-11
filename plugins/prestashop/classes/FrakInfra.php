<?php

/**
 * Coordination shell for the module's cross-cutting statics: the cron drainer's
 * housekeeping hook and the test-only {@see resetAll()} helper.
 */
class FrakInfra
{
    /**
     * Opportunistic GC of the cache table, from {@see FrakWebhookCron::run()}
     * once per tick (~5 min): a cheap `DELETE` on the indexed `expires_at`
     * column keeps `frak_cache` bounded on shops whose webhook failures
     * accumulate negative-cache rows faster than ad-hoc reads sweep them.
     */
    public static function housekeeping(): void
    {
        FrakCache::prune();
    }

    /**
     * Drain every per-request memo across the module. Test-only helper, so a
     * PHPUnit case that mutates Configuration / DB state mid-run does not have
     * to remember each class's own `resetCache()`.
     */
    public static function resetAll(): void
    {
        FrakHttpClient::reset();
        FrakUtils::resetCache();
        FrakWebhookHelper::resetCache();
        FrakPlacementRegistry::resetCache();
    }
}
