<?php

/**
 * Server-side order webhook trigger.
 *
 * Owns the `actionOrderStatusPostUpdate` hook body: maps PrestaShop order
 * states to Frak webhook statuses, defers dispatch to PHP shutdown so the
 * merchant's request returns BEFORE the outbound HTTP call fires, and
 * falls back to the retry queue on failure.
 *
 * Mirrors WordPress's `Frak_WC_Webhook_Registrar` and Magento's
 * `Observer/OrderStatusUpdateObserver` — same `(merchantId, externalId,
 * status)` idempotency contract on the backend so all three plugins
 * de-duplicate cleanly.
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
     * the merchant's request returns BEFORE the outbound HTTP call fires.
     * Any failure (network, non-2xx, exception) lands in the retry queue.
     *
     * Hot-path order matters here:
     *   1. Cheap guards first (params shape, status object).
     *   2. Skip-list check via batched `Configuration::getMultiple()` —
     *      single autoload-cache hit instead of 7 separate lookups for the
     *      `PS_OS_*` ids. Most state transitions on a busy shop go through
     *      `preparation → shipping`, both of which are skipped, so this
     *      path returns before paying for an `Order` instantiation.
     *   3. Order load (only on transitions we actually deliver).
     *   4. `register_shutdown_function` schedules the dispatch + queue
     *      fallback to run AFTER the response is sent. Inside the
     *      shutdown handler, `fastcgi_finish_request()` (or the LiteSpeed
     *      equivalent) explicitly closes the FastCGI connection so the
     *      merchant's browser doesn't wait on the 5 s HTTP timeout. Falls
     *      back to a synchronous attempt on SAPIs that expose neither
     *      function (e.g. CLI imports) — same single attempt, just inline.
     *
     * Why shutdown rather than mid-hook flush:
     *   `actionOrderStatusPostUpdate` runs MID-controller, so calling
     *   `fastcgi_finish_request()` directly here would push a half-built
     *   response (no template, no headers) to the merchant. Deferring to
     *   shutdown lets PrestaShop finish rendering naturally; we only
     *   close the connection once the controller has emitted the full
     *   response, then run the webhook attempt against the closed
     *   connection.
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
            FrakLogger::warning('order ' . $order_id . ' not loadable in postUpdate hook');
            return;
        }

        $status_map = [
            ($os_ids['PS_OS_WS_PAYMENT'] ?? 0) => 'confirmed',
            ($os_ids['PS_OS_PAYMENT'] ?? 0) => 'confirmed',
            ($os_ids['PS_OS_DELIVERED'] ?? 0) => 'confirmed',
            ($os_ids['PS_OS_CANCELED'] ?? 0) => 'cancelled',
            ($os_ids['PS_OS_REFUND'] ?? 0) => 'refunded',
        ];

        $webhook_status = $status_map[(int) $new_status->id] ?? 'pending';

        // Defer the dispatch + queue fallback to PHP shutdown so the
        // merchant's status-update controller renders + flushes its full
        // response BEFORE we open the outbound HTTP socket. Inside the
        // shutdown handler we explicitly close the FastCGI connection so
        // the browser doesn't sit on the connection for the 5 s request
        // timeout (PHP-FPM auto-flushes on shutdown, but the explicit
        // call covers reverse-proxies / FPM versions where the auto-flush
        // is delayed). On SAPIs without `fastcgi_finish_request` (CLI
        // imports, mod_php, etc.) we fall back to a plain synchronous
        // dispatch — same single attempt, just no early connection close.
        $dispatch = static function () use ($order_id, $webhook_status, $order): void {
            $result = FrakWebhookHelper::send($order_id, $webhook_status, $order);
            if (is_array($result) && !empty($result['success'])) {
                return;
            }
            $error = is_array($result) && isset($result['error'])
                ? (string) $result['error']
                : 'Unknown webhook error';
            FrakLogger::error(
                'Webhook failed for order ' . $order_id . ', enqueuing for retry: ' . $error
            );
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
                    FrakLogger::error('Webhook shutdown dispatch crashed: ' . $e->getMessage());
                    FrakLogger::flush();
                }
            });
            return;
        }

        // Fallback: SAPI exposes no flush primitive (CLI / mod_php / etc.).
        // Run inline so the dispatch still happens — same single attempt.
        $dispatch();
    }
}
