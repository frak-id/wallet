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
     * - `actionFrontControllerSetMedia`: SDK script + JS def injection.
     *   Replaces the legacy `header` hook + raw `<script>` tag in
     *   `head.tpl` so the SDK goes through PrestaShop's native asset
     *   manager (CCC-aware, deduped across modules, defer-attribute
     *   capable). Mirrors the WordPress sibling's
     *   `wp_enqueue_script(..., strategy:defer, in_footer:true)` pattern.
     * - `header`: minimal — emits resource hints (DNS-prefetch /
     *   preconnect) and the inline FrakSetup config block. Resource
     *   hints MUST live in `<head>` to be effective.
     * - `actionOrderStatusPostUpdate`: post-commit order status webhook
     *   trigger. Pre-commit `actionOrderStatusUpdate` raced under
     *   multistore / high load (PrestaShop docs explicitly recommend
     *   post-commit).
     */
    private const CORE_HOOKS = [
        'header',
        'actionFrontControllerSetMedia',
        'actionOrderStatusPostUpdate',
    ];

    /**
     * Idempotency flag for {@see registerSmartyPlugins()}. Set on first
     * registration so subsequent module instantiations within the same
     * request short-circuit. Mirrors WordPress's
     * `Frak_Plugin::init()`-runs-once pattern.
     */
    private static bool $smartyRegistered = false;

    public function __construct()
    {
        $this->name = 'frakintegration';
        $this->tab = 'front_office_features';
        $this->version = '1.0.1';
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
        // {frak_post_purchase}) are scoped to the front-office Smarty
        // instance. Registration is gated on a static flag so the
        // unregister/register pair runs at most once per request — PS news
        // up the module class multiple times per request (header hook,
        // dispatch, admin link), and re-registering the three plugins on
        // every instantiation was wasted work.
        if (!defined('_PS_ADMIN_DIR_')) {
            $this->registerSmartyPlugins();
        }
    }

    public function install(): bool
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

        // Async webhook infrastructure: queue + cache tables + per-shop cron
        // token. Both tables must be in place before any order status
        // transition can happen, otherwise enqueue() / merchant resolution /
        // the cron URL would silently fail. Schema lives in
        // `sql/install.php` so the install lifecycle is discoverable from
        // the standard PrestaShop module layout. The cron token gates the
        // front controller via `hash_equals`; rotating it would break any
        // merchant cron job already wired against the displayed URL, so the
        // value is generated only when missing — keeps re-installs after a
        // partial uninstall safe.
        // `$sql` is populated by the included file. Declared here so
        // phpstan can see the contract across the include boundary.
        $sql = [];
        include __DIR__ . '/sql/install.php';
        foreach ($sql as $query) {
            if (!Db::getInstance()->execute($query)) {
                return false;
            }
        }
        if ((string) Configuration::get('FRAK_CRON_TOKEN') === '') {
            Configuration::updateValue('FRAK_CRON_TOKEN', bin2hex(random_bytes(32)));
        }

        // Seed the bundled placements row with each placement's declared
        // default. Opt-out for the legacy product / order surfaces, opt-in
        // for the new auxiliary surfaces — keeps existing storefronts
        // visually unchanged on upgrade.
        FrakPlacementRegistry::seedDefaults();
        return true;
    }

    public function uninstall(): bool
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
        // Pre-1.0.1 dev-only Configuration rows — the resolver reads from
        // the `frak_cache` table now, but we still sweep these so a dev
        // shop that ran an unreleased iteration of the module locally
        // doesn't leave orphaned rows behind.
        Configuration::deleteByName(FrakMerchantResolver::LEGACY_CONFIG_KEY);
        Configuration::deleteByName(FrakMerchantResolver::LEGACY_NEGATIVE_CACHE_KEY);
        FrakPlacementRegistry::clearAll();
        // Schema teardown lives in `sql/uninstall.php` for symmetry with install.
        // SQL errors are swallowed: uninstall is best-effort and PrestaShop already
        // truncated `ps_hook_module` via `parent::uninstall()` regardless.
        $sql = [];
        include __DIR__ . '/sql/uninstall.php';
        foreach ($sql as $query) {
            Db::getInstance()->execute($query);
        }
        return true;
    }

    /**
     * Front-office `<head>` hook — kept minimal. Emits resource hints
     * (`dns-prefetch` + `preconnect`) so the browser warms the TLS
     * handshake to `cdn.jsdelivr.net` while parsing continues, plus the
     * inline `window.FrakSetup` config block (kept inline so the SDK reads
     * a non-empty config when it runs from the deferred script tag).
     *
     * The SDK script tag itself lives in
     * {@see hookActionFrontControllerSetMedia()} — outside the `<head>`
     * dispatch path, in PrestaShop's native asset pipeline.
     */
    public function hookHeader()
    {
        // Single batched read so we touch the autoload cache once. The brand
        // pair is the only Configuration data the front-office head needs;
        // everything else lives in the bundled placement row or `frak_cache`.
        $config = Configuration::getMultiple(['FRAK_SHOP_NAME', 'FRAK_LOGO_URL', 'PS_SHOP_NAME']);
        $shop_name = ($config['FRAK_SHOP_NAME'] ?? '') ?: ($config['PS_SHOP_NAME'] ?? '');
        $logo_url = $config['FRAK_LOGO_URL'] ?? '';

        // Bypass Smarty: the head fragment is 3 lines of HTML and 2 escaped
        // values, both of which `json_encode` produces JS-safe string
        // literals for (covers `<`, `>`, `'`, `"`, control chars, unicode).
        // Avoiding the Smarty parser/render saves a real-but-small amount of
        // CPU on every front-office request — measurable in flame graphs on
        // high-traffic shops.
        $shop_name_js = json_encode((string) $shop_name, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $logo_url_js = json_encode((string) $logo_url, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($shop_name_js === false) {
            $shop_name_js = '""';
        }
        if ($logo_url_js === false) {
            $logo_url_js = '""';
        }

        return '<link rel="dns-prefetch" href="https://cdn.jsdelivr.net">'
            . '<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>'
            . '<script>window.FrakSetup=Object.assign(window.FrakSetup||{},{config:{metadata:{'
            . 'name:' . $shop_name_js . ','
            . 'logoUrl:' . $logo_url_js
            . '}}});</script>';
    }

    /**
     * Register the SDK external script via PrestaShop's native asset
     * manager. Runs on every front-office request (the hook fires before
     * the controller renders), so the `<script>` ends up in the position
     * the asset manager picks (typically bottom-of-body) with the `defer`
     * attribute we requested.
     *
     * Why `actionFrontControllerSetMedia` instead of inline `<script>` in
     * `head.tpl`:
     *   - PrestaShop's CCC (Combine, Compress, Cache) pipeline is asset-
     *     manager aware: registered remote scripts are deduped if another
     *     module asks for the same URL, and the merchant retains control
     *     via `Performance → CCC`.
     *   - `priority => 200` runs the SDK after PrestaShop's own scripts so
     *     the inline `window.FrakSetup` block from `head.tpl` is guaranteed
     *     to be evaluated before the deferred SDK boots.
     *   - Mirrors the WordPress sibling's
     *     `wp_enqueue_script('frak-sdk', ..., strategy:defer, in_footer:true)`
     *     ({@see plugins/wordpress/includes/class-frak-frontend.php}).
     */
    public function hookActionFrontControllerSetMedia()
    {
        if (!isset($this->context->controller) || !method_exists($this->context->controller, 'registerJavascript')) {
            return;
        }
        // Skip on AJAX: registerJavascript writes into the asset queue that
        // only the full HTML response materialises. AJAX endpoints (cart
        // updates, search-as-you-type, theme JSON polls) never render the
        // queue, so registering here is wasted work — noticeable on chatty
        // themes that fire dozens of XHRs per page lifecycle.
        if (!empty($this->context->controller->ajax)) {
            return;
        }
        $this->context->controller->registerJavascript(
            'frak-sdk',
            'https://cdn.jsdelivr.net/npm/@frak-labs/components',
            [
                'server' => 'remote',
                'position' => 'bottom',
                'priority' => 200,
                'attribute' => 'defer',
            ]
        );
    }

    public function hookDisplayProductAdditionalInfo($params = [])
    {
        return $this->dispatchHook('displayProductAdditionalInfo', is_array($params) ? $params : []);
    }

    /**
     * Post-commit order status hook. Maps the new state to a Frak status,
     * attempts a synchronous dispatch with tight timeouts, and on any
     * failure enqueues the order id into `frak_webhook_queue` for cron
     * retry.
     *
     * Hot-path order matters here:
     *   1. Cheap guards first (params shape, status object).
     *   2. Skip-list check via batched `Configuration::getMultiple()` —
     *      single autoload-cache hit instead of 7 separate lookups for the
     *      `PS_OS_*` ids. Most state transitions on a busy shop go through
     *      `preparation → shipping`, both of which are skipped, so this
     *      path returns before paying for an `Order` instantiation.
     *   3. Order load + secure key + customer (only on transitions we
     *      actually deliver).
     *   4. Synchronous dispatch with the pre-loaded `Order` passed in so
     *      `FrakWebhookHelper::send()` doesn't re-load it from the DB —
     *      single object, single round-trip per delivery.
     *
     * Logging dropped to error-only on the happy path. The previous
     * 5-rows-per-transition spam ("Triggered" / "Started" / "Sent
     * successfully") wrote to `ps_log` synchronously and contained zero
     * actionable information; failures still log via {@see FrakLogger}
     * (which forwards `LEVEL_ERROR` to `PrestaShopLogger`) so the
     * Advanced Parameters → Logs surface keeps the same failure trail.
     */
    public function hookActionOrderStatusPostUpdate($params)
    {
        $new_status = $params['newOrderStatus'] ?? null;
        $order_id = (int) ($params['id_order'] ?? 0);

        if (!$new_status || !$order_id) {
            return;
        }

        // Batch the `PS_OS_*` lookup so we pay one Configuration::getMultiple
        // round-trip instead of seven. The autoload cache makes individual
        // calls cheap, but skipping a few hashmap lookups in the hot path is
        // free if we're touching the autoload cache anyway.
        $os_ids = Configuration::getMultiple([
            'PS_OS_WS_PAYMENT',
            'PS_OS_PAYMENT',
            'PS_OS_DELIVERED',
            'PS_OS_CANCELED',
            'PS_OS_REFUND',
            'PS_OS_SHIPPING',
            'PS_OS_PREPARATION',
        ]);

        $skip_status_codes = [
            (int) ($os_ids['PS_OS_SHIPPING'] ?? 0),
            (int) ($os_ids['PS_OS_PREPARATION'] ?? 0),
        ];

        // Skip BEFORE loading the Order — `preparation` and `shipping`
        // transitions are common on a busy shop and we don't want to pay
        // an `Order` instantiation just to throw the result away.
        if (in_array((int) $new_status->id, $skip_status_codes, true)) {
            return;
        }

        $order = new Order($order_id);
        if (!Validate::isLoadedObject($order)) {
            FrakLogger::warning('order ' . $order_id . ' not loadable in postUpdate hook');
            return;
        }

        $token = (string) $order->secure_key;

        $status_map = [
            (int) ($os_ids['PS_OS_WS_PAYMENT'] ?? 0) => 'confirmed',
            (int) ($os_ids['PS_OS_PAYMENT'] ?? 0) => 'confirmed',
            (int) ($os_ids['PS_OS_DELIVERED'] ?? 0) => 'confirmed',
            (int) ($os_ids['PS_OS_CANCELED'] ?? 0) => 'cancelled',
            (int) ($os_ids['PS_OS_REFUND'] ?? 0) => 'refunded',
        ];

        $webhook_status = $status_map[(int) $new_status->id] ?? 'pending';

        // First attempt is synchronous so the happy path completes in one round-trip.
        // Pass the already-loaded `Order` so `FrakWebhookHelper::send()` skips the
        // duplicate `new Order($id)` round-trip. Any failure (network, non-2xx,
        // exception) lands in the retry queue and the cron drainer takes over with
        // exponential backoff.
        $result = FrakWebhookHelper::send($order_id, $webhook_status, $token, $order);

        if (is_array($result) && !empty($result['success'])) {
            return;
        }

        $error = is_array($result) && isset($result['error'])
            ? (string) $result['error']
            : 'Unknown webhook error';
        FrakLogger::error(
            'Webhook failed for order ' . $order_id . ', enqueuing for retry: ' . $error
        );
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
     * for `$hook`, gates each on its bundled-storage flag, and concatenates
     * the rendered markup. The component-specific render paths still live
     * on `FrakComponentRenderer` (banner / share button) or the local
     * `renderPostPurchase()` helper (post-purchase + tracker script +
     * Smarty wrapper); this method is just the routing layer.
     *
     * `FrakPlacementRegistry::isEnabled()` resolves through a per-request
     * static cache, so a page firing multiple display hooks (e.g. a
     * product page with `displayTop` + `displayProductAdditionalInfo` +
     * `displayShoppingCart`) only decodes the bundled storage row once.
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
     * up the bootstrap. Idempotent across instantiations within the same
     * request via the {@see self::$smartyRegistered} static flag.
     */
    private function registerSmartyPlugins(): void
    {
        if (self::$smartyRegistered) {
            return;
        }
        if (!isset($this->context) || !isset($this->context->smarty)) {
            return;
        }
        $smarty = $this->context->smarty;
        if (!is_object($smarty) || !method_exists($smarty, 'registerPlugin')) {
            return;
        }
        // `registerPlugin` throws when called twice for the same name on the
        // same Smarty instance — guard with `unregisterPlugin` so the first
        // module instantiation in the request stays robust against any
        // earlier registration (e.g. another plugin claiming the same name).
        $callbacks = [
            'frak_banner' => [self::class, 'smartyFunctionBanner'],
            'frak_share_button' => [self::class, 'smartyFunctionShareButton'],
            'frak_post_purchase' => [self::class, 'smartyFunctionPostPurchase'],
        ];
        foreach ($callbacks as $name => $callback) {
            if (method_exists($smarty, 'unregisterPlugin')) {
                @$smarty->unregisterPlugin('function', $name);
            }
            $smarty->registerPlugin('function', $name, $callback);
        }
        self::$smartyRegistered = true;
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
