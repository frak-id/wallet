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
 * on {@see FrakHttpClient} so the resolver and the helper share
 * one connection pool — TLS state warmed by an earlier resolver call
 * carries over to the immediately-following webhook send.
 *
 * Failure handling: this helper returns a result array on failure rather
 * than logging. The caller owns the failure response — `FrakOrderWebhook`
 * persists the row to the retry queue, the cron drainer escalates only
 * when a row is parked. Single source of truth for the merchant log
 * surface.
 */
class FrakWebhookHelper
{
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

    // HttpClient lives on FrakHttpClient::getInstance() — see class docblock for
    // the rationale (shared with FrakMerchantResolver for TLS reuse).

    /**
     * Resolved webhook URL for the current shop, or null when the merchant
     * is unresolved. Memoised because `FrakMerchantResolver::getId()`
     * itself caches via {@see FrakCache}, but the URL string concat
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
        $url = FrakUrls::WEBHOOK_MERCHANT_PREFIX . rawurlencode($merchant_id) . FrakUrls::WEBHOOK_PATH_SUFFIX;
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
     * Single-shot webhook send. The order-status hook calls this with the
     * already-loaded `Order` so we skip the duplicate `new Order($id)`
     * round-trip on the merchant's checkout path; the cron drainer's path
     * (`sendBatch()`) loads the order itself per row.
     *
     * Payload building is delegated to {@see FrakOrderResolver::getWebhookPayload()}
     * so PrestaShop entity knowledge (Order / Customer / Currency / line items)
     * lives in one resolver instead of being split between the resolver and the
     * webhook helper. The opaque token is derived from the loaded `Order`
     * inside the resolver — the helper no longer needs it as a parameter.
     *
     * @param int|string $order_id
     * @param string     $status
     * @param Order|null $order Optional pre-loaded order to avoid re-fetching.
     * @return array{success:bool,http_code?:int,response?:string,error?:string,execution_time?:float}
     */
    public static function send($order_id, $status, $order = null)
    {
        $start_time = microtime(true);

        try {
            if ($order === null || !Validate::isLoadedObject($order)) {
                $order = new Order((int) $order_id);
                if (!Validate::isLoadedObject($order)) {
                    throw new Exception('Order not found: ' . (int) $order_id);
                }
            }
            $payload = FrakOrderResolver::getWebhookPayload($order, (string) $status);
            $result = self::dispatch($payload);

            return [
                'success' => true,
                'http_code' => $result['http_code'],
                'response' => $result['response'],
            ];
        } catch (Exception $e) {
            $execution_time = round((microtime(true) - $start_time) * 1000, 2);
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
     * @param array<int, array{id:int,order_id:int,status:string}> $entries
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
        $client = FrakHttpClient::getInstance();
        $responses = [];
        $response_to_id = [];
        $build_errors = [];

        foreach ($entries as $entry) {
            $row_id = (int) $entry['id'];
            try {
                $order = new Order((int) $entry['order_id']);
                if (!Validate::isLoadedObject($order)) {
                    throw new Exception('Order not found: ' . (int) $entry['order_id']);
                }
                $payload = FrakOrderResolver::getWebhookPayload($order, (string) $entry['status']);
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
            $secret = FrakConfig::getWebhookSecret();
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
            $response = FrakHttpClient::getInstance()->request('POST', $url, [
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
