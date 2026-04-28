<?php

/**
 * Merchant resolver.
 *
 * Owns the lifecycle of the Frak merchant UUID for the current shop:
 *   - Lazy-resolves the shop domain via `GET /user/merchant/resolve`.
 *   - Caches the result forever (merchant UUIDs are immutable per domain).
 *   - Self-invalidates when the host changes (covers domain renames or CDN
 *     origin swaps — no extra hooks needed).
 *   - Short negative cache (5 min) on 4xx/5xx so unresolved or staging
 *     domains do not hammer the backend between webhook retries.
 *
 * Storage:
 *   - `FrakCache:merchant:{host}` — JSON-encoded record, no TTL.
 *   - `FrakCache:merchant_unresolved:{host}` — sentinel row with TTL.
 *
 * Why `FrakCache` instead of `Configuration`:
 *   - PrestaShop autoloads the entire `ps_configuration` table on every
 *     request (front + back office + AJAX). Stuffing a JSON-encoded
 *     merchant record there bloats the autoload payload on every page even
 *     though only the webhook helper and the admin UI ever read it.
 *   - PrestaShop has no `autoload=no` flag (unlike WordPress's
 *     `update_option(..., false)` — see {@see Frak_Merchant} in the WP
 *     sibling). A custom table is the only way to keep cold data cold.
 *   - The negative cache is a TTL-bounded sentinel — the dedicated
 *     `expires_at` column on `frak_cache` matches the semantics directly
 *     instead of forcing every reader to compute the elapsed time off a
 *     stored unix timestamp.
 *
 * Mirrors the WordPress `Frak_Merchant` contract so the two plugins stay
 * conceptually aligned (same record shape, same invalidation triggers).
 */
class FrakMerchantResolver
{
    /** Cache key prefix for the merchant record (suffix is the normalised host). */
    public const CACHE_KEY_PREFIX = 'merchant:';
    /** Cache key prefix for the negative-cache sentinel. */
    public const NEGATIVE_CACHE_PREFIX = 'merchant_unresolved:';
    /** Negative-cache TTL in seconds. Mirrors the WP plugin (5 minutes). */
    public const NEGATIVE_CACHE_TTL = 300;
    public const RESOLVE_URL = 'https://backend.frak.id/user/merchant/resolve';

    /**
     * Configuration keys carried by an unreleased pre-1.0.1 iteration of the
     * module. v1.0.0 / v1.0.1 never shipped, so production v0.0.4 shops
     * never wrote these rows — but local dev shops mid-migration might,
     * and the uninstall + upgrade paths sweep them defensively. Kept as
     * named constants so the cleanup sites are stringly-typed-drift-proof.
     */
    public const LEGACY_CONFIG_KEY = 'FRAK_MERCHANT';
    public const LEGACY_NEGATIVE_CACHE_KEY = 'FRAK_MERCHANT_UNRESOLVED_AT';

    public static function getId(): ?string
    {
        $record = self::getRecord();
        return $record['id'] ?? null;
    }

    /** @return array{id:string,name:string,domain:string,resolved_at:int}|null */
    public static function getRecord(): ?array
    {
        $host = self::currentHost();
        if ($host === '') {
            return null;
        }

        $cached = self::readCachedRecord($host);
        if ($cached !== null && ($cached['domain'] ?? '') === $host) {
            return $cached;
        }

        if (self::isNegativeCacheActive($host)) {
            return null;
        }

        return self::resolve($host);
    }

    /**
     * Drop any cached merchant record. Called by:
     *   - The admin "Refresh" button.
     *   - The webhook dispatcher when the backend replies with an error
     *     indicating the cached UUID no longer maps to a live merchant.
     *
     * Sweeps both the current-host cache entries and the legacy
     * Configuration rows so a partial-upgrade install doesn't end up with
     * two competing sources of truth.
     */
    public static function invalidate(): void
    {
        $host = self::currentHost();
        if ($host !== '') {
            FrakCache::delete(self::CACHE_KEY_PREFIX . $host);
            FrakCache::delete(self::NEGATIVE_CACHE_PREFIX . $host);
        }
        // Pre-1.0.1 dev rows — safe no-op when already cleared by the
        // upgrade migrator. Keeps "Refresh Merchant" idempotent on dev
        // shops that haven't run the upgrade yet.
        Configuration::deleteByName(self::LEGACY_CONFIG_KEY);
        Configuration::deleteByName(self::LEGACY_NEGATIVE_CACHE_KEY);
    }

    public static function currentHost(): string
    {
        return FrakUtils::currentHost();
    }

    /** @return array{id:string,name:string,domain:string,resolved_at:int}|null */
    private static function resolve(string $host): ?array
    {
        $url = self::RESOLVE_URL . '?domain=' . rawurlencode($host);

        $ch = curl_init($url);
        if ($ch === false) {
            self::markUnresolved($host);
            return null;
        }

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);

        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curl_errno = curl_errno($ch);
        curl_close($ch);

        if ($curl_errno > 0 || $http_code !== 200 || !is_string($response)) {
            self::markUnresolved($host);
            return null;
        }

        $data = json_decode($response, true);
        if (!is_array($data) || empty($data['merchantId'])) {
            self::markUnresolved($host);
            return null;
        }

        $record = [
            'id' => (string) $data['merchantId'],
            'name' => isset($data['name']) ? (string) $data['name'] : '',
            'domain' => $host,
            'resolved_at' => time(),
        ];

        FrakCache::setJson(self::CACHE_KEY_PREFIX . $host, $record);
        FrakCache::delete(self::NEGATIVE_CACHE_PREFIX . $host);

        return $record;
    }

    private static function readCachedRecord(string $host): ?array
    {
        $decoded = FrakCache::getJson(self::CACHE_KEY_PREFIX . $host);
        if (!is_array($decoded) || empty($decoded['id'])) {
            return null;
        }
        return $decoded;
    }

    private static function isNegativeCacheActive(string $host): bool
    {
        // `FrakCache::get()` already lazy-evicts expired rows so a non-null
        // return here means the negative cache is still live.
        return FrakCache::get(self::NEGATIVE_CACHE_PREFIX . $host) !== null;
    }

    private static function markUnresolved(string $host): void
    {
        FrakCache::set(self::NEGATIVE_CACHE_PREFIX . $host, '1', self::NEGATIVE_CACHE_TTL);
    }
}
