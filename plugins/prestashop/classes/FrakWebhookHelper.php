<?php

/**
 * Order webhook sender.
 *
 * Resolves the Frak merchant for the current shop, signs the payload with
 * HMAC-SHA256 keyed on `FRAK_WEBHOOK_SECRET`, and POSTs to the merchant
 * endpoint that mirrors the WordPress contract:
 *   `POST /ext/merchant/{merchantId}/webhook/prestashop`
 *
 * Delivery logs are emitted via `PrestaShopLogger::addLog()` (the platform-
 * native log surface, visible under Advanced Parameters > Logs). The previous
 * Configuration-backed log ring + stats card are gone — they duplicated the
 * native logger and were the moral equivalent of the WordPress plugin's
 * removed PHP webhook dispatcher (delivery + logging now happen in WC's own
 * pipeline).
 */
class FrakWebhookHelper
{
    private const PLATFORM_SEGMENT = 'prestashop';
    private const REQUEST_TIMEOUT = 30;
    private const CONNECT_TIMEOUT = 10;

    public static function getWebhookUrl(): ?string
    {
        $merchant_id = FrakMerchantResolver::getId();
        if (!$merchant_id) {
            return null;
        }

        return 'https://backend.frak.id/ext/merchant/' . rawurlencode($merchant_id) . '/webhook/' . self::PLATFORM_SEGMENT;
    }

    public static function send($order_id, $status, $token)
    {
        $start_time = microtime(true);
        PrestaShopLogger::addLog('FrakIntegration: Starting webhook send for order ' . $order_id . ' with status: ' . $status, 1);

        try {
            $payload = self::buildOrderPayload($order_id, $status, $token);
            $result = self::dispatch($payload);

            PrestaShopLogger::addLog(
                'FrakIntegration: Webhook sent successfully. HTTP Code: ' . $result['http_code']
                . ', Response: ' . $result['response']
                . ', Time: ' . $result['execution_time'] . 'ms',
                1
            );

            return ['success' => true, 'http_code' => $result['http_code'], 'response' => $result['response']];
        } catch (Exception $e) {
            $execution_time = round((microtime(true) - $start_time) * 1000, 2);
            PrestaShopLogger::addLog('FrakIntegration: Webhook failed for order ' . $order_id . ': ' . $e->getMessage() . ', Time: ' . $execution_time . 'ms', 3);

            return ['success' => false, 'error' => $e->getMessage(), 'execution_time' => $execution_time];
        }
    }

    /**
     * Build the order payload sent to the merchant webhook endpoint.
     * @return array{id:int,customerId:int,status:string,token:string,currency:string,totalPrice:float,items:array<int,array{productId:int,quantity:int,price:float,name:string,title:string}>}
     */
    private static function buildOrderPayload($order_id, string $status, string $token): array
    {
        $order = new Order($order_id);
        if (!Validate::isLoadedObject($order)) {
            throw new Exception('Order not found: ' . $order_id);
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
     * @return array{http_code:int,response:string,execution_time:float}
     */
    private static function dispatch(array $payload): array
    {
        $url = self::getWebhookUrl();
        if ($url === null) {
            throw new Exception('Merchant not resolved: register the shop domain in the Frak dashboard');
        }

        $secret = Configuration::get('FRAK_WEBHOOK_SECRET');
        if (empty($secret)) {
            throw new Exception('Webhook secret not configured');
        }

        $body = json_encode($payload);
        if ($body === false) {
            throw new Exception('Failed to encode webhook payload as JSON');
        }

        $signature = hash_hmac('sha256', $body, $secret);

        $start_time = microtime(true);
        $ch = curl_init($url);
        if ($ch === false) {
            throw new Exception('Failed to initialize cURL');
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
            throw new Exception('HTTP error: ' . $http_code . ', Response: ' . $response);
        }

        return [
            'http_code' => $http_code,
            'response' => is_string($response) ? $response : '',
            'execution_time' => $execution_time,
        ];
    }
}
