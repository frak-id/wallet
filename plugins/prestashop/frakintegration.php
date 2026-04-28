<?php

if (!defined('_PS_VERSION_')) {
    exit;
}

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/classes/FrakUtils.php';
require_once __DIR__ . '/classes/FrakMerchantResolver.php';
require_once __DIR__ . '/classes/FrakWebhookHelper.php';
require_once __DIR__ . '/classes/FrakComponentRenderer.php';

class FrakIntegration extends Module
{
    /**
     * Settings schema version. Bump when a `cleanupLegacyOptions()`
     * sweep needs to run on existing installs (e.g. dropping an option
     * row that an older release persisted). Mirrors WordPress's
     * `Frak_Settings::CURRENT_VERSION`.
     */
    private const SETTINGS_VERSION = 2;

    public function __construct()
    {
        $this->name = 'frakintegration';
        $this->tab = 'front_office_features';
        $this->version = '1.0.0';
        $this->author = 'Frak';
        $this->need_instance = 0;
        $this->ps_versions_compliancy = [
            'min' => '1.7',
            'max' => _PS_VERSION_
        ];
        $this->bootstrap = true;

        parent::__construct();

        $this->displayName = $this->l('Frak');
        $this->description = $this->l('Integrates Frak services with PrestaShop.');

        $this->confirmUninstall = $this->l('Are you sure you want to uninstall?');

        // One-shot upgrade hook: PrestaShop's install() only fires on fresh
        // installs, so the legacy-options sweep needs a per-request guard for
        // shops upgrading from an older zip. Configuration::get() hits a static
        // cache after the first call so the no-op path is essentially free.
        self::ensureSettingsMigrated();
    }

    public function install()
    {
        if (
            parent::install() &&
            $this->registerHook('header') &&
            $this->registerHook('displayProductAdditionalInfo') &&
            $this->registerHook('displayOrderConfirmation') &&
            $this->registerHook('actionOrderStatusUpdate')
        ) {
            // Seed sane defaults from the PrestaShop shop record. Anything else
            // (i18n, modal language, share-button copy/style) is now resolved by
            // the SDK against business.frak.id once the merchant is registered.
            Configuration::updateValue('FRAK_SHOP_NAME', Configuration::get('PS_SHOP_NAME'));
            Configuration::updateValue('FRAK_LOGO_URL', $this->context->link->getMediaLink(_PS_IMG_ . Configuration::get('PS_LOGO')));
            self::cleanupLegacyOptions();
            return true;
        }
        return false;
    }

    public function uninstall()
    {
        if (
            parent::uninstall() &&
            $this->unregisterHook('header') &&
            $this->unregisterHook('displayOrderConfirmation') &&
            $this->unregisterHook('displayProductAdditionalInfo')
        ) {
            Configuration::deleteByName('FRAK_SHOP_NAME');
            Configuration::deleteByName('FRAK_LOGO_URL');
            Configuration::deleteByName('FRAK_WEBHOOK_SECRET');
            Configuration::deleteByName('FRAK_SETTINGS_VERSION');
            Configuration::deleteByName(FrakMerchantResolver::CONFIG_KEY);
            Configuration::deleteByName(FrakMerchantResolver::NEGATIVE_CACHE_KEY);
            self::cleanupLegacyOptions();
            return true;
        }
        return false;
    }

    /**
     * Run the deprecated-options sweep at most once per `SETTINGS_VERSION`.
     * Mirrors `Frak_Settings::migrate()` in the WordPress plugin.
     */
    private static function ensureSettingsMigrated(): void
    {
        $current = (int) Configuration::get('FRAK_SETTINGS_VERSION');
        if ($current >= self::SETTINGS_VERSION) {
            return;
        }
        self::cleanupLegacyOptions();
        Configuration::updateValue('FRAK_SETTINGS_VERSION', self::SETTINGS_VERSION);
    }

    /**
     * Wipe the option rows that an earlier iteration of the module persisted
     * but no longer consumes:
     *   - FRAK_MODAL_LNG / FRAK_MODAL_I18N: SDK i18n + language are now
     *     backend-driven via business.frak.id.
     *   - FRAK_SHARING_BUTTON_*: render decisions and copy live in the
     *     business dashboard's per-merchant placement config; the hook now
     *     emits <frak-button-share placement="product"> unconditionally.
     *   - FRAK_WEBHOOK_LOGS: replaced by PrestaShopLogger entries (already
     *     wired from FrakWebhookHelper::send() / hookActionOrderStatusUpdate).
     *
     * Mirrors WordPress's Frak_Settings::DEPRECATED_LEGACY_OPTIONS sweep so
     * upgraded shops do not carry stale rows in ps_configuration.
     */
    private static function cleanupLegacyOptions(): void
    {
        $deprecated = [
            'FRAK_MODAL_LNG',
            'FRAK_MODAL_I18N',
            'FRAK_SHARING_BUTTON_ENABLED',
            'FRAK_SHARING_BUTTON_TEXT',
            'FRAK_SHARING_BUTTON_STYLE',
            'FRAK_SHARING_BUTTON_CUSTOM_STYLE',
            'FRAK_WEBHOOK_LOGS',
        ];
        foreach ($deprecated as $key) {
            Configuration::deleteByName($key);
        }
    }

    public function hookHeader()
    {
        $shop_name = Configuration::get('FRAK_SHOP_NAME');
        $logo_url = Configuration::get('FRAK_LOGO_URL');

        $this->context->smarty->assign([
            'shop_name' => $shop_name ?: Configuration::get('PS_SHOP_NAME'),
            'logo_url' => $logo_url,
        ]);

        return $this->display(__FILE__, 'views/templates/hook/head.tpl');
    }

    public function hookDisplayProductAdditionalInfo()
    {
        return FrakComponentRenderer::shareButton(['placement' => 'product']);
    }

    public function hookActionOrderStatusUpdate($params)
    {
        $order_id = $params['id_order'];
        $token = $params['cart']->secure_key;
        $new_status = $params['newOrderStatus'];

        PrestaShopLogger::addLog('FrakIntegration: Order status update triggered for order ' . $order_id . ' with status ID: ' . $new_status->id . ' (' . $new_status->name . ')', 1);

        // The different statuses that we send to the webhook
        $status_map = [
            (int)Configuration::get('PS_OS_WS_PAYMENT') => 'confirmed',
            (int)Configuration::get('PS_OS_PAYMENT') => 'confirmed',
            (int)Configuration::get('PS_OS_DELIVERED') => 'confirmed',
            (int)Configuration::get('PS_OS_CANCELED') => 'cancelled',
            (int)Configuration::get('PS_OS_REFUND') => 'refunded',
        ];

        // Status code to skip
        $skip_status_codes = [
            (int)Configuration::get('PS_OS_SHIPPING'),
            (int)Configuration::get('PS_OS_PREPARATION'),
        ];

        // If the status code is in the skip list, do nothing
        if (in_array((int)$new_status->id, $skip_status_codes)) {
            PrestaShopLogger::addLog('FrakIntegration: Skipping webhook for order ' . $order_id . ' with status: ' . $new_status->id, 1);
            return;
        }

        // Default to pending if the status is not in the map
        $webhook_status = 'pending';
        if (array_key_exists((int)$new_status->id, $status_map)) {
            $webhook_status = $status_map[(int)$new_status->id];
        }

        PrestaShopLogger::addLog('FrakIntegration: Triggering webhook for order ' . $order_id . ' with status: ' . $webhook_status, 1);

        // Send the webhook
        $result = FrakWebhookHelper::send($order_id, $webhook_status, $token);

        if ($result && isset($result['success'])) {
            if ($result['success']) {
                PrestaShopLogger::addLog('FrakIntegration: Webhook sent successfully for order ' . $order_id, 1);
            } else {
                PrestaShopLogger::addLog('FrakIntegration: Webhook failed for order ' . $order_id . ': ' . ($result['error'] ?? 'Unknown error'), 3);
            }
        }
    }

    public function hookDisplayOrderConfirmation($params)
    {
        $order = $params['order'];
        if (!$order) {
            return;
        }

        return FrakComponentRenderer::postPurchase([
            'placement' => 'order-confirmation',
            'customerId' => (string) $order->id_customer,
            'orderId' => (string) $order->id,
            'token' => $order->secure_key . '_' . $order->id,
        ]);
    }


    public function getContent()
    {
        Tools::redirectAdmin($this->context->link->getAdminLink('AdminFrakIntegration'));
    }
}
