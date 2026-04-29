<?php

if (!defined('_PS_VERSION_')) {
    exit;
}

require_once __DIR__ . '/vendor/autoload.php';

/**
 * Frak PrestaShop module bootstrap.
 *
 * PrestaShop discovers hook handlers by reflection on the Module subclass,
 * so every `hookXxx()` method MUST live on this class. To keep the bootstrap
 * a thin router, each hook handler delegates to a stateless helper in
 * `classes/`:
 *
 *   - {@see FrakInstaller}        : install / uninstall lifecycle.
 *   - {@see FrakFrontend}         : `header` + `actionFrontControllerSetMedia`.
 *   - {@see FrakOrderWebhook}     : `actionOrderStatusPostUpdate` (server-side webhook + retry queue).
 *   - {@see FrakOrderRender}      : tracker `<script>` + post-purchase Smarty wrapper for order pages.
 *   - {@see FrakDisplayDispatcher}: placement-driven `display*` hooks.
 *   - {@see FrakSmartyPlugins}    : `{frak_banner|share_button|post_purchase}`.
 *
 * Mirrors the WordPress sibling's split between `frak-integration.php` (entry
 * point) and `class-frak-frontend.php` / `class-frak-woocommerce.php` /
 * `class-frak-shortcodes.php` (per-surface handlers).
 */
class FrakIntegration extends Module
{
    public function __construct()
    {
        $this->name = 'frakintegration';
        $this->tab = 'front_office_features';
        $this->version = '1.0.1';
        $this->author = 'Frak';
        $this->need_instance = 0;
        $this->ps_versions_compliancy = [
            'min' => '8.1.0',
            'max' => _PS_VERSION_,
        ];
        $this->bootstrap = true;

        // Admin sidebar entry. PrestaShop's `ModuleTabRegister` runs on
        // `ModuleManagementEvent::INSTALL` and auto-detects every
        // `controllers/admin/*Controller.php`; controllers NOT declared in
        // `$this->tabs` get registered with `visible = 0` (see
        // `ModuleTabRegister::addUndeclaredTabs()`), which keeps the
        // configuration page routable through Module Manager → Configure
        // but hides the entry from the back-office sidebar. Declaring it
        // here pins `visible = 1` and parents the row under Modules so the
        // daily-ops shortcut (queue health · Drain queue · Refresh
        // merchant) is one click away. Mirrors `upgrade/install-1.0.1.php`
        // step 9 (manual `Tab::add()` for upgraded installs); idempotent
        // on re-install — `ModuleTabRegister::checkIsValid()` skips when
        // a row already exists.
        $this->tabs = [
            [
                'class_name' => 'AdminFrakIntegration',
                'visible' => true,
                'name' => 'Frak',
                'parent_class_name' => 'AdminParentModulesSf',
            ],
        ];

        parent::__construct();

        $this->displayName = $this->l('Frak');
        $this->description = $this->l('Integrates Frak services with PrestaShop.');

        $this->confirmUninstall = $this->l('Are you sure you want to uninstall?');

        // Smarty function plugins ({frak_banner}, {frak_share_button},
        // {frak_post_purchase}) are scoped to the front-office Smarty
        // instance only — admin renders own a separate Smarty and never
        // emit a Frak component through these handlers.
        if (!defined('_PS_ADMIN_DIR_')) {
            FrakSmartyPlugins::register($this->context);
        }
    }

    public function install(): bool
    {
        return parent::install() && FrakInstaller::install($this);
    }

    public function uninstall(): bool
    {
        return parent::uninstall() && FrakInstaller::uninstall($this);
    }

    public function getContent()
    {
        Tools::redirectAdmin($this->context->link->getAdminLink('AdminFrakIntegration'));
    }

    /**
     * Front-office `<head>` hook — resource hints + inline `window.FrakSetup`.
     */
    public function hookHeader()
    {
        return FrakFrontend::head();
    }

    /**
     * Asset-pipeline registration of the SDK script (`defer`, bottom).
     */
    public function hookActionFrontControllerSetMedia()
    {
        FrakFrontend::setMedia($this->context);
    }

    /**
     * Post-commit order status webhook trigger — synchronous attempt then
     * fall back to the retry queue on failure.
     */
    public function hookActionOrderStatusPostUpdate($params)
    {
        FrakOrderWebhook::onStatusUpdate($params);
    }

    /**
     * Credit-slip / refund webhook trigger. Fires on every `OrderSlip`
     * creation — full refunds, partial refunds, and standard returns alike
     * — so the Frak backend voids attribution as soon as the merchant
     * issues any refund. Mirrors the WC backend's `refunds[]` and Magento's
     * `sales_order_creditmemo_save_after` rules.
     */
    public function hookActionOrderSlipAdd($params)
    {
        FrakOrderWebhook::onOrderSlipAdd($params);
    }

    /**
     * Product page — `share_product` placement (share-button on PDP).
     */
    public function hookDisplayProductAdditionalInfo($params = [])
    {
        return FrakDisplayDispatcher::dispatch($this, 'displayProductAdditionalInfo', $params);
    }

    /**
     * Order confirmation page — always-on tracker script + opt-in post-purchase card.
     */
    public function hookDisplayOrderConfirmation($params)
    {
        $tracker = FrakOrderRender::purchaseTracker($params['order'] ?? null);
        return $tracker . FrakDisplayDispatcher::dispatch($this, 'displayOrderConfirmation', $params);
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
        $tracker = FrakOrderRender::purchaseTracker($params['order'] ?? null);
        return $tracker . FrakDisplayDispatcher::dispatch($this, 'displayOrderDetail', $params);
    }

    /**
     * Front-office banner above the storefront content. Driven by the
     * `banner_top` placement — disabled by default to avoid changing the
     * storefront on upgrade.
     */
    public function hookDisplayTop($params = [])
    {
        return FrakDisplayDispatcher::dispatch($this, 'displayTop', $params);
    }

    /**
     * Cron-job hook invoked by `ps_cronjobs` when it is installed and
     * enabled. Drains the webhook retry queue, mirroring what the
     * URL-token front controller does — so merchants on `ps_cronjobs`
     * get the cron wired up automatically without copy-pasting the URL.
     *
     * Both code paths are idempotent against `FrakWebhookCron::run()`'s
     * MySQL `GET_LOCK` advisory lock (see {@see FrakLock}), so a merchant
     * who runs BOTH `ps_cronjobs` and a server-level cron against the URL
     * never double-drains.
     *
     * The handler is a no-op return so `ps_cronjobs` doesn't render any
     * Frak output through its own admin UI.
     */
    public function hookActionCronJob($params = [])
    {
        FrakWebhookCron::run();
    }

    /**
     * Frequency descriptor read by `ps_cronjobs` when registering this
     * module's cron job. `-1` is the equivalent of `*` in Unix-cron syntax,
     * so the schedule is "every hour, every day, every month, every day of
     * the week" — hourly, the finest granularity `ps_cronjobs` exposes.
     *
     * Merchants who need the 5-minute backoff cadence can still wire a
     * server-level cron against the URL-token controller instead; the two
     * paths share the same drainer and {@see FrakLock}'s advisory lock makes
     * them safe to run in parallel.
     *
     * @return array{hour:int,day:int,month:int,day_of_week:int}
     */
    public function getCronFrequency(): array
    {
        return [
            'hour' => -1,
            'day' => -1,
            'month' => -1,
            'day_of_week' => -1,
        ];
    }
}
