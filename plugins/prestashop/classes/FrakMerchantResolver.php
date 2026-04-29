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
 * Storage: tiny key-value cache ({@see FrakCache}), namespaced under
 * `merchant.` and `merchant_unresolved.` keys. The cache table sits
 * outside `ps_configuration` so cold merchant data never bloats the
 * per-request autoload payload — PrestaShop has no `autoload=no` flag
 * (unlike WordPress's `update_option(..., false)`), so a custom backing
 * store is the only way to keep cold config cold.
 *
 * HTTP: shares the {@see FrakHttpClient} singleton with
 * {@see FrakWebhookHelper} so the TLS handshake against `backend.frak.id`
 * is reused when a single order transition first resolves the merchant
 * and then dispatches the webhook on the same request.
 *
 * Mirrors the WordPress `Frak_Merchant` contract so the two plugins stay
 * conceptually aligned (same record shape, same invalidation triggers).
 */
class FrakMerchantResolver
{
    /** Cache key prefix for the merchant record (suffix is the normalised host). */
    public const CACHE_KEY_PREFIX = 'merchant.';
    /** Cache key prefix for the negative-cache sentinel. */
    public const NEGATIVE_CACHE_PREFIX = 'merchant_unresolved.';
    /** Negative-cache TTL in seconds. Mirrors the WP plugin (5 minutes). */
    public const NEGATIVE_CACHE_TTL = 300;

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
     * Drop the cached merchant record + negative-cache sentinel for the
     * current host. Called by the admin "Refresh" button and by the
     * webhook dispatcher when the backend signals the cached UUID no
     * longer maps to a live merchant.
     */
    public static function invalidate(): void
    {
        $host = self::currentHost();
        if ($host === '') {
            return;
        }
        $key = self::sanitizeKey($host);
        FrakCache::delete(self::CACHE_KEY_PREFIX . $key);
        FrakCache::delete(self::NEGATIVE_CACHE_PREFIX . $key);
    }

    public static function currentHost(): string
    {
        return FrakUtils::currentHost();
    }

    /** @return array{id:string,name:string,domain:string,resolved_at:int}|null */
    private static function resolve(string $host): ?array
    {
        $url = FrakUrls::MERCHANT_RESOLVE . '?domain=' . rawurlencode($host);

        try {
            $response = FrakHttpClient::getInstance()->request('GET', $url, [
                'headers' => ['Accept' => 'application/json'],
            ]);
            $http_code = $response->getStatusCode();
            $body = $response->getContent(false);
        } catch (\Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface $e) {
            self::markUnresolved($host);
            return null;
        }

        if ($http_code !== 200 || $body === '') {
            self::markUnresolved($host);
            return null;
        }

        $data = json_decode($body, true);
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

        $key = self::sanitizeKey($host);
        // No TTL — merchant UUIDs are immutable per domain; the resolver
        // self-invalidates via the host check in `getRecord()` and the
        // explicit "Refresh Merchant" admin button.
        FrakCache::set(self::CACHE_KEY_PREFIX . $key, $record);
        FrakCache::delete(self::NEGATIVE_CACHE_PREFIX . $key);

        return $record;
    }

    private static function readCachedRecord(string $host): ?array
    {
        $value = FrakCache::get(self::CACHE_KEY_PREFIX . self::sanitizeKey($host));
        if (!is_array($value) || empty($value['id'])) {
            return null;
        }
        return $value;
    }

    private static function isNegativeCacheActive(string $host): bool
    {
        return FrakCache::has(self::NEGATIVE_CACHE_PREFIX . self::sanitizeKey($host));
    }

    private static function markUnresolved(string $host): void
    {
        FrakCache::set(
            self::NEGATIVE_CACHE_PREFIX . self::sanitizeKey($host),
            true,
            self::NEGATIVE_CACHE_TTL
        );
    }

    /**
     * Cache keys are restricted to `[A-Za-z0-9_]` — a shop domain like
     * `shop.example.com` survives mostly intact, dots just become
     * underscores. Keeps key strings predictable and short of the
     * `cache_key VARCHAR(191)` column width even on long subdomains.
     */
    private static function sanitizeKey(string $host): string
    {
        return preg_replace('/[^A-Za-z0-9_]/', '_', $host) ?? '';
    }
}
