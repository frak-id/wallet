<?php

/**
 * Cross-cutting infrastructure facade.
 *
 * After the DIY refactor, the module no longer carries Doctrine DBAL,
 * Symfony Cache, or Symfony Lock — they were replaced by:
 *   - {@see FrakCache}                — key/value via PS's `\Db`.
 *   - {@see FrakLock}                 — MySQL `GET_LOCK` advisory lock.
 *   - PrestaShop's native `\Db::getInstance()` — queue I/O.
 *
 * Schema lifecycle now lives entirely in `sql/install.php` /
 * `sql/uninstall.php` (one place to add a table).
 *
 * This class survives as a coordination shell so the cron drainer's
 * housekeeping hook and the test-only `resetAll()` helper read the
 * same as before — keeps the call sites in {@see FrakWebhookCron} and
 * the unit suite stable across the refactor.
 */
class FrakInfra
{
    /**
     * Opportunistic GC of the cache table. Called from
     * {@see FrakWebhookCron::run()} once per tick — cheap `DELETE` on
     * the indexed `expires_at` column keeps `frak_cache` bounded across
     * long-running shops with high webhook-failure rates that
     * accumulate negative-cache rows faster than ad-hoc reads sweep
     * them. Once per cron tick (~5 min) is the right cadence: more
     * often would be wasted work, less often risks unbounded growth.
     *
     * No lock-store GC anymore: {@see FrakLock} uses MySQL session
     * locks which auto-release on connection close, so there's nothing
     * to prune.
     */
    public static function housekeeping(): void
    {
        FrakCache::prune();
    }

    /**
     * Drain every per-request memo across the module. Test-only
     * helper — lets PHPUnit cases that mutate underlying Configuration
     * / DB state mid-run force every static cache to rebuild on next
     * read in one call instead of remembering each class's individual
     * `resetCache()` surface.
     */
    public static function resetAll(): void
    {
        FrakHttpClient::reset();
        FrakUtils::resetCache();
        FrakWebhookHelper::resetCache();
        FrakPlacementRegistry::resetCache();
    }
}
