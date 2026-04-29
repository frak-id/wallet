<?php

/**
 * Tiny key/value cache backed by `{prefix}frak_cache`.
 *
 * Replaces the Symfony Cache `DoctrineDbalAdapter` used in the 1.0.1 dev
 * iteration — that adapter dragged in `symfony/cache` (820K) +
 * `symfony/var-exporter` (180K) + `doctrine/dbal` (1.9M) plus transitive
 * deps just to surface 4 calls (`getItem` / `save` / `hasItem` /
 * `deleteItem`) from {@see FrakMerchantResolver}.
 *
 * Cache surface in this module:
 *   - `merchant.{host}` — resolved merchant record (no expiry; merchant
 *     UUIDs are immutable per domain, the resolver self-invalidates via
 *     a `domain === host` check on read).
 *   - `merchant_unresolved.{host}` — 5-minute negative-cache sentinel
 *     so unresolved or staging domains don't hammer the backend between
 *     webhook retries.
 *
 * Schema/access patterns optimised for that surface:
 *   - 2 keys per host. Short values. No tag / namespace ceremony.
 *   - Reads hit the `(cache_key)` primary key — `O(1)` even at scale.
 *   - Expiry via integer `expires_at` + indexed sweep in {@see prune()}.
 *
 * Values are JSON-encoded (vs `serialize()`) so the table is
 * human-readable from any MySQL client and decoding never triggers
 * PHP class loading. Sufficient for the structured-data shapes we
 * cache (associative arrays + booleans).
 *
 * Uses PrestaShop's native `\Db::getInstance()` so the per-request
 * MySQL connection count stays at PS's native one — no separate
 * Doctrine DBAL connection.
 */
class FrakCache
{
    /** MySQL table name (without prefix). Created by `sql/install.php`. */
    public const TABLE = 'frak_cache';

    /**
     * Read a cache entry. Returns `null` when the key is missing,
     * expired, or the stored value cannot be decoded.
     *
     * Expiry is checked client-side via `expires_at <= time()` so a
     * stale row that hasn't been GC'd yet by {@see prune()} still
     * returns `null` to the caller.
     *
     * @return mixed The decoded value, or null when missing/expired.
     */
    public static function get(string $key)
    {
        $row = Db::getInstance()->getRow(
            'SELECT `cache_value`, `expires_at`'
            . ' FROM `' . _DB_PREFIX_ . self::TABLE . '`'
            . " WHERE `cache_key` = '" . pSQL($key) . "'"
        );
        if (!is_array($row)) {
            return null;
        }
        $expires_at = $row['expires_at'] ?? null;
        if ($expires_at !== null && $expires_at !== '' && (int) $expires_at <= time()) {
            return null;
        }
        $decoded = json_decode((string) $row['cache_value'], true);
        return $decoded;
    }

    /**
     * Upsert a cache entry. `$ttlSeconds = null` means no expiry — used
     * by the merchant resolver for the positive-cache record because
     * merchant UUIDs are immutable per domain.
     *
     * Encodes via `json_encode` so reads can decode without triggering
     * PHP class loading. Returns `false` if the value is not
     * JSON-encodable (callers store arrays/scalars only, so this branch
     * is defensive).
     */
    public static function set(string $key, $value, ?int $ttlSeconds = null): bool
    {
        $encoded = json_encode($value);
        if ($encoded === false) {
            return false;
        }
        $expires_at_sql = $ttlSeconds !== null ? (string) (time() + (int) $ttlSeconds) : 'NULL';
        $key_sql = pSQL($key);
        // html_ok=true: pSQL would otherwise call htmlentitiesUTF8() and
        // mangle JSON's `<` / `>` / `&` / `"` literals — corrupting the
        // round-trip. We only need backslash + apostrophe escaping for
        // SQL string-literal safety, which `html_ok=true` still does.
        $value_sql = pSQL($encoded, true);
        $sql = 'INSERT INTO `' . _DB_PREFIX_ . self::TABLE . '`'
            . ' (`cache_key`, `cache_value`, `expires_at`)'
            . " VALUES ('" . $key_sql . "', '" . $value_sql . "', " . $expires_at_sql . ')'
            . ' ON DUPLICATE KEY UPDATE'
            . " `cache_value` = '" . $value_sql . "',"
            . ' `expires_at` = ' . $expires_at_sql;
        return (bool) Db::getInstance()->execute($sql);
    }

    /**
     * Test whether a cache key exists AND is not expired. Cheaper
     * shorthand for `get($key) !== null` for callers that don't need
     * the value (e.g. negative-cache sentinel checks).
     */
    public static function has(string $key): bool
    {
        return self::get($key) !== null;
    }

    /**
     * Delete a cache entry. Idempotent: deleting a missing key is a
     * no-op (returns false but doesn't throw).
     */
    public static function delete(string $key): bool
    {
        return (bool) Db::getInstance()->delete(
            self::TABLE,
            "`cache_key` = '" . pSQL($key) . "'"
        );
    }

    /**
     * Garbage-collect expired rows. Called once per cron tick by
     * {@see FrakInfra::housekeeping()} — cheap `DELETE` on the indexed
     * `expires_at` column keeps the table bounded across long-running
     * shops with high webhook-failure rates that accumulate
     * negative-cache rows faster than ad-hoc reads sweep them.
     */
    public static function prune(): bool
    {
        $sql = 'DELETE FROM `' . _DB_PREFIX_ . self::TABLE . '`'
            . ' WHERE `expires_at` IS NOT NULL AND `expires_at` <= ' . time();
        return (bool) Db::getInstance()->execute($sql);
    }
}
