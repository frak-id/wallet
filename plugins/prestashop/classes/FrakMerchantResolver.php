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
 * Storage: Symfony Cache pool ({@see FrakDb::cache()}), namespaced under
 * `merchant:` and `merchant_unresolved:`. PSR-6 keys live in the shared
 * `frak_cache_items` table outside `ps_configuration` so cold merchant
 * data never bloats the per-request autoload payload — PrestaShop has no
 * `autoload=no` flag (unlike WordPress's `update_option(..., false)`), so
 * a custom backing store is the only way to keep cold config cold.
 *
 * HTTP: shares the {@see FrakDb::httpClient()} instance with
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
    public const RESOLVE_URL = 'https://backend.frak.id/user/merchant/resolve';
    /** Connect + total request timeout in seconds for the resolver call. */
    private const REQUEST_TIMEOUT = 5;

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
        $cache = FrakDb::cache();
        $cache->deleteItem(self::CACHE_KEY_PREFIX . self::sanitizeKey($host));
        $cache->deleteItem(self::NEGATIVE_CACHE_PREFIX . self::sanitizeKey($host));
    }

    public static function currentHost(): string
    {
        return FrakUtils::currentHost();
    }

    /** @return array{id:string,name:string,domain:string,resolved_at:int}|null */
    private static function resolve(string $host): ?array
    {
        $url = self::RESOLVE_URL . '?domain=' . rawurlencode($host);

        try {
            $response = FrakDb::httpClient(self::REQUEST_TIMEOUT)->request('GET', $url, [
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

        $cache = FrakDb::cache();
        $key = self::sanitizeKey($host);
        $item = $cache->getItem(self::CACHE_KEY_PREFIX . $key);
        $item->set($record);
        // No `expiresAfter()` — merchant UUIDs are immutable per domain;
        // the resolver self-invalidates via the host check in `getRecord()`
        // and the explicit "Refresh Merchant" admin button.
        $cache->save($item);
        $cache->deleteItem(self::NEGATIVE_CACHE_PREFIX . $key);

        return $record;
    }

    private static function readCachedRecord(string $host): ?array
    {
        $item = FrakDb::cache()->getItem(self::CACHE_KEY_PREFIX . self::sanitizeKey($host));
        if (!$item->isHit()) {
            return null;
        }
        $value = $item->get();
        if (!is_array($value) || empty($value['id'])) {
            return null;
        }
        return $value;
    }

    private static function isNegativeCacheActive(string $host): bool
    {
        return FrakDb::cache()->hasItem(self::NEGATIVE_CACHE_PREFIX . self::sanitizeKey($host));
    }

    private static function markUnresolved(string $host): void
    {
        $item = FrakDb::cache()->getItem(self::NEGATIVE_CACHE_PREFIX . self::sanitizeKey($host));
        $item->set(true);
        $item->expiresAfter(self::NEGATIVE_CACHE_TTL);
        FrakDb::cache()->save($item);
    }

    /**
     * PSR-6 cache keys can only contain `[A-Za-z0-9_.]` (no dots in some
     * adapters, no special characters). A shop domain like `shop.example.com`
     * survives mostly intact; we replace dots with underscores defensively
     * to keep DoctrineDbalAdapter happy regardless of host quirkiness.
     */
    private static function sanitizeKey(string $host): string
    {
        return preg_replace('/[^A-Za-z0-9_]/', '_', $host) ?? '';
    }
}
