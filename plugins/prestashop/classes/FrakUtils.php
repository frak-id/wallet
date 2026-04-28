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
     * Return the current shop host, lower-cased and with a leading `www.`
     * stripped so comparisons align with the backend's normalization (see
     * `MerchantRepository::getNormalizedDomain`) and with the WordPress
     * plugin's `Frak_Utils::current_host()`.
     *
     * @return string Empty string when the host cannot be determined.
     */
    public static function currentHost(): string
    {
        $domain = Tools::getShopDomain(false, true);
        $domain = strtolower((string) $domain);
        $domain = preg_replace('#^https?://#', '', $domain) ?? '';
        $domain = preg_replace('#^www\.#', '', $domain) ?? '';
        return rtrim($domain, '/');
    }
}
