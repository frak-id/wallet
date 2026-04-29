<?php

/**
 * Server-side order webhook trigger.
 *
 * Owns two PrestaShop hooks: `actionOrderStatusPostUpdate` (post-commit
 * status transitions) and `actionOrderSlipAdd` (credit-slip / refund
 * creation). Both map their PrestaShop trigger to a Frak webhook status,
 * defer dispatch to PHP shutdown so the merchant's request returns BEFORE
 * the outbound HTTP call fires, and fall back to the retry queue on
 * failure.
 *
 * Mirrors WordPress's `Frak_WC_Webhook_Registrar` and Magento's
 * `Observer/OrderStatusUpdateObserver` — same `(merchantId, externalId,
 * status)` idempotency contract on the backend so all three plugins
 * de-duplicate cleanly. Aligns the credit-slip path with the WC backend's
 * "any non-empty refunds[] -> refunded" rule and Magento's
 * `sales_order_creditmemo_save_after` -> `refunded` mapping: any refund
 * (full or partial) voids attribution.
 *
 * Split out from the legacy `FrakOrderHooks` class so server-side webhook
 * orchestration and client-side rendering live in separate translation
 * units. {@see FrakOrderRender} owns the render path.
 */
class FrakOrderWebhook
{
    /**
     * Post-commit order status handler. Maps the new state to a Frak
     * status, then defers the actual webhook dispatch to PHP shutdown so
     * the merchant's request returns BEFORE the outbound HTTP call fires
     * (see {@see deferDispatch()} for the shutdown machinery).
     *
     * Hot-path order matters here:
     *   1. Cheap guards first (params shape, status object).
     *   2. Skip-list check via batched `Configuration::getMultiple()` —
     *      single autoload-cache hit instead of 9 separate lookups for the
     *      `PS_OS_*` ids. Most state transitions on a busy shop go through
     *      `preparation → shipping`, both of which are skipped, so this
     *      path returns before paying for an `Order` instantiation.
     *   3. Order load (only on transitions we actually deliver).
     *
     * Logging is intentionally minimal: only catastrophic shutdown failures
     * write to `PrestaShopLogger`. Per-webhook delivery failures land in the
     * retry queue (queryable via the admin observability panel) and only
     * surface in `Advanced Parameters → Logs` once they reach the parked
     * state — see {@see FrakWebhookCron::run()}.
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
        // round-trip instead of nine. The autoload cache makes individual
        // calls cheap, but skipping a few hashmap lookups in the hot path is
        // free if we're touching the autoload cache anyway.
        $os_ids = FrakConfig::getOrderStateIds();

        $skip_status_codes = [
            $os_ids['PS_OS_SHIPPING'] ?? 0,
            $os_ids['PS_OS_PREPARATION'] ?? 0,
        ];

        // Skip BEFORE loading the Order — `preparation` and `shipping`
        // transitions are common on a busy shop and we don't want to pay
        // an `Order` instantiation just to throw the result away.
        if (in_array((int) $new_status->id, $skip_status_codes, true)) {
            return;
        }

        $order = new Order($order_id);
        if (!Validate::isLoadedObject($order)) {
            // Race against an order deletion between hook fire and load.
            // No merchant action is possible, so silent return.
            return;
        }

        // PS_OS_OUTOFSTOCK_PAID is `paid=1, logable=1` per
        // `install-dev/data/xml/order_state.xml` — the merchant has been paid,
        // we just can't ship right now. Treating it as `pending` would leave
        // the reward in limbo until a follow-up state change, so confirm now.
        // PS_OS_ERROR (payment failure) is treated as `cancelled` rather than
        // `pending` so a failed-and-abandoned checkout doesn't sit forever in
        // the merchant's purchase tracker.
        $status_map = [
            ($os_ids['PS_OS_WS_PAYMENT'] ?? 0) => 'confirmed',
            ($os_ids['PS_OS_PAYMENT'] ?? 0) => 'confirmed',
            ($os_ids['PS_OS_DELIVERED'] ?? 0) => 'confirmed',
            ($os_ids['PS_OS_OUTOFSTOCK_PAID'] ?? 0) => 'confirmed',
            ($os_ids['PS_OS_CANCELED'] ?? 0) => 'cancelled',
            ($os_ids['PS_OS_ERROR'] ?? 0) => 'cancelled',
            ($os_ids['PS_OS_REFUND'] ?? 0) => 'refunded',
        ];

        $webhook_status = $status_map[(int) $new_status->id] ?? 'pending';

        self::deferDispatch($order_id, $webhook_status, $order);
    }

    /**
     * Credit-slip handler. Fires on `actionOrderSlipAdd`, which PrestaShop
     * emits whenever a credit slip is generated — full refunds, partial
     * refunds, shipping-only refunds, and standard returns alike
     * ({@see PrestaShop\PrestaShop\Adapter\Order\Refund\OrderSlipCreator::createOrderSlip()}).
     *
     * Always emits `refunded` regardless of slip type, mirroring the
     * sister-plugin contract:
     *   - WC backend: any non-empty `refunds[]` -> `refunded`
     *     (`services/backend/src/api/external/merchant/webhook/wooCommerceWebhook.ts:142`).
     *   - Magento: `sales_order_creditmemo_save_after` -> `refunded`
     *     (`plugins/magento/Observer/OrderStatusUpdateObserver.php`).
     *   - Shopify backend: `partially_refunded` -> `refunded`.
     *
     * Why we don't try to differentiate full vs partial: the backend's
     * `PurchaseStatusSchema` only carries 4 statuses (pending/confirmed/
     * cancelled/refunded) and `PurchaseWebhookOrchestrator` collapses both
     * `refunded` and `cancelled` into the same `cancelForRefund` flow that
     * voids any pending rewards and restores the campaign budget. Splitting
     * partial vs full would have no observable effect on attribution.
     *
     * The order's current PrestaShop status is irrelevant here: a credit slip
     * means money has moved back to the customer regardless of whether the
     * order sits in `Delivered`, `Shipped`, etc. The hook caller already
     * holds a loaded `Order` so we skip the duplicate `new Order($id)`
     * round-trip down in `FrakWebhookHelper::send()`.
     *
     * @param array<string, mixed> $params Hook parameters from PrestaShop.
     */
    public static function onOrderSlipAdd(array $params): void
    {
        $order = $params['order'] ?? null;
        if (!($order instanceof Order) || !Validate::isLoadedObject($order)) {
            // Hook contract violation (PrestaShop never emits without an Order)
            // or race against deletion. No merchant action possible.
            return;
        }

        self::deferDispatch((int) $order->id, 'refunded', $order);
    }

    /**
     * Shared shutdown-deferred dispatcher. Hot-path order matters here:
     * we run the outbound HTTP request AFTER the merchant's response is
     * flushed (via `fastcgi_finish_request` / `litespeed_finish_request`)
     * so the order-status / credit-slip transaction commits in <50 ms even
     * when the Frak backend is unreachable. Falls back to a synchronous
     * attempt on SAPIs without flush primitives (CLI imports, mod_php).
     *
     * Any failure (network, non-2xx, exception) lands in the retry queue.
     * The shutdown handler explicitly traps `\Throwable` so a runtime issue
     * still surfaces in `PrestaShopLogger` instead of being silently
     * swallowed by PHP's shutdown machinery.
     */
    private static function deferDispatch(int $order_id, string $webhook_status, Order $order): void
    {
        $dispatch = static function () use ($order_id, $webhook_status, $order): void {
            $result = FrakWebhookHelper::send($order_id, $webhook_status, $order);
            if (is_array($result) && !empty($result['success'])) {
                return;
            }
            $error = is_array($result) && isset($result['error'])
                ? (string) $result['error']
                : 'Unknown webhook error';
            // No log here: the queue row IS the durable record of the
            // failure. The merchant-visible signal is the parked-row
            // log emitted by the cron drainer once retries are exhausted.
            FrakWebhookQueue::enqueue($order_id, $webhook_status, $error);
        };

        if (function_exists('fastcgi_finish_request') || function_exists('litespeed_finish_request')) {
            register_shutdown_function(static function () use ($dispatch): void {
                if (function_exists('fastcgi_finish_request')) {
                    fastcgi_finish_request();
                } elseif (function_exists('litespeed_finish_request')) {
                    litespeed_finish_request();
                }
                try {
                    $dispatch();
                } catch (\Throwable $e) {
                    // Shutdown handlers swallow uncaught throwables silently;
                    // log explicitly so a runtime issue still surfaces in
                    // PrestaShopLogger / the queue isn't left in limbo.
                    PrestaShopLogger::addLog(
                        '[FrakSDK] Webhook shutdown dispatch crashed: ' . $e->getMessage(),
                        3
                    );
                }
            });
            return;
        }

        // Fallback: SAPI exposes no flush primitive (CLI / mod_php / etc.).
        // Run inline so the dispatch still happens — same single attempt.
        $dispatch();
    }
}
