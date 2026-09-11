<?php

/**
 * MySQL advisory lock wrapper, gating the one call site
 * ({@see FrakWebhookCron::run()}).
 *
 * `GET_LOCK()` is session-scoped: the lock releases on `RELEASE_LOCK()` or when
 * the session ends, so a crashed cron drainer never wedges it. Lock names carry
 * a `frak_` prefix because the namespace is server-wide, not per-database.
 */
class FrakLock
{
    /**
     * Prefix prepended to every lock name. Defends against accidental
     * collisions with other modules' locks on the same MySQL instance —
     * the GET_LOCK namespace is server-wide.
     */
    private const NAME_PREFIX = 'frak_';

    /**
     * Try to acquire the lock. Non-blocking by default: returns `false`
     * immediately if another session holds it. `$waitSeconds > 0` waits
     * up to that duration before giving up.
     *
     * `Db::getValue()` returns `'1'` (acquired), `'0'` (timed out /
     * busy), or `null` (server error). We treat anything other than `'1'`
     * as failure so a misbehaving driver never silently grants the lock.
     */
    public static function acquire(string $key, int $waitSeconds = 0): bool
    {
        $name = self::NAME_PREFIX . $key;
        $result = Db::getInstance()->getValue(
            "SELECT GET_LOCK('" . pSQL($name) . "', " . max(0, (int) $waitSeconds) . ')'
        );
        return (string) $result === '1';
    }

    /**
     * Release a previously-acquired lock. Idempotent: releasing an
     * unheld lock is a no-op (returns `false` but doesn't throw).
     *
     * Production callers always pair `acquire()` with `release()` in
     * a `try/finally`. The lock would auto-release on connection close
     * regardless, but the explicit release lets a follow-up tick on the
     * same long-running PHP-FPM worker re-acquire without waiting for
     * the connection to recycle.
     */
    public static function release(string $key): bool
    {
        $name = self::NAME_PREFIX . $key;
        $result = Db::getInstance()->getValue(
            "SELECT RELEASE_LOCK('" . pSQL($name) . "')"
        );
        return (string) $result === '1';
    }
}
