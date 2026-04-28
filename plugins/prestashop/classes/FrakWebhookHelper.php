<?php

/**
 * Order webhook sender.
 *
 * Resolves the Frak merchant for the current shop, signs the payload with
 * HMAC-SHA256 keyed on `FRAK_WEBHOOK_SECRET`, and POSTs to the merchant
 * webhook endpoint that mirrors the Magento / WooCommerce contract:
 *   `POST /ext/merchant/{merchantId}/webhook/custom`
 *
 * The signature is the **base64 encoding of the raw HMAC-SHA256 digest**
 * (`base64_encode(hash_hmac('sha256', $body, $secret, true))`) — matching
 * `validateBodyHmac` in `services/backend/src/utils/bodyHmac.ts`, which
 * decodes the `x-hmac-sha256` header via `Buffer.from(sig, 'base64')`.
 * Sending the default hex digest produces signatures that are 88 bytes
 * after base64-decoding (vs the expected 32-byte raw digest) and fail
 * verification — see commit history for the original hex regression.
 *
 * Two delivery paths:
 *   - {@see send()} — single-shot, used by `hookActionOrderStatusPostUpdate`
 *     and the unit tests. Takes an optional pre-loaded `Order` so the hook
 *     handler doesn't have to round-trip the DB twice.
 *   - {@see sendBatch()} — parallel via `curl_multi_*`, used by the cron
 *     drainer. 25 sequential 2 s requests collapse to one ~2 s
 *     `curl_multi_select` window, which is the difference between an
 *     overlapping cron run and a single tick that fits inside the 5-min
 *     window.
 *
 * Per-request memo: secret + webhook URL are looked up at most once via
 * `self::$secretCache` / `self::$urlCache`. The cron drainer's
 * 25-rows-per-tick loop now hits `Configuration::get('FRAK_WEBHOOK_SECRET')`
 * exactly once instead of once per row.
 *
 * Delivery logs go through {@see FrakLogger} — the buffered file logger —
 * so the previous severity-1 spam on the order-status hook ("Triggered" /
 * "Started" / "Sent successfully") collapses into a single error-only
 * surface that still shows up in `Advanced Parameters → Logs` for failures.
 */
class FrakWebhookHelper
{
    private const PLATFORM_SEGMENT = 'custom';
    /** Tight per-request timeout: the hook caller absorbs this latency on the merchant checkout path. */
    private const REQUEST_TIMEOUT = 5;
    /** Connect timeout kept tighter than the request timeout to fail fast on dead backends. */
    private const CONNECT_TIMEOUT = 3;

    /**
     * Per-request memo for `Configuration::get('FRAK_WEBHOOK_SECRET')`.
     * `null` means "not yet looked up"; empty string means "looked up,
     * not configured". Reset by {@see resetCache()} for tests.
     */
    private static ?string $secretCache = null;

    /**
     * Per-request memo for {@see getWebhookUrl()}. Same null-vs-string
     * sentinel pattern as `$secretCache`.
     */
    private static ?string $urlCache = null;

    /**
     * Resolved webhook URL for the current shop, or null when the merchant
     * is unresolved. Memoised because `FrakMerchantResolver::getId()`
     * itself caches via `FrakCache`, but the URL string concat is cheap to
     * skip on the cron drainer's 25-row hot loop.
     */
    public static function getWebhookUrl(): ?string
    {
        if (self::$urlCache !== null) {
            return self::$urlCache === '' ? null : self::$urlCache;
        }
        $merchant_id = FrakMerchantResolver::getId();
        if (!$merchant_id) {
            self::$urlCache = '';
            return null;
        }
        $url = 'https://backend.frak.id/ext/merchant/' . rawurlencode($merchant_id)
            . '/webhook/' . self::PLATFORM_SEGMENT;
        self::$urlCache = $url;
        return $url;
    }

    /**
     * Compute the `x-hmac-sha256` header value for a JSON body.
     *
     * Public + static so the unit suite can pin the format without needing the
     * full PrestaShop bootstrap. The backend (`validateBodyHmac` in
     * `services/backend/src/utils/bodyHmac.ts`) decodes the header via
     * `Buffer.from(sig, 'base64')` and compares against `CryptoHasher` output, so
     * we MUST emit `base64_encode(hash_hmac('sha256', \$body, \$secret, true))`.
     * The default `hash_hmac()` return value is hex — sending it produces a
     * 64-byte buffer after base64-decode and fails verification.
     */
    public static function signBody(string $body, string $secret): string
    {
        return base64_encode(hash_hmac('sha256', $body, $secret, true));
    }

    /**
     * Single-shot send. `$order_id` + `$status` + `$token` are the canonical
     * inputs (the cron drainer only has those, since the queue row carries
     * ids and a token rather than a serialised Order). Callers that already
     * have the `Order` object loaded — typically the order-status hook —
     * may pass it as the optional fourth argument to skip the duplicate
     * `new Order($id)` round-trip on the merchant's checkout path.
     *
     * @param int|string $order_id
     * @param string     $status
     * @param string     $token
     * @param Order|null $order Optional pre-loaded order to avoid re-fetching.
     * @return array{success:bool,http_code?:int,response?:string,error?:string,execution_time?:float}
     */
    public static function send($order_id, $status, $token, $order = null)
    {
        $start_time = microtime(true);

        try {
            $payload = self::buildOrderPayload((int) $order_id, (string) $status, (string) $token, $order);
            $result = self::dispatch($payload);

            return [
                'success' => true,
                'http_code' => $result['http_code'],
                'response' => $result['response'],
            ];
        } catch (Exception $e) {
            $execution_time = round((microtime(true) - $start_time) * 1000, 2);
            FrakLogger::error(
                'Webhook failed for order ' . (int) $order_id . ': ' . $e->getMessage()
                . ' (took ' . $execution_time . 'ms)'
            );
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'execution_time' => $execution_time,
            ];
        }
    }

    /**
     * Send N webhooks in parallel via `curl_multi_*`. Used by
     * {@see FrakWebhookCron::run()} to drain the retry queue without
     * paying N × connect+TLS+request latency sequentially.
     *
     * Result map is keyed by the caller-supplied `id` (the queue row id).
     * Each entry has the same shape as {@see send()}'s return value.
     *
     * @param array<int, array{id:int,order_id:int,status:string,token:string}> $entries
     * @return array<int, array{success:bool,http_code?:int,response?:string,error?:string}>
     */
    public static function sendBatch(array $entries): array
    {
        if (empty($entries)) {
            return [];
        }

        // Resolve URL + secret once for the whole batch — the per-request
        // memos already collapse repeated lookups but this is the canonical
        // batch-fast-path comment.
        $url = self::getWebhookUrl();
        $secret = self::getCachedSecret();

        $results = [];

        if ($url === null) {
            $error = 'Merchant not resolved: register the shop domain in the Frak dashboard';
            foreach ($entries as $entry) {
                $results[$entry['id']] = ['success' => false, 'error' => $error];
            }
            return $results;
        }

        if ($secret === '') {
            $error = 'Webhook secret not configured';
            foreach ($entries as $entry) {
                $results[$entry['id']] = ['success' => false, 'error' => $error];
            }
            return $results;
        }

        // Build the curl handles up front so we can register them all with
        // curl_multi before the first select() call.
        $multi = curl_multi_init();
        $handles = [];
        $build_errors = [];

        foreach ($entries as $entry) {
            $row_id = (int) $entry['id'];
            try {
                $payload = self::buildOrderPayload(
                    (int) $entry['order_id'],
                    (string) $entry['status'],
                    (string) $entry['token']
                );
                $body = json_encode($payload);
                if ($body === false) {
                    throw new Exception('Failed to encode webhook payload as JSON');
                }
                $signature = self::signBody($body, $secret);
                $ch = self::buildCurlHandle($url, $body, $signature);
                if ($ch === false) {
                    throw new Exception('Failed to initialize cURL');
                }
                curl_multi_add_handle($multi, $ch);
                $handles[$row_id] = $ch;
            } catch (Exception $e) {
                $build_errors[$row_id] = $e->getMessage();
            }
        }

        // Drive the multi-handle loop. `curl_multi_select` blocks until at
        // least one transfer needs attention or the timeout fires; the
        // do/while keeps spinning until every handle resolves. Capped at
        // REQUEST_TIMEOUT seconds via individual handle timeouts so a stuck
        // backend can't wedge the cron tick.
        $running = null;
        do {
            $status = curl_multi_exec($multi, $running);
            if ($running > 0) {
                curl_multi_select($multi, 1.0);
            }
        } while ($running > 0 && $status === CURLM_OK);

        // Collect per-handle results.
        foreach ($entries as $entry) {
            $row_id = (int) $entry['id'];

            if (isset($build_errors[$row_id])) {
                $results[$row_id] = ['success' => false, 'error' => $build_errors[$row_id]];
                continue;
            }

            $ch = $handles[$row_id] ?? null;
            if ($ch === null) {
                $results[$row_id] = ['success' => false, 'error' => 'cURL handle missing'];
                continue;
            }

            $response = curl_multi_getcontent($ch);
            $http_code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curl_errno = curl_errno($ch);
            $curl_error = curl_error($ch);

            curl_multi_remove_handle($multi, $ch);
            curl_close($ch);

            if ($curl_errno > 0) {
                $results[$row_id] = [
                    'success' => false,
                    'error' => 'cURL error: ' . $curl_error . ' (errno: ' . $curl_errno . ')',
                ];
                continue;
            }

            if ($http_code < 200 || $http_code >= 300) {
                $results[$row_id] = [
                    'success' => false,
                    'http_code' => $http_code,
                    'error' => 'HTTP ' . $http_code . ': ' . (is_string($response) ? $response : ''),
                ];
                continue;
            }

            $results[$row_id] = [
                'success' => true,
                'http_code' => $http_code,
                'response' => is_string($response) ? $response : '',
            ];
        }

        curl_multi_close($multi);
        return $results;
    }

    /**
     * Read and memoise the configured webhook secret. Public + static so
     * unit tests can assert the cache invalidation contract.
     */
    public static function getCachedSecret(): string
    {
        if (self::$secretCache === null) {
            $secret = (string) Configuration::get('FRAK_WEBHOOK_SECRET');
            self::$secretCache = $secret;
        }
        return self::$secretCache;
    }

    /**
     * Reset per-request memos. Test-only — production callers should never
     * need this since the memos live for one request anyway. Exposed for
     * tests that mutate `Configuration::FRAK_WEBHOOK_SECRET` mid-run.
     */
    public static function resetCache(): void
    {
        self::$secretCache = null;
        self::$urlCache = null;
    }

    /**
     * Build the order payload sent to the merchant webhook endpoint.
     *
     * `$preloaded` lets the caller hand in an already-loaded `Order` to
     * skip the `new Order($id)` round-trip — used by the order-status hook
     * which already has the object in scope. The cron drainer doesn't
     * have it (only the row id is persisted) and falls through to the
     * default load.
     *
     * @return array{id:int,customerId:int,status:string,token:string,currency:string,totalPrice:float,items:array<int,array{productId:int,quantity:int,price:float,name:string,title:string}>}
     */
    private static function buildOrderPayload(int $order_id, string $status, string $token, $preloaded = null): array
    {
        if ($preloaded !== null && Validate::isLoadedObject($preloaded)) {
            $order = $preloaded;
        } else {
            $order = new Order($order_id);
            if (!Validate::isLoadedObject($order)) {
                throw new Exception('Order not found: ' . $order_id);
            }
        }

        $customer = new Customer($order->id_customer);
        if (!Validate::isLoadedObject($customer)) {
            throw new Exception('Customer not found for order: ' . $order_id);
        }

        $currency = new Currency($order->id_currency);
        if (!Validate::isLoadedObject($currency)) {
            throw new Exception('Currency not found for order: ' . $order_id);
        }

        $products = $order->getProducts();
        if (empty($products)) {
            throw new Exception('No products found for order: ' . $order_id);
        }

        $items = [];
        foreach ($products as $product) {
            $items[] = [
                'productId' => $product['product_id'],
                'quantity' => $product['product_quantity'],
                'price' => $product['unit_price_tax_incl'],
                'name' => $product['product_name'],
                'title' => $product['product_name'],
            ];
        }

        return [
            'id' => $order_id,
            'customerId' => $customer->id,
            'status' => $status,
            'token' => $token . '_' . $order_id,
            'currency' => $currency->iso_code,
            'totalPrice' => $order->total_paid_tax_incl,
            'items' => $items,
        ];
    }

    /**
     * POST a JSON payload to the merchant webhook endpoint with HMAC signing.
     * Sync path — used by {@see send()}. The batch path uses
     * {@see buildCurlHandle()} directly.
     *
     * @return array{http_code:int,response:string,execution_time:float}
     */
    private static function dispatch(array $payload): array
    {
        $url = self::getWebhookUrl();
        if ($url === null) {
            throw new Exception('Merchant not resolved: register the shop domain in the Frak dashboard');
        }

        $secret = self::getCachedSecret();
        if ($secret === '') {
            throw new Exception('Webhook secret not configured');
        }

        $body = json_encode($payload);
        if ($body === false) {
            throw new Exception('Failed to encode webhook payload as JSON');
        }
        $signature = self::signBody($body, $secret);

        $start_time = microtime(true);
        $ch = self::buildCurlHandle($url, $body, $signature);
        if ($ch === false) {
            throw new Exception('Failed to initialize cURL');
        }

        $response = curl_exec($ch);
        $http_code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curl_errno = curl_errno($ch);
        $curl_error = curl_error($ch);
        curl_close($ch);

        $execution_time = round((microtime(true) - $start_time) * 1000, 2);

        if ($curl_errno > 0) {
            throw new Exception('cURL error: ' . $curl_error . ' (errno: ' . $curl_errno . ')');
        }

        if ($http_code < 200 || $http_code >= 300) {
            throw new Exception('HTTP error: ' . $http_code . ', Response: ' . (is_string($response) ? $response : ''));
        }

        return [
            'http_code' => $http_code,
            'response' => is_string($response) ? $response : '',
            'execution_time' => $execution_time,
        ];
    }

    /**
     * Build (but do not execute) a curl handle pre-configured for the Frak
     * merchant webhook contract: POST + JSON body + signed
     * `x-hmac-sha256` header + tight timeouts.
     *
     * Shared by both the sync ({@see dispatch()}) and parallel
     * ({@see sendBatch()}) paths so the request shape stays in lock-step.
     *
     * @return \CurlHandle|resource|false
     */
    private static function buildCurlHandle(string $url, string $body, string $signature)
    {
        $ch = curl_init($url);
        if ($ch === false) {
            return false;
        }
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'x-hmac-sha256: ' . $signature,
        ]);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, self::CONNECT_TIMEOUT);
        curl_setopt($ch, CURLOPT_TIMEOUT, self::REQUEST_TIMEOUT);
        return $ch;
    }
}
