<?php

/**
 * Custom cache table accessor.
 *
 * Stores arbitrary string blobs against a string key, with optional TTL,
 * outside PrestaShop's autoloaded `ps_configuration` table.
 *
 * Why a custom table and not `Configuration`:
 *   - PrestaShop loads the entire `ps_configuration` table into memory on
 *     every request (front + back office + AJAX). Stuffing a JSON-encoded
 *     merchant record (~1-4 KB) plus a per-host negative-cache timestamp
 *     into that table is dead weight on every page load even though only
 *     the webhook helper and the admin UI ever read it.
 *   - PrestaShop has no `autoload=no` flag (unlike WordPress's
 *     `update_option(..., false)`); a custom table is the only way to keep
 *     non-hot config out of the per-request autoload payload.
 *   - We need a TTL primitive (5-min negative cache, 10-min cron lock); a
 *     dedicated `expires_at` column is cleaner than encoding TTLs into
 *     bespoke Configuration rows and arithmetic at every read site.
 *
 * Mirrors the role of WordPress's Transient API
 * ({@see Frak_Merchant::NEGATIVE_CACHE_KEY} via `set_transient`) — same
 * key/value/TTL contract, same expiration-on-read semantics, same "best
 * effort" durability (callers should never depend on the cache surviving
 * across requests).
 *
 * Schema lives in `sql/install.php` / `sql/uninstall.php` and is
 * provisioned alongside `frak_webhook_queue` so the install lifecycle is
 * symmetric.
 *
 * Per-request memo: every `get()` is memoised in `self::$memo` so repeat
 * lookups within the same PHP process collapse to a single SELECT — keeps
 * the resolver / cron-lock paths cheap when called more than once per
 * request (e.g. admin render + dispatch hook in the same back-office page).
 */
class FrakCache
{
    public const TABLE = 'frak_cache';

    /**
     * Per-request lookup cache. Keyed by cache_key, holds the resolved
     * value (or null for "known miss"). Cleared by `set()` / `delete()` so
     * writes within the same request invalidate the memo.
     *
     * @var array<string, string|null>
     */
    private static array $memo = [];

    /**
     * Read a value by key. Returns `null` for absent and expired rows
     * (lazy expiration: an expired row is dropped on read so we don't need
     * a sweeper cron). Memoised within the request.
     */
    public static function get(string $key): ?string
    {
        if (array_key_exists($key, self::$memo)) {
            return self::$memo[$key];
        }

        $sql = 'SELECT `cache_value`, `expires_at`'
            . ' FROM `' . _DB_PREFIX_ . self::TABLE . '`'
            . ' WHERE `cache_key` = "' . pSQL($key) . '"'
            . ' LIMIT 1';
        $row = Db::getInstance()->getRow($sql);

        if (!is_array($row) || !isset($row['cache_value'])) {
            self::$memo[$key] = null;
            return null;
        }

        $expires_at = $row['expires_at'] ?? null;
        if (is_string($expires_at) && $expires_at !== '' && strtotime($expires_at) <= time()) {
            // Lazy-evict expired rows so the table self-cleans without a sweeper.
            self::delete($key);
            return null;
        }

        $value = (string) $row['cache_value'];
        self::$memo[$key] = $value;
        return $value;
    }

    /**
     * Decode a JSON-encoded cache entry. Returns `null` on miss / expired
     * row / malformed JSON so callers can `?? $default` safely.
     *
     * @return array<mixed>|null
     */
    public static function getJson(string $key): ?array
    {
        $raw = self::get($key);
        if ($raw === null || $raw === '') {
            return null;
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    }

    /**
     * Persist a value. `$ttl` is in seconds; `null` means "no expiry".
     * Atomic via `INSERT ... ON DUPLICATE KEY UPDATE` so concurrent writers
     * never lose a row.
     */
    public static function set(string $key, string $value, ?int $ttl = null): bool
    {
        $expires_clause = $ttl !== null
            ? '"' . pSQL(date('Y-m-d H:i:s', time() + $ttl)) . '"'
            : 'NULL';

        $sql = 'INSERT INTO `' . _DB_PREFIX_ . self::TABLE . '`'
            . ' (`cache_key`, `cache_value`, `expires_at`)'
            . ' VALUES ("' . pSQL($key) . '", "' . pSQL($value, true) . '", ' . $expires_clause . ')'
            . ' ON DUPLICATE KEY UPDATE'
            . ' `cache_value` = VALUES(`cache_value`),'
            . ' `expires_at` = VALUES(`expires_at`)';

        $ok = (bool) Db::getInstance()->execute($sql);
        if ($ok) {
            self::$memo[$key] = $value;
        }
        return $ok;
    }

    /**
     * Persist a JSON-encodable value. Convenience wrapper so the resolver /
     * placement registry don't have to repeat the same encode flags.
     *
     * @param mixed $value
     */
    public static function setJson(string $key, $value, ?int $ttl = null): bool
    {
        $encoded = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($encoded === false) {
            return false;
        }
        return self::set($key, $encoded, $ttl);
    }

    /**
     * Drop a cache row. Idempotent — succeeds even if the key was already
     * absent, mirroring `Configuration::deleteByName()` semantics.
     */
    public static function delete(string $key): bool
    {
        $sql = 'DELETE FROM `' . _DB_PREFIX_ . self::TABLE . '`'
            . ' WHERE `cache_key` = "' . pSQL($key) . '"';
        $ok = (bool) Db::getInstance()->execute($sql);
        self::$memo[$key] = null;
        return $ok;
    }

    /**
     * Acquire a TTL-bounded lock. Returns `true` if the caller is the new
     * holder, `false` if a non-expired lock already exists.
     *
     * Pattern: each acquisition attempt generates a unique sentinel via
     * `random_bytes`. The caller `INSERT IGNORE`s the row with its sentinel
     * as the value, then reads back — only the winner of the race sees
     * its own sentinel persisted. Concurrent acquirers all `INSERT IGNORE`
     * but only the first insert lands; the rest read back the winner's
     * sentinel and bail.
     *
     * Stale locks self-clear via the `expires_at` column — a pre-acquire
     * `DELETE WHERE expires_at <= NOW()` pass evicts any crashed-holder
     * row before the INSERT IGNORE attempts. Used by
     * {@see FrakWebhookCron::run()} to prevent overlapping cron ticks from
     * re-sending rows whose state hasn't been updated yet.
     */
    public static function acquireLock(string $key, int $ttl): bool
    {
        // Nuke any expired holder first so a crashed previous run never
        // wedges the lock for longer than the TTL.
        $cleanup = 'DELETE FROM `' . _DB_PREFIX_ . self::TABLE . '`'
            . ' WHERE `cache_key` = "' . pSQL($key) . '"'
            . ' AND `expires_at` IS NOT NULL'
            . ' AND `expires_at` <= NOW()';
        Db::getInstance()->execute($cleanup);

        // Unique sentinel per attempt — lets the post-INSERT readback tell
        // "I won" from "another caller already held the lock" without
        // depending on `Db::Affected_Rows()` (not uniformly exposed across
        // PrestaShop versions).
        $sentinel = bin2hex(random_bytes(8));
        $expires = date('Y-m-d H:i:s', time() + $ttl);

        $sql = 'INSERT IGNORE INTO `' . _DB_PREFIX_ . self::TABLE . '`'
            . ' (`cache_key`, `cache_value`, `expires_at`)'
            . ' VALUES ("' . pSQL($key) . '", "' . pSQL($sentinel) . '", "' . pSQL($expires) . '")';
        Db::getInstance()->execute($sql);

        // Drop the memo so the readback hits the DB — we MUST observe the
        // post-insert state, not whatever the memo cached before.
        unset(self::$memo[$key]);
        return self::get($key) === $sentinel;
    }

    /**
     * Release a lock previously acquired via {@see acquireLock()}. Safe to
     * call even when the caller no longer holds the lock — the sentinel
     * row is simply removed.
     */
    public static function releaseLock(string $key): void
    {
        self::delete($key);
    }
}
