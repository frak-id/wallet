<?php

use kornrunner\Keccak;

class FrakWebhookHelper
{
    public static function getProductId()
    {
        $domain = Tools::getShopDomain(true, true);
        $domain = str_replace(['http://', 'https://', 'www.'], '', $domain);
        $hash = Keccak::hash($domain, 256);
        return '0x' . $hash;
    }

    public static function getWebhookUrl()
    {
        $productId = self::getProductId();
        return 'https://backend.frak.id/ext/products/' . $productId . '/webhook/oracle/custom';
    }

    public static function send($order_id, $status, $token)
    {
        $startTime = microtime(true);
        $webhookUrl = self::getWebhookUrl();
        
        PrestaShopLogger::addLog('FrakIntegration: Starting webhook send for order ' . $order_id . ' with status: ' . $status, 1);

        try {
            $order = new Order($order_id);
            if (!Validate::isLoadedObject($order)) {
                throw new Exception('Order not found: ' . $order_id);
            }

            $cart = new Cart($order->id_cart);
            if (!Validate::isLoadedObject($cart)) {
                throw new Exception('Cart not found for order: ' . $order_id);
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

            $webhookSecret = Configuration::get('FRAK_WEBHOOK_SECRET');
            if (empty($webhookSecret)) {
                throw new Exception('Webhook secret not configured');
            }

            $body = [
                'id' => $order_id,
                'customerId' => $customer->id,
                'status' => $status,
                'token' => $token . '_' . $order_id,
                'currency' => $currency->iso_code,
                'totalPrice' => $order->total_paid_tax_incl,
                'items' => $items,
            ];

            $jsonBody = json_encode($body);
            if ($jsonBody === false) {
                throw new Exception('Failed to encode webhook payload as JSON');
            }

            $signature = hash_hmac('sha256', $jsonBody, $webhookSecret);

            $ch = curl_init($webhookUrl);
            if ($ch === false) {
                throw new Exception('Failed to initialize cURL');
            }

            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
            curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonBody);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'x-hmac-sha256: ' . $signature,
            ]);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErrno = curl_errno($ch);
            $curlError = curl_error($ch);
            $totalTime = curl_getinfo($ch, CURLINFO_TOTAL_TIME);

            curl_close($ch);

            $executionTime = round((microtime(true) - $startTime) * 1000, 2);

            if ($curlErrno > 0) {
                throw new Exception('FrakIntegration: cURL error: ' . $curlError . ' (errno: ' . $curlErrno . ')');
            }

            // Log webhook attempt details
            self::logWebhookAttempt($order_id, $status, $httpCode, $response, $executionTime, null);

            if ($httpCode >= 200 && $httpCode < 300) {
                PrestaShopLogger::addLog('FrakIntegration: Webhook sent successfully. HTTP Code: ' . $httpCode . ', Response: ' . $response . ', Time: ' . $executionTime . 'ms', 1);
                return ['success' => true, 'http_code' => $httpCode, 'response' => $response];
            } else {
                throw new Exception('HTTP error: ' . $httpCode . ', Response: ' . $response);
            }

        } catch (Exception $e) {
            $executionTime = round((microtime(true) - $startTime) * 1000, 2);
            $errorMessage = 'Webhook failed for order ' . $order_id . ': ' . $e->getMessage();
            
            PrestaShopLogger::addLog('FrakIntegration: ' . $errorMessage . ', Time: ' . $executionTime . 'ms', 3);
            
            // Log failed webhook attempt
            self::logWebhookAttempt($order_id, $status, isset($httpCode) ? $httpCode : 0, isset($response) ? $response : '', $executionTime, $e->getMessage());
            
            return ['success' => false, 'error' => $e->getMessage(), 'execution_time' => $executionTime];
        }
    }

    /**
     * Log webhook attempt to database for debugging purposes
     */
    private static function logWebhookAttempt($orderId, $status, $httpCode, $response, $executionTime, $error = null)
    {
        $data = [
            'order_id' => (int)$orderId,
            'status' => pSQL($status),
            'http_code' => (int)$httpCode,
            'response' => pSQL(substr($response, 0, 1000)), // Limit response length
            'execution_time' => (float)$executionTime,
            'error' => $error ? pSQL(substr($error, 0, 500)) : null,
            'timestamp' => date('Y-m-d H:i:s'),
            'webhook_url' => pSQL(self::getWebhookUrl()),
            'success' => $error === null && $httpCode >= 200 && $httpCode < 300 ? 1 : 0
        ];

        // Store in configuration as JSON for simplicity (could be moved to a dedicated table later)
        $existingLogs = Configuration::get('FRAK_WEBHOOK_LOGS');
        $logs = $existingLogs ? json_decode($existingLogs, true) : [];
        
        if (!is_array($logs)) {
            $logs = [];
        }

        // Add new log
        array_unshift($logs, $data);
        
        // Keep only last 50 logs
        $logs = array_slice($logs, 0, 50);
        
        Configuration::updateValue('FRAK_WEBHOOK_LOGS', json_encode($logs));
    }

    /**
     * Get recent webhook logs for debugging
     */
    public static function getWebhookLogs($limit = 20)
    {
        $logs = Configuration::get('FRAK_WEBHOOK_LOGS');
        if (!$logs) {
            return [];
        }

        $decoded = json_decode($logs, true);
        if (!is_array($decoded)) {
            return [];
        }

        return array_slice($decoded, 0, $limit);
    }

    /**
     * Get webhook statistics
     */
    public static function getWebhookStats()
    {
        $logs = self::getWebhookLogs(50);
        
        if (empty($logs)) {
            return [
                'total_attempts' => 0,
                'successful' => 0,
                'failed' => 0,
                'success_rate' => 0,
                'avg_response_time' => 0,
                'last_attempt' => null
            ];
        }

        $totalAttempts = count($logs);
        $successful = count(array_filter($logs, function($log) { return $log['success']; }));
        $failed = $totalAttempts - $successful;
        $successRate = $totalAttempts > 0 ? round(($successful / $totalAttempts) * 100, 1) : 0;
        
        $totalTime = array_sum(array_column($logs, 'execution_time'));
        $avgResponseTime = $totalAttempts > 0 ? round($totalTime / $totalAttempts, 2) : 0;
        
        return [
            'total_attempts' => $totalAttempts,
            'successful' => $successful,
            'failed' => $failed,
            'success_rate' => $successRate,
            'avg_response_time' => $avgResponseTime,
            'last_attempt' => $logs[0]['timestamp'] ?? null
        ];
    }

    /**
     * Clear webhook logs
     */
    public static function clearWebhookLogs()
    {
        Configuration::updateValue('FRAK_WEBHOOK_LOGS', '');
        PrestaShopLogger::addLog('FrakIntegration: Webhook logs cleared', 1);
    }

    /**
     * Test webhook connectivity
     */
    public static function testWebhook()
    {
        $startTime = microtime(true);
        $webhookUrl = self::getWebhookUrl();
        
        PrestaShopLogger::addLog('FrakIntegration: Testing webhook connectivity to: ' . $webhookUrl, 1);

        try {
            $testPayload = [
                'test' => true,
                'timestamp' => time(),
                'domain' => Tools::getShopDomain(true, true)
            ];

            $jsonBody = json_encode($testPayload);
            $webhookSecret = Configuration::get('FRAK_WEBHOOK_SECRET');
            
            if (empty($webhookSecret)) {
                throw new Exception('Webhook secret not configured');
            }

            $signature = hash_hmac('sha256', $jsonBody, $webhookSecret);

            $ch = curl_init($webhookUrl);
            if ($ch === false) {
                throw new Exception('Failed to initialize cURL');
            }

            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
            curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonBody);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'x-hmac-sha256: ' . $signature,
            ]);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErrno = curl_errno($ch);
            $curlError = curl_error($ch);

            curl_close($ch);

            $executionTime = round((microtime(true) - $startTime) * 1000, 2);

            if ($curlErrno > 0) {
                throw new Exception('cURL error: ' . $curlError . ' (errno: ' . $curlErrno . ')');
            }

            $result = [
                'success' => $httpCode >= 200 && $httpCode < 300,
                'http_code' => $httpCode,
                'response' => $response,
                'execution_time' => $executionTime,
                'error' => null
            ];

            if (!$result['success']) {
                $result['error'] = 'HTTP error: ' . $httpCode;
            }

            PrestaShopLogger::addLog('FrakIntegration: Webhook test completed. Success: ' . ($result['success'] ? 'Yes' : 'No') . ', HTTP Code: ' . $httpCode . ', Time: ' . $executionTime . 'ms', 1);

            return $result;

        } catch (Exception $e) {
            $executionTime = round((microtime(true) - $startTime) * 1000, 2);
            PrestaShopLogger::addLog('FrakIntegration: Webhook test failed: ' . $e->getMessage() . ', Time: ' . $executionTime . 'ms', 3);
            
            return [
                'success' => false,
                'http_code' => 0,
                'response' => '',
                'execution_time' => $executionTime,
                'error' => $e->getMessage()
            ];
        }
    }
}
