<?php

/**
 * Single source of truth for external URLs the module talks to.
 *
 * Keeps the backend host and CDN host pinned in one place so:
 *   - The merchant resolver and the webhook helper agree on the same
 *     `backend.frak.id` host (drift between them would split traffic
 *     across hosts and break the shared HttpClient's TLS reuse).
 *   - The resource hints in `<head>` and the deferred script tag agree on
 *     the same CDN host (otherwise the `dns-prefetch` / `preconnect` warm
 *     a different host than the one that actually serves the SDK).
 *
 * Mirrors the WordPress sibling's `class-frak-utils.php` constants block
 * — both plugins read from the same canonical Frak hosts.
 */
class FrakUrls
{
    /** Frak backend host. All API calls (resolver + webhook) go through this. */
    public const BACKEND_BASE = 'https://backend.frak.id';

    /**
     * Merchant resolver endpoint — `GET ?domain=<host>`. See
     * {@see FrakMerchantResolver::resolve()}.
     */
    public const MERCHANT_RESOLVE = self::BACKEND_BASE . '/user/merchant/resolve';

    /**
     * Webhook URL prefix. Full URL is built as
     * `{WEBHOOK_MERCHANT_PREFIX}{merchantId}{WEBHOOK_PATH_SUFFIX}` —
     * see {@see FrakWebhookHelper::getWebhookUrl()}.
     *
     * Reuses the existing `customWebhook` Elysia route on the backend (DTO
     * matches what the PrestaShop / Magento / WooCommerce plugins all send).
     * No platform-specific `/webhook/prestashop` route exists.
     */
    public const WEBHOOK_MERCHANT_PREFIX = self::BACKEND_BASE . '/ext/merchant/';
    public const WEBHOOK_PATH_SUFFIX = '/webhook/custom';

    /**
     * jsDelivr CDN host. Preconnected from `<head>` so the TLS handshake
     * warms before the deferred SDK script tag fires — saves ~100-300 ms
     * TTFB on first SDK paint over mobile networks. Used by both
     * {@see FrakFrontend::head()} (resource hints) and
     * {@see FrakFrontend::setMedia()} (script registration).
     */
    public const CDN_BASE = 'https://cdn.jsdelivr.net';

    /** Frak SDK script served from jsDelivr. */
    public const SDK_SCRIPT = self::CDN_BASE . '/npm/@frak-labs/components';
}
