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
 *   - {@see sendBatch()} — parallel via Symfony HttpClient's `stream()`,
 *     used by the cron drainer. 25 sequential 2 s requests collapse to a
 *     single `stream()` window which fans out via the underlying transport
 *     (HTTP/2 multiplexing where supported, curl_multi otherwise).
 *
 * Per-request memo: secret + webhook URL are looked up at most once via
 * `self::$secretCache` / `self::$urlCache`. The HttpClient itself lives
 * on {@see FrakDb::httpClient()} so the resolver and the helper share
 * one connection pool — TLS state warmed by an earlier resolver call
 * carries over to the immediately-following webhook send.
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

    // HttpClient lives on FrakDb::httpClient() — see class docblock for
    // the rationale (shared with FrakMerchantResolver for TLS reuse).

    /**
     * Resolved webhook URL for the current shop, or null when the merchant
     * is unresolved. Memoised because `FrakMerchantResolver::getId()`
     * itself caches via the Symfony Cache pool, but the URL string concat
     * is cheap to skip on the cron drainer's 25-row hot loop.
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
     * Send N webhooks in parallel via Symfony HttpClient's `stream()`. Used
     * by {@see FrakWebhookCron::run()} to drain the retry queue without
     * paying N × connect+TLS+request latency sequentially.
     *
     * `request()` is non-blocking when called for asynchronous use — the
     * actual transfer kicks off when `stream()` iterates the response
     * collection. The underlying curl_multi (or PHP streams fallback)
     * runs every transfer concurrently, with HTTP/2 multiplexing on
     * compatible backends collapsing them onto a single TLS connection.
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

        // Kick off every request as a non-blocking ResponseInterface. We
        // map (response → row id) so the stream() loop below can route
        // each completion back to the queue row that originated it.
        $client = FrakDb::httpClient(self::REQUEST_TIMEOUT);
        $responses = [];
        $response_to_id = [];
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
                $response = $client->request('POST', $url, [
                    'headers' => [
                        'Content-Type' => 'application/json',
                        'x-hmac-sha256' => $signature,
                    ],
                    'body' => $body,
                ]);
                $responses[] = $response;
                $response_to_id[spl_object_id($response)] = $row_id;
            } catch (Exception $e) {
                $build_errors[$row_id] = $e->getMessage();
            }
        }

        // Surface build-time failures verbatim — they never made it to
        // the wire, so the queue row should be retried with the original
        // error string preserved.
        foreach ($build_errors as $row_id => $error) {
            $results[$row_id] = ['success' => false, 'error' => $error];
        }

        // `stream()` iterates response chunks concurrently; we only care
        // about the `isLast()` chunk (final / failed) per response, since
        // the request bodies we send are small and the backend's response
        // bodies fit in a single chunk in practice. Errors during transfer
        // raise `TransportExceptionInterface` which we catch per-response.
        foreach ($client->stream($responses) as $response => $chunk) {
            try {
                if (!$chunk->isLast()) {
                    continue;
                }
                $row_id = $response_to_id[spl_object_id($response)] ?? null;
                if ($row_id === null) {
                    continue;
                }
                $http_code = $response->getStatusCode();
                $content = $response->getContent(false);
                if ($http_code < 200 || $http_code >= 300) {
                    $results[$row_id] = [
                        'success' => false,
                        'http_code' => $http_code,
                        'error' => 'HTTP ' . $http_code . ': ' . $content,
                    ];
                    continue;
                }
                $results[$row_id] = [
                    'success' => true,
                    'http_code' => $http_code,
                    'response' => $content,
                ];
            } catch (\Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface $e) {
                $row_id = $response_to_id[spl_object_id($response)] ?? null;
                if ($row_id !== null) {
                    $results[$row_id] = [
                        'success' => false,
                        'error' => 'Transport error: ' . $e->getMessage(),
                    ];
                }
            }
        }

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
     * {@see client()} + `stream()` directly so it can dispatch every
     * request concurrently.
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

        try {
            $response = FrakDb::httpClient(self::REQUEST_TIMEOUT)->request('POST', $url, [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'x-hmac-sha256' => $signature,
                ],
                'body' => $body,
            ]);
            $http_code = $response->getStatusCode();
            $content = $response->getContent(false);
        } catch (\Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface $e) {
            // Wrap transport-level errors (DNS, connect, TLS, timeout)
            // into the generic Exception the legacy contract uses so the
            // surrounding `try/catch` in `send()` continues to work.
            throw new Exception('Transport error: ' . $e->getMessage(), 0, $e);
        }

        $execution_time = round((microtime(true) - $start_time) * 1000, 2);

        if ($http_code < 200 || $http_code >= 300) {
            throw new Exception('HTTP error: ' . $http_code . ', Response: ' . $content);
        }

        return [
            'http_code' => $http_code,
            'response' => $content,
            'execution_time' => $execution_time,
        ];
    }
}
