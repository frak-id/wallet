<?php

/**
 * Typed accessor for the module's `Configuration` rows.
 *
 * Centralises every `FRAK_*` key string on a single class so:
 *   - Key typos cannot drift between read and write sites.
 *   - The four typed getters / setters establish the canonical signature
 *     for each row (e.g. webhook secret is always a string, never null).
 *   - Bundle accessors (`getBrand`, `getOrderStateIds`) collapse the
 *     repeated `Configuration::getMultiple([...])` patterns scattered
 *     across the frontend, admin, and order-status hooks into a single
 *     batched lookup with a stable return shape.
 *   - `ensureCronToken()` owns the "generate-on-first-install,
 *     preserve-on-re-install" contract that the install + upgrade paths
 *     both need.
 *
 * Mirrors WordPress's `Frak_Settings` and Magento's `Model/Config`. The
 * SDK-facing config (i18n, modal copy, share-button styling, walletUrl)
 * lives in `business.frak.id` once the merchant is registered, so the
 * surface here is intentionally minimal.
 */
class FrakConfig
{
    /** Brand-name override; falls back to `PS_SHOP_NAME` when unset. */
    public const SHOP_NAME = 'FRAK_SHOP_NAME';

    /** Logo URL (absolute). May point to the shipped uploads dir. */
    public const LOGO_URL = 'FRAK_LOGO_URL';

    /** HMAC signing key pasted from `business.frak.id` (Merchant → Purchase Tracker). */
    public const WEBHOOK_SECRET = 'FRAK_WEBHOOK_SECRET';

    /** 64-char hex token gating `controllers/front/cron.php` via `hash_equals`. */
    public const CRON_TOKEN = 'FRAK_CRON_TOKEN';

    /**
     * Brand bundle: shop name (with `PS_SHOP_NAME` fallback) + logo URL.
     * Single batched lookup so the front-office head + the admin renderer
     * pay one autoload-cache hit per call instead of two.
     *
     * @return array{name: string, logoUrl: string}
     */
    public static function getBrand(): array
    {
        $config = Configuration::getMultiple([self::SHOP_NAME, self::LOGO_URL, 'PS_SHOP_NAME']);
        $name = (string) ($config[self::SHOP_NAME] ?? '');
        if ($name === '') {
            $name = (string) ($config['PS_SHOP_NAME'] ?? '');
        }
        return [
            'name' => $name,
            'logoUrl' => (string) ($config[self::LOGO_URL] ?? ''),
        ];
    }

    /**
     * Cast every `PS_OS_*` order-state id to int in one batched lookup.
     * Used by {@see FrakOrderWebhook::onStatusUpdate()} to map PrestaShop
     * states to Frak webhook statuses without paying for 7 individual
     * `Configuration::get()` calls.
     *
     * @return array<string, int>
     */
    public static function getOrderStateIds(): array
    {
        $config = Configuration::getMultiple([
            'PS_OS_WS_PAYMENT',
            'PS_OS_PAYMENT',
            'PS_OS_DELIVERED',
            'PS_OS_CANCELED',
            'PS_OS_REFUND',
            'PS_OS_SHIPPING',
            'PS_OS_PREPARATION',
        ]);
        $ids = [];
        foreach ($config as $key => $value) {
            $ids[$key] = (int) $value;
        }
        return $ids;
    }

    public static function getShopName(): string
    {
        return self::getBrand()['name'];
    }

    public static function getLogoUrl(): string
    {
        return (string) Configuration::get(self::LOGO_URL);
    }

    public static function getWebhookSecret(): string
    {
        return (string) Configuration::get(self::WEBHOOK_SECRET);
    }

    public static function getCronToken(): string
    {
        return (string) Configuration::get(self::CRON_TOKEN);
    }

    public static function setShopName(string $value): void
    {
        Configuration::updateValue(self::SHOP_NAME, $value);
    }

    public static function setLogoUrl(string $value): void
    {
        Configuration::updateValue(self::LOGO_URL, $value);
    }

    public static function setWebhookSecret(string $value): void
    {
        Configuration::updateValue(self::WEBHOOK_SECRET, $value);
    }

    public static function setCronToken(string $value): void
    {
        Configuration::updateValue(self::CRON_TOKEN, $value);
    }

    /**
     * Generate a fresh cron token if none is configured. Idempotent —
     * existing tokens are preserved verbatim because rotating would
     * invalidate any cron URL the merchant has already wired up against
     * the displayed value. Called from both the install path and the
     * upgrade migrator so partial-uninstall / re-install flows are safe.
     */
    public static function ensureCronToken(): void
    {
        if (self::getCronToken() === '') {
            self::setCronToken(bin2hex(random_bytes(32)));
        }
    }
}
