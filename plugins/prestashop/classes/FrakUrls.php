<?php

/**
 * Single source of truth for external URLs the module talks to: the
 * resolver and webhook share `backend.frak.id`; {@see FrakFrontend::head()}
 * warms each SDK host with the same one its script tag or fallback uses.
 *
 * Origins that move with the dev switch ({@see FrakEnv::isDev()}) are only
 * reachable through the methods below; the two public constants are the same
 * in both environments.
 */
class FrakUrls
{
    /**
     * Suffix of the webhook URL built by {@see FrakWebhookHelper::getWebhookUrl()}.
     * The backend exposes no `/webhook/prestashop` route — this is the shared
     * `customWebhook` Elysia route.
     */
    public const WEBHOOK_PATH_SUFFIX = '/webhook/custom';

    /**
     * jsDelivr CDN host: the pointer's shim `import()`s the versioned loader
     * from here on every page, and the `onerror` fallback shim lives here too.
     * Preconnected from {@see FrakFrontend::head()} to warm that handshake.
     */
    public const CDN_BASE = 'https://cdn.jsdelivr.net';

    private const BACKEND_BASE = 'https://backend.frak.id';
    private const DEV_BACKEND_BASE = 'https://backend.gcp-dev.frak.id';

    /** First-party pointer naming the exact SDK version (5-minute TTL), faster than jsDelivr's floating tag. */
    private const SDK_POINTER_HOST = 'https://sdk.frak.id';
    private const DEV_SDK_POINTER_HOST = 'https://sdk-dev.frak.id';

    private const DASHBOARD_ORIGIN = 'https://business.frak.id';
    private const DEV_DASHBOARD_ORIGIN = 'https://business-dev.frak.id';

    public static function backendBase(): string
    {
        return FrakEnv::isDev() ? self::DEV_BACKEND_BASE : self::BACKEND_BASE;
    }

    public static function merchantResolveUrl(): string
    {
        return self::backendBase() . '/user/merchant/resolve';
    }

    public static function webhookMerchantPrefix(): string
    {
        return self::backendBase() . '/ext/merchant/';
    }

    public static function sdkPointerHost(): string
    {
        return FrakEnv::isDev() ? self::DEV_SDK_POINTER_HOST : self::SDK_POINTER_HOST;
    }

    public static function sdkPointerScript(): string
    {
        return self::sdkPointerHost() . '/components.js';
    }

    /** jsDelivr fallback for {@see sdkPointerScript()}: `@beta` in dev, `@latest` otherwise. */
    public static function sdkFallbackScript(): string
    {
        $tag = FrakEnv::isDev() ? 'beta' : 'latest';
        return self::CDN_BASE . '/npm/@frak-labs/components@' . $tag . '/cdn/components.js';
    }

    public static function dashboardOrigin(): string
    {
        return FrakEnv::isDev() ? self::DEV_DASHBOARD_ORIGIN : self::DASHBOARD_ORIGIN;
    }
}
