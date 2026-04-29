<?php

/**
 * Shared utility helpers.
 *
 * Mirrors WordPress's `Frak_Utils` so the two plugins agree on the same
 * normalisation rules. Currently exposes only `currentHost()`; further
 * helpers (logo resolution, etc.) can be added here as the PrestaShop side
 * grows.
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
     * `MerchantRepository::getNormalizedDomain`) and with the WordPress
     * plugin's `Frak_Utils::current_host()`.
     *
     * Uses `str_starts_with` + `substr` instead of the previous `preg_replace`
     * pair: same result on every domain we care about, no regex engine
     * spin-up per call. PHP 8.0+.
     *
     * @return string Empty string when the host cannot be determined.
     */
    public static function currentHost(): string
    {
        if (self::$cachedHost !== null) {
            return self::$cachedHost;
        }

        $domain = strtolower((string) Tools::getShopDomain(false, true));

        // `Tools::getShopDomain($http=false)` should never include the
        // scheme, but defensive trims here keep us aligned with the WP
        // sibling's normalisation in case a custom override leaks one in.
        if (str_starts_with($domain, 'https://')) {
            $domain = substr($domain, 8);
        } elseif (str_starts_with($domain, 'http://')) {
            $domain = substr($domain, 7);
        }
        if (str_starts_with($domain, 'www.')) {
            $domain = substr($domain, 4);
        }

        self::$cachedHost = rtrim($domain, '/');
        return self::$cachedHost;
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
