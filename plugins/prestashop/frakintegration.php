<?php

if (!defined('_PS_VERSION_')) {
    exit;
}

require_once __DIR__ . '/vendor/autoload.php';

class FrakIntegration extends Module
{
    /**
     * Always-on plumbing hooks. Display hooks are owned by
     * `FrakPlacementRegistry` and registered via `distinctHooks()`.
     *
     * - `header`: SDK config injection on every front-office request.
     * - `actionOrderStatusPostUpdate`: post-commit order status webhook trigger.
     *   Pre-commit `actionOrderStatusUpdate` raced under multistore / high
     *   load (PrestaShop docs explicitly recommend post-commit).
     */
    private const CORE_HOOKS = ['header', 'actionOrderStatusPostUpdate'];

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

        // Smarty function plugins ({frak_banner}, {frak_share_button},
        // {frak_post_purchase}) are scoped to the front-office Smarty instance.
        // Registering them on every module instantiation is cheap (one map
        // insert per plugin) and keeps the templates working from any theme
        // file or CMS page without merchant-side bootstrap.
        if (!defined('_PS_ADMIN_DIR_')) {
            $this->registerSmartyPlugins();
        }
    }

    public function install()
    {
        if (!parent::install()) {
            return false;
        }
        // Always-on plumbing hooks (CORE_HOOKS) plus every placement-driven
        // display hook from `FrakPlacementRegistry::distinctHooks()`. One loop
        // = one place to add/remove a hook on the install path — keeps the
        // install / uninstall / upgrade chains in lock-step.
        foreach (array_merge(self::CORE_HOOKS, FrakPlacementRegistry::distinctHooks()) as $hook) {
            if (!$this->registerHook($hook)) {
                return false;
            }
        }

        // Seed sane defaults from the PrestaShop shop record. Anything else
        // (i18n, modal language, share-button copy/style) is now resolved by
        // the SDK against business.frak.id once the merchant is registered.
        Configuration::updateValue('FRAK_SHOP_NAME', Configuration::get('PS_SHOP_NAME'));
        Configuration::updateValue('FRAK_LOGO_URL', $this->context->link->getMediaLink(_PS_IMG_ . Configuration::get('PS_LOGO')));

        // Async webhook infrastructure: queue table + per-shop cron token.
        // Both must be in place before any order status transition can happen,
        // otherwise enqueue() / the cron URL would silently fail. Schema lives
        // in `sql/install.php` so the install lifecycle is discoverable from the
        // standard PrestaShop module layout. The cron token gates the front
        // controller via `hash_equals`; rotating it would break any merchant cron
        // job already wired against the displayed URL, so the value is generated
        // only when missing — keeps re-installs after a partial uninstall safe.
        include __DIR__ . '/sql/install.php';
        foreach ($sql as $query) {
            if (!Db::getInstance()->execute($query)) {
                return false;
            }
        }
        if ((string) Configuration::get('FRAK_CRON_TOKEN') === '') {
            Configuration::updateValue('FRAK_CRON_TOKEN', bin2hex(random_bytes(32)));
        }

        // Seed every placement’s on/off flag with its declared default. Opt-out
        // for the legacy product / order surfaces, opt-in for the new auxiliary
        // surfaces — keeps existing storefronts visually unchanged on upgrade.
        FrakPlacementRegistry::seedDefaults();

        if (!$this->registerAdminTab()) {
            return false;
        }
        return true;
    }

    public function uninstall()
    {
        if (!parent::uninstall()) {
            return false;
        }
        // Symmetric with install(); `parent::uninstall()` already truncates
        // the module's `ps_hook_module` rows but the explicit chain keeps test
        // teardown deterministic and surfaces failures clearly.
        foreach (array_merge(self::CORE_HOOKS, FrakPlacementRegistry::distinctHooks()) as $hook) {
            if (!$this->unregisterHook($hook)) {
                return false;
            }
        }

        Configuration::deleteByName('FRAK_SHOP_NAME');
        Configuration::deleteByName('FRAK_LOGO_URL');
        Configuration::deleteByName('FRAK_WEBHOOK_SECRET');
        Configuration::deleteByName('FRAK_SETTINGS_VERSION');
        Configuration::deleteByName('FRAK_CRON_TOKEN');
        Configuration::deleteByName(FrakMerchantResolver::CONFIG_KEY);
        Configuration::deleteByName(FrakMerchantResolver::NEGATIVE_CACHE_KEY);
        FrakPlacementRegistry::clearAll();
        // Schema teardown lives in `sql/uninstall.php` for symmetry with install.
        // SQL errors are swallowed: uninstall is best-effort and PrestaShop already
        // truncated `ps_hook_module` via `parent::uninstall()` regardless.
        include __DIR__ . '/sql/uninstall.php';
        foreach ($sql as $query) {
            Db::getInstance()->execute($query);
        }
        $this->unregisterAdminTab();
        return true;
    }

    /**
     * Register the admin sidebar entry pointing at `AdminFrakIntegrationController`.
     *
     * Idempotent — checks for an existing Tab row by `class_name` first so
     * re-running after a partial install never duplicates the entry. Fall-back
     * parent is the top-level (`id_parent = 0`) on PS installs that lack
     * `AdminParentModulesSf` (extremely old / customised back-offices).
     *
     * Sits under “Modules” in the sidebar (sibling of Module Manager): the page
     * surfaces operational tooling (queue health, Drain queue, Refresh merchant)
     * that benefits from one-click access for daily ops, not just one-time
     * configuration. The Tab also wires the controller into PrestaShop's
     * standard Permissions panel so shop admins can grant/revoke per-employee
     * access without code changes.
     */
    private function registerAdminTab(): bool
    {
        if ((int) Tab::getIdFromClassName('AdminFrakIntegration') > 0) {
            return true;
        }
        $tab = new Tab();
        $tab->active = 1;
        $tab->class_name = 'AdminFrakIntegration';
        $tab->name = [];
        foreach (Language::getLanguages(true) as $lang) {
            $tab->name[$lang['id_lang']] = $this->l('Frak');
        }
        $tab->id_parent = (int) Tab::getIdFromClassName('AdminParentModulesSf');
        $tab->module = $this->name;
        return (bool) $tab->add();
    }

    /**
     * Drop the admin sidebar entry. Idempotent — a missing Tab is treated as
     * already-uninstalled (returns true) so partial uninstalls do not block
     * the rest of the cleanup chain.
     */
    private function unregisterAdminTab(): bool
    {
        $idTab = (int) Tab::getIdFromClassName('AdminFrakIntegration');
        if ($idTab <= 0) {
            return true;
        }
        $tab = new Tab($idTab);
        return (bool) $tab->delete();
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

    public function hookDisplayProductAdditionalInfo($params = [])
    {
        return $this->dispatchHook('displayProductAdditionalInfo', is_array($params) ? $params : []);
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
        $params = is_array($params) ? $params : [];
        $tracker = $this->renderPurchaseTracker($params['order'] ?? null);
        return $tracker . $this->dispatchHook('displayOrderConfirmation', $params);
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
        $params = is_array($params) ? $params : [];
        $tracker = $this->renderPurchaseTracker($params['order'] ?? null);
        return $tracker . $this->dispatchHook('displayOrderDetail', $params);
    }

    /**
     * Render the opt-in `<frak-post-purchase>` card for the order-confirmation
     * and order-detail hooks. Resolves the SDK context + product list once via
     * {@see FrakOrderResolver}, builds the component markup, and hands it to
     * the Smarty wrapper partial so themes can override the surrounding markup
     * without breaking the component contract.
     *
     * The inline tracker `<script>` is NOT emitted from here — it is fired
     * independently by {@see renderPurchaseTracker()} on every order-page hook
     * dispatch so attribution keeps working even when the merchant disables
     * the post-purchase placement toggle. Mirrors the WordPress sibling, which
     * fires the tracker unconditionally on `woocommerce_thankyou` /
     * `woocommerce_view_order` regardless of whether the post-purchase block
     * is placed.
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
     * @param mixed  $order      Resolved Order object from the hook params.
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

        $html = FrakComponentRenderer::postPurchase($attrs);

        $this->context->smarty->assign('frak_post_purchase_html', $html);
        return $this->display(__FILE__, 'views/templates/hook/post-purchase.tpl');
    }

    /**
     * Always-on inline tracker for the order-confirmation and order-detail
     * hooks. Emits the `<script>` that calls `trackPurchaseStatus` once the
     * SDK client is ready, regardless of whether the visible
     * `<frak-post-purchase>` component placement is enabled — so disabling
     * the card via the placement registry never breaks attribution.
     *
     * Mirrors WordPress's `Frak_WooCommerce::render_purchase_tracker_for_order`
     * which fires unconditionally on `woocommerce_thankyou` /
     * `woocommerce_view_order`. Both plugins emit the same
     * `(customerId, orderId, token)` payload so the backend has one contract
     * to maintain.
     *
     * The `<frak-post-purchase>` component (when present) ALSO calls
     * `trackPurchaseStatus` on mount; the SDK is idempotent on the
     * `(customerId, orderId, token)` triple so the duplicate call when both
     * surfaces fire is intentional and safe.
     *
     * Returns an empty string on missing / unloaded orders so the hook is a
     * no-op for malformed dispatches — same guard shape as
     * {@see renderPostPurchase()}.
     *
     * @param mixed $order Resolved Order object from the hook params.
     */
    private function renderPurchaseTracker($order): string
    {
        if (!$order || !Validate::isLoadedObject($order)) {
            return '';
        }
        return FrakComponentRenderer::purchaseTrackerScript(
            FrakOrderResolver::getContext($order)
        );
    }


    public function getContent()
    {
        Tools::redirectAdmin($this->context->link->getAdminLink('AdminFrakIntegration'));
    }

    /**
     * Front-office banner above the storefront content. Driven by the
     * `banner_top` placement — disabled by default to avoid changing the
     * storefront on upgrade.
     */
    public function hookDisplayTop($params = [])
    {
        return $this->dispatchHook('displayTop', is_array($params) ? $params : []);
    }

    /**
     * Homepage-only banner. Driven by the `banner_home` placement.
     */
    public function hookDisplayHome($params = [])
    {
        return $this->dispatchHook('displayHome', is_array($params) ? $params : []);
    }

    /**
     * Cart summary share button. Driven by the `share_cart` placement —
     * useful for “share your cart” referral flows.
     */
    public function hookDisplayShoppingCart($params = [])
    {
        return $this->dispatchHook('displayShoppingCart', is_array($params) ? $params : []);
    }

    /**
     * Generic placement dispatcher — looks up every placement registered
     * for `$hook`, gates each on its `FRAK_PLACEMENT_*` Configuration toggle,
     * and concatenates the rendered markup. The component-specific render
     * paths still live on `FrakComponentRenderer` (banner / share button) or
     * the local `renderPostPurchase()` helper (post-purchase + tracker
     * script + Smarty wrapper); this method is just the routing layer.
     *
     * @param array<string, mixed> $params Hook parameters forwarded by PrestaShop.
     */
    private function dispatchHook(string $hook, array $params = []): string
    {
        $output = '';
        foreach (FrakPlacementRegistry::forHook($hook) as $id => $placement) {
            if (!FrakPlacementRegistry::isEnabled($id)) {
                continue;
            }
            switch ($placement['component']) {
                case FrakPlacementRegistry::COMPONENT_BANNER:
                    $output .= FrakComponentRenderer::banner([
                        'placement' => $placement['placement_attr'],
                    ]);
                    break;
                case FrakPlacementRegistry::COMPONENT_SHARE_BUTTON:
                    $output .= FrakComponentRenderer::shareButton([
                        'placement' => $placement['placement_attr'],
                    ]);
                    break;
                case FrakPlacementRegistry::COMPONENT_POST_PURCHASE:
                    $output .= $this->renderPostPurchase(
                        $params['order'] ?? null,
                        $placement['placement_attr']
                    );
                    break;
            }
        }
        return $output;
    }

    /**
     * Register the three Smarty function plugins so theme files and CMS
     * pages can drop `<frak-X>` components anywhere via
     * `{frak_banner}`, `{frak_share_button}`, `{frak_post_purchase}`.
     *
     * Smarty plugins are scoped per-Smarty-instance and registered lazily;
     * we re-register on every module instantiation because the cost is
     * negligible (three array writes) and PrestaShop instantiates the module
     * per-request anyway via the `header` hook.
     *
     * The Smarty instance can be unavailable in CLI / install contexts —
     * we guard with an existence check so a missing context does not blow
     * up the bootstrap.
     */
    private function registerSmartyPlugins(): void
    {
        if (!isset($this->context) || !isset($this->context->smarty)) {
            return;
        }
        $smarty = $this->context->smarty;
        if (!is_object($smarty) || !method_exists($smarty, 'registerPlugin')) {
            return;
        }
        // `registerPlugin` throws when called twice for the same name on the
        // same Smarty instance — guard with `unregisterPlugin` so repeated
        // module instantiations within the same request stay idempotent.
        $names = ['frak_banner', 'frak_share_button', 'frak_post_purchase'];
        $callbacks = [
            'frak_banner' => [self::class, 'smartyFunctionBanner'],
            'frak_share_button' => [self::class, 'smartyFunctionShareButton'],
            'frak_post_purchase' => [self::class, 'smartyFunctionPostPurchase'],
        ];
        foreach ($names as $name) {
            if (method_exists($smarty, 'unregisterPlugin')) {
                @$smarty->unregisterPlugin('function', $name);
            }
            $smarty->registerPlugin('function', $name, $callbacks[$name]);
        }
    }

    /**
     * `{frak_banner placement="home" referral_title="..."}` Smarty handler.
     *
     * Snake-cases attribute keys at the boundary so merchants can write
     * naturally-readable templates (`referral_title` over `referralTitle`)
     * — mirrors the WordPress shortcode contract.
     *
     * @param array<string, mixed> $params Smarty-supplied attribute pairs.
     * @param mixed                $smarty Smarty instance (unused).
     */
    public static function smartyFunctionBanner(array $params, $smarty): string
    {
        unset($smarty);
        return FrakComponentRenderer::banner(
            FrakComponentRenderer::snakeKeysToCamel($params)
        );
    }

    /**
     * `{frak_share_button text="Share & earn" use_reward=1}` Smarty handler.
     *
     * @param array<string, mixed> $params Smarty-supplied attribute pairs.
     * @param mixed                $smarty Smarty instance (unused).
     */
    public static function smartyFunctionShareButton(array $params, $smarty): string
    {
        unset($smarty);
        return FrakComponentRenderer::shareButton(
            FrakComponentRenderer::snakeKeysToCamel($params)
        );
    }

    /**
     * `{frak_post_purchase variant="referrer" cta_text="Earn"}` Smarty handler.
     *
     * Emits the bare `<frak-post-purchase>` markup. Order context
     * (`customer-id` / `order-id` / `token`) is NOT auto-injected here —
     * the auto-render hooks (`displayOrderConfirmation`,
     * `displayOrderDetail`) own that path through `renderPostPurchase()`.
     * Templates that need a tracker on a non-order endpoint should pass the
     * triple explicitly via `customer_id`, `order_id`, `token` parameters
     * (snake_case keys are normalised to camelCase before render).
     *
     * @param array<string, mixed> $params Smarty-supplied attribute pairs.
     * @param mixed                $smarty Smarty instance (unused).
     */
    public static function smartyFunctionPostPurchase(array $params, $smarty): string
    {
        unset($smarty);
        return FrakComponentRenderer::postPurchase(
            FrakComponentRenderer::snakeKeysToCamel($params)
        );
    }
}
