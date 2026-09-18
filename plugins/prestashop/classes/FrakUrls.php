<?php

/**
 * Single source of truth for external URLs the module talks to: the
 * resolver and webhook share `backend.frak.id`; {@see FrakFrontend::head()}
 * warms each SDK host with the same one its script tag or fallback uses.
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
     * The backend exposes no platform-specific `/webhook/prestashop` route —
     * this is the shared `customWebhook` Elysia route.
     */
    public const WEBHOOK_MERCHANT_PREFIX = self::BACKEND_BASE . '/ext/merchant/';
    public const WEBHOOK_PATH_SUFFIX = '/webhook/custom';

    /**
     * First-party pointer host: serves a 5-minute-TTL file naming the exact
     * SDK version, so a release reaches shops faster than jsDelivr's
     * floating-tag cache. Preconnected alongside CDN_BASE.
     */
    public const SDK_POINTER_HOST = 'https://sdk.frak.id';

    /** SDK script served from the pointer — the front-office script `src`. */
    public const SDK_POINTER_SCRIPT = self::SDK_POINTER_HOST . '/components.js';

    /**
     * jsDelivr CDN host: the pointer's shim `import()`s the versioned loader
     * from here on every page, and the `onerror` fallback shim lives here too.
     * Preconnected from {@see FrakFrontend::head()} to warm that handshake.
     */
    public const CDN_BASE = 'https://cdn.jsdelivr.net';

    /** `onerror` fallback for {@see FrakUrls::SDK_POINTER_SCRIPT} — pinned to jsDelivr's floating tag. */
    public const SDK_FALLBACK_SCRIPT = self::CDN_BASE . '/npm/@frak-labs/components@latest/cdn/components.js';
}
