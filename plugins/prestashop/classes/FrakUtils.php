<?php

/**
 * Shared utility helpers.
 */
class FrakUtils
{
    /**
     * Per-request memo of the resolved host. Hosts cannot change within a
     * single PHP process so a static cache is safe and removes the cost of
     * repeated `Tools::getShopDomain()` + string trims for callers that
     * touch the helper from multiple paths within one request (resolver,
     * webhook helper URL builder, admin renderer, …).
     */
    private static ?string $cachedHost = null;

    /**
     * Return the current shop host, lower-cased and with a leading `www.`
     * stripped so comparisons align with the backend's normalization (see
     * `MerchantRepository::getNormalizedDomain`).
     *
     * `FRAK_MERCHANT_DOMAIN`, when set, replaces the shop host.
     *
     * @return string Empty string when the host cannot be determined.
     */
    public static function currentHost(): string
    {
        if (self::$cachedHost !== null) {
            return self::$cachedHost;
        }

        $override = self::merchantDomainOverride();
        self::$cachedHost = $override !== ''
            ? $override
            : self::normalizeHost((string) Tools::getShopDomain(false, true));
        return self::$cachedHost;
    }

    /** The normalised `FRAK_MERCHANT_DOMAIN`, or an empty string when unset. */
    public static function merchantDomainOverride(): string
    {
        return self::normalizeHost(trim(FrakEnv::merchantDomain()));
    }

    private static function normalizeHost(string $domain): string
    {
        $domain = strtolower($domain);

        // `Tools::getShopDomain($http=false)` should never include the scheme,
        // but a custom override can leak one in.
        if (str_starts_with($domain, 'https://')) {
            $domain = substr($domain, 8);
        } elseif (str_starts_with($domain, 'http://')) {
            $domain = substr($domain, 7);
        }
        if (str_starts_with($domain, 'www.')) {
            $domain = substr($domain, 4);
        }

        return rtrim($domain, '/');
    }

    /**
     * Reset the per-request memo. Test-only helper — production code never
     * needs to invalidate the cache because the shop domain is immutable
     * within a request. Exposed so PHPUnit tests that swap the underlying
     * `Tools::getShopDomain()` mock can force a fresh resolution.
     */
    public static function resetCache(): void
    {
        self::$cachedHost = null;
    }
}
