<?php

if (!defined('_PS_VERSION_')) {
    exit;
}

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/classes/FrakUtils.php';
require_once __DIR__ . '/classes/FrakMerchantResolver.php';
require_once __DIR__ . '/classes/FrakWebhookHelper.php';
require_once __DIR__ . '/classes/FrakComponentRenderer.php';
require_once __DIR__ . '/classes/FrakWebhookQueue.php';
require_once __DIR__ . '/classes/FrakWebhookCron.php';
require_once __DIR__ . '/classes/FrakOrderResolver.php';

class FrakIntegration extends Module
{
    /**
     * Settings schema version. Bumped whenever the install path persists
     * something that an existing install also needs to provision — see
     * `ensureSettingsMigrated()`. Mirrors WordPress's `Frak_Settings::CURRENT_VERSION`.
     *
     * - v1 → v2: drop legacy modal/share-button option rows AND introduce the
     *   async webhook retry queue (`frak_webhook_queue` table + `FRAK_CRON_TOKEN`
     *   + `actionOrderStatusPostUpdate` hook). v2 was never released, so the
     *   queue/cron provisioning shipped under the same version bump.
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
        $this->ensureSettingsMigrated();
    }

    public function install()
    {
        if (
            parent::install() &&
            $this->registerHook('header') &&
            $this->registerHook('displayProductAdditionalInfo') &&
            $this->registerHook('displayOrderConfirmation') &&
            // Post-commit hook so the order status row is durable before we
            // dispatch — mirrors the Magento sister plugin and the PrestaShop
            // docs' explicit recommendation. The pre-commit `actionOrderStatusUpdate`
            // raced under multistore / high load.
            $this->registerHook('actionOrderStatusPostUpdate') &&
            $this->registerHook('displayOrderDetail')
        ) {
            // Seed sane defaults from the PrestaShop shop record. Anything else
            // (i18n, modal language, share-button copy/style) is now resolved by
            // the SDK against business.frak.id once the merchant is registered.
            Configuration::updateValue('FRAK_SHOP_NAME', Configuration::get('PS_SHOP_NAME'));
            Configuration::updateValue('FRAK_LOGO_URL', $this->context->link->getMediaLink(_PS_IMG_ . Configuration::get('PS_LOGO')));

            // Async webhook infrastructure: queue table + per-shop cron token.
            // Both must be in place before any order status transition can happen,
            // otherwise enqueue() / the cron URL would silently fail.
            FrakWebhookQueue::createTable();
            self::ensureCronTokenExists();

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
            $this->unregisterHook('displayProductAdditionalInfo') &&
            // Symmetric with install(); keeps the hook chain readable, even though
            // parent::uninstall() already truncates the module's ps_hook_module rows.
            $this->unregisterHook('actionOrderStatusPostUpdate') &&
            $this->unregisterHook('displayOrderDetail')
        ) {
            Configuration::deleteByName('FRAK_SHOP_NAME');
            Configuration::deleteByName('FRAK_LOGO_URL');
            Configuration::deleteByName('FRAK_WEBHOOK_SECRET');
            Configuration::deleteByName('FRAK_SETTINGS_VERSION');
            Configuration::deleteByName('FRAK_CRON_TOKEN');
            Configuration::deleteByName(FrakMerchantResolver::CONFIG_KEY);
            Configuration::deleteByName(FrakMerchantResolver::NEGATIVE_CACHE_KEY);
            FrakWebhookQueue::dropTable();
            self::cleanupLegacyOptions();
            return true;
        }
        return false;
    }

    /**
     * Run the deprecated-options sweep at most once per `SETTINGS_VERSION`.
     * Mirrors `Frak_Settings::migrate()` in the WordPress plugin.
     *
     * Beyond the legacy-options sweep, every upgrade also (idempotently)
     * provisions the async webhook infrastructure: existing installs that
     * predate v3 do not have the `frak_webhook_queue` table or the
     * `FRAK_CRON_TOKEN` row, and they also still have the old
     * `actionOrderStatusUpdate` hook registered — we swap to the
     * post-commit hook here so the order-status transaction commits before
     * we dispatch.
     */
    private function ensureSettingsMigrated(): void
    {
        $current = (int) Configuration::get('FRAK_SETTINGS_VERSION');
        if ($current >= self::SETTINGS_VERSION) {
            return;
        }
        self::cleanupLegacyOptions();

        // Async webhook stack (v1 → v2). Idempotent (CREATE TABLE IF NOT EXISTS,
        // hash_equals-comparable token only generated when missing).
        FrakWebhookQueue::createTable();
        self::ensureCronTokenExists();
        $this->migrateOrderStatusHook();

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

    /**
     * Generate a 64-char hex cron token if not already set. The token gates
     * `controllers/front/cron.php` via `hash_equals` so naive timing attacks
     * cannot reveal it byte-by-byte. Idempotent: a non-empty existing value
     * is preserved (rotating the token would break any cron job the merchant
     * has already wired up).
     */
    private static function ensureCronTokenExists(): void
    {
        $existing = (string) Configuration::get('FRAK_CRON_TOKEN');
        if ($existing !== '') {
            return;
        }
        Configuration::updateValue('FRAK_CRON_TOKEN', bin2hex(random_bytes(32)));
    }

    /**
     * Migrate from the pre-commit `actionOrderStatusUpdate` hook (raced under
     * multistore / high load) to the post-commit `actionOrderStatusPostUpdate`.
     * Both calls are no-ops on a fresh install (the install() path already
     * registered the new hook); on an upgrade they re-shape the existing
     * `ps_hook_module` rows.
     */
    private function migrateOrderStatusHook(): void
    {
        $this->unregisterHook('actionOrderStatusUpdate');
        $this->registerHook('actionOrderStatusPostUpdate');
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

    /**
     * Post-commit order status hook. Maps the new state to a Frak status,
     * attempts a synchronous dispatch with tight timeouts, and on any failure
     * enqueues the order id into `frak_webhook_queue` for cron retry.
     *
     * The synchronous attempt keeps happy-path latency low (one HTTP round
     * trip on the merchant's checkout path) while bounding the worst case to
     * the 5 s request / 3 s connect timeouts in `FrakWebhookHelper`. Failures
     * never block the merchant for more than a few seconds and are guaranteed
     * to be retried by the cron drainer.
     */
    public function hookActionOrderStatusPostUpdate($params)
    {
        $new_status = $params['newOrderStatus'] ?? null;
        $order_id = (int) ($params['id_order'] ?? 0);

        if (!$new_status || !$order_id) {
            return;
        }

        $order = new Order($order_id);
        if (!Validate::isLoadedObject($order)) {
            PrestaShopLogger::addLog('FrakIntegration: order ' . $order_id . ' not loadable in postUpdate hook', 2);
            return;
        }

        $token = (string) $order->secure_key;

        PrestaShopLogger::addLog('FrakIntegration: Order status update triggered for order ' . $order_id . ' with status ID: ' . $new_status->id . ' (' . $new_status->name . ')', 1);

        $status_map = [
            (int) Configuration::get('PS_OS_WS_PAYMENT') => 'confirmed',
            (int) Configuration::get('PS_OS_PAYMENT') => 'confirmed',
            (int) Configuration::get('PS_OS_DELIVERED') => 'confirmed',
            (int) Configuration::get('PS_OS_CANCELED') => 'cancelled',
            (int) Configuration::get('PS_OS_REFUND') => 'refunded',
        ];

        $skip_status_codes = [
            (int) Configuration::get('PS_OS_SHIPPING'),
            (int) Configuration::get('PS_OS_PREPARATION'),
        ];

        if (in_array((int) $new_status->id, $skip_status_codes, true)) {
            PrestaShopLogger::addLog('FrakIntegration: Skipping webhook for order ' . $order_id . ' with status: ' . $new_status->id, 1);
            return;
        }

        $webhook_status = $status_map[(int) $new_status->id] ?? 'pending';

        PrestaShopLogger::addLog('FrakIntegration: Triggering webhook for order ' . $order_id . ' with status: ' . $webhook_status, 1);

        // First attempt is synchronous so the happy path completes in one round-trip.
        // Any failure (network, non-2xx, exception) lands in the retry queue and the
        // cron drainer takes over with exponential backoff.
        $result = FrakWebhookHelper::send($order_id, $webhook_status, $token);

        if (is_array($result) && !empty($result['success'])) {
            PrestaShopLogger::addLog('FrakIntegration: Webhook sent successfully for order ' . $order_id, 1);
            return;
        }

        $error = is_array($result) && isset($result['error'])
            ? (string) $result['error']
            : 'Unknown webhook error';
        PrestaShopLogger::addLog('FrakIntegration: Webhook failed for order ' . $order_id . ', enqueuing for retry: ' . $error, 3);
        FrakWebhookQueue::enqueue($order_id, $webhook_status, $token, $error);
    }

    public function hookDisplayOrderConfirmation($params)
    {
        return $this->renderPostPurchase($params['order'] ?? null, 'order-confirmation');
    }

    /**
     * Customer-facing My-Account → Orders → Detail view. Mirrors WordPress's
     * `woocommerce_view_order` coverage — the SDK is idempotent on the
     * `(customerId, orderId, token)` triple, so re-firing on every detail-page
     * load is intentional: keeps attribution working when the merchant lands
     * on the order detail without having gone through the post-checkout
     * thank-you page (e.g. came back via the order email link).
     */
    public function hookDisplayOrderDetail($params)
    {
        return $this->renderPostPurchase($params['order'] ?? null, 'view-order');
    }

    /**
     * Shared body for the order-confirmation and order-detail hooks. Resolves
     * the SDK context + product list once via {@see FrakOrderResolver}, then
     * builds the `<frak-post-purchase>` markup and the inline tracker
     * `<script>`. The two are concatenated and handed to the Smarty wrapper
     * partial so themes can override the surrounding markup without breaking
     * the component contract.
     *
     * Returns an empty string on missing / unloaded orders so the hook is a
     * no-op for malformed dispatches (PrestaShop generally guarantees a valid
     * Order object on these hooks, but the guard is cheap and keeps phpstan
     * happy).
     *
     * `Validate::isLoadedObject()` confirms the Order has a non-zero id and
     * loaded successfully — catches deleted-order edge cases that surfaced
     * in production for both Magento and WordPress siblings.
     *
     * @param mixed  $order     Resolved Order object from the hook params.
     * @param string $placement  Placement identifier forwarded to the SDK.
     */
    private function renderPostPurchase($order, string $placement): string
    {
        if (!$order || !Validate::isLoadedObject($order)) {
            return '';
        }

        $data = FrakOrderResolver::getPostPurchaseData($order);

        $attrs = $data['context'] + ['placement' => $placement];
        if ($data['products'] !== null) {
            $products_json = json_encode(
                $data['products'],
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
            );
            if (is_string($products_json)) {
                $attrs['products'] = $products_json;
            }
        }

        $html = FrakComponentRenderer::postPurchase($attrs)
            . FrakComponentRenderer::purchaseTrackerScript($data['context']);

        $this->context->smarty->assign('frak_post_purchase_html', $html);
        return $this->display(__FILE__, 'views/templates/hook/post-purchase.tpl');
    }


    public function getContent()
    {
        Tools::redirectAdmin($this->context->link->getAdminLink('AdminFrakIntegration'));
    }
}
