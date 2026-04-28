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
 *   - `FRAK_MERCHANT` configuration row holds the JSON-encoded record.
 *   - `FRAK_MERCHANT_UNRESOLVED_AT` configuration row holds the unix ts of
 *     the last failed resolve, used as a TTL anchor for the negative cache.
 *
 * Mirrors the WordPress `Frak_Merchant` contract so the two plugins stay
 * conceptually aligned (same record shape, same invalidation triggers).
 */
class FrakMerchantResolver
{
    public const CONFIG_KEY = 'FRAK_MERCHANT';
    public const NEGATIVE_CACHE_KEY = 'FRAK_MERCHANT_UNRESOLVED_AT';
    public const NEGATIVE_CACHE_TTL = 300;
    public const RESOLVE_URL = 'https://backend.frak.id/user/merchant/resolve';

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

        $cached = self::readCachedRecord();
        if ($cached !== null && ($cached['domain'] ?? '') === $host) {
            return $cached;
        }

        if (self::isNegativeCacheActive()) {
            return null;
        }

        return self::resolve($host);
    }

    /**
     * Drop any cached merchant record. Called by:
     *   - The admin "Refresh" button.
     *   - The webhook dispatcher when the backend replies with an error
     *     indicating the cached UUID no longer maps to a live merchant.
     */
    public static function invalidate(): void
    {
        Configuration::deleteByName(self::CONFIG_KEY);
        Configuration::deleteByName(self::NEGATIVE_CACHE_KEY);
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
            self::markUnresolved();
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
            self::markUnresolved();
            return null;
        }

        $data = json_decode($response, true);
        if (!is_array($data) || empty($data['merchantId'])) {
            self::markUnresolved();
            return null;
        }

        $record = [
            'id' => (string) $data['merchantId'],
            'name' => isset($data['name']) ? (string) $data['name'] : '',
            'domain' => $host,
            'resolved_at' => time(),
        ];

        Configuration::updateValue(self::CONFIG_KEY, json_encode($record));
        Configuration::deleteByName(self::NEGATIVE_CACHE_KEY);

        return $record;
    }

    private static function readCachedRecord(): ?array
    {
        $raw = Configuration::get(self::CONFIG_KEY);
        if (!$raw) {
            return null;
        }

        $decoded = json_decode((string) $raw, true);
        if (!is_array($decoded) || empty($decoded['id'])) {
            return null;
        }

        return $decoded;
    }

    private static function isNegativeCacheActive(): bool
    {
        $stamped_at = (int) Configuration::get(self::NEGATIVE_CACHE_KEY);
        if ($stamped_at === 0) {
            return false;
        }

        return (time() - $stamped_at) < self::NEGATIVE_CACHE_TTL;
    }

    private static function markUnresolved(): void
    {
        Configuration::updateValue(self::NEGATIVE_CACHE_KEY, time());
    }
}
