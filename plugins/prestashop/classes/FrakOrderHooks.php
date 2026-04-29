<?php

/**
 * Order-surface hook handlers for the Frak PrestaShop module.
 *
 * Owns three responsibilities pulled out of the `FrakIntegration` bootstrap:
 *   - `actionOrderStatusPostUpdate`: maps PrestaShop order state ids to
 *     Frak webhook statuses, attempts a synchronous dispatch, falls back
 *     to the retry queue on failure.
 *   - `<frak-post-purchase>` rendering with full order context (Smarty
 *     wrapper for theme overrides).
 *   - Inline `trackPurchaseStatus` script always emitted on order-page
 *     hooks, regardless of placement state.
 *
 * Mirrors the WordPress sibling's `Frak_WooCommerce` class — both plugins
 * resolve the same `(customerId, orderId, token)` triple, fire the SDK call
 * unconditionally for attribution reliability, and wrap the post-purchase
 * card in a theme-overridable template partial.
 */
class FrakOrderHooks
{
    /**
     * Post-commit order status handler. Maps the new state to a Frak
     * status, attempts a synchronous dispatch with tight timeouts, and on
     * any failure enqueues the order id into `frak_webhook_queue` for cron
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
     *
     * @param array<string, mixed> $params Hook parameters from PrestaShop.
     */
    public static function onStatusUpdate(array $params): void
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

        // First attempt is synchronous so the happy path completes in one
        // round-trip. Pass the already-loaded `Order` so
        // `FrakWebhookHelper::send()` skips the duplicate `new Order($id)`
        // round-trip. Any failure (network, non-2xx, exception) lands in
        // the retry queue and the cron drainer takes over with exponential
        // backoff.
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
     * {@see self::renderPostPurchase()}.
     *
     * @param mixed $order Resolved Order object from the hook params.
     */
    public static function renderPurchaseTracker($order): string
    {
        if (!$order || !Validate::isLoadedObject($order)) {
            return '';
        }
        return FrakComponentRenderer::purchaseTrackerScript(
            FrakOrderResolver::getContext($order)
        );
    }

    /**
     * Render the opt-in `<frak-post-purchase>` card for the order-confirmation
     * and order-detail hooks. Resolves the SDK context + product list once via
     * {@see FrakOrderResolver}, builds the component markup, and hands it to
     * the Smarty wrapper partial so themes can override the surrounding markup
     * without breaking the component contract.
     *
     * The inline tracker `<script>` is NOT emitted from here — it is fired
     * independently by {@see self::renderPurchaseTracker()} on every
     * order-page hook dispatch so attribution keeps working even when the
     * merchant disables the post-purchase placement toggle. Mirrors the
     * WordPress sibling, which fires the tracker unconditionally on
     * `woocommerce_thankyou` / `woocommerce_view_order` regardless of whether
     * the post-purchase block is placed.
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
     * @param Module $module    FrakIntegration instance — needed for
     *                          `$module->display()` (Smarty wrapper) and
     *                          `$module->context->smarty->assign()`.
     * @param mixed  $order     Resolved Order object from the hook params.
     * @param string $placement Placement identifier forwarded to the SDK.
     */
    public static function renderPostPurchase(Module $module, $order, string $placement): string
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

        $module->context->smarty->assign('frak_post_purchase_html', $html);
        // `$module->getLocalPath() . $module->name . '.php'` resolves to the
        // module bootstrap file. PrestaShop's `Module::display()` uses the
        // first arg only to derive the module slug for template lookups, so
        // any path inside the module dir works — but matching the bootstrap
        // file makes the call site read identically to the legacy in-class
        // `$this->display(__FILE__, ...)` it replaces.
        return $module->display(
            $module->getLocalPath() . $module->name . '.php',
            'views/templates/hook/post-purchase.tpl'
        );
    }
}
