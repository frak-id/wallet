<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Model;

use GuzzleHttp\ClientFactory;
use Magento\Sales\Api\Data\OrderInterface;
use Psr\Log\LoggerInterface;

class WebhookSender
{
    public function __construct(
        private readonly Config $config,
        private readonly ClientFactory $clientFactory,
        private readonly LoggerInterface $logger
    ) {}

    public function sendOrderWebhook(OrderInterface $order, string $status, ?string $clientId): void
    {
        $merchantId = $this->config->getMerchantId($order->getStoreId());
        $webhookSecret = $this->config->getWebhookSecret($order->getStoreId());
        $backendUrl = $this->config->getBackendUrl($order->getStoreId());

        if (!$merchantId || !$webhookSecret) {
            $this->logger->warning("[FrakSDK] Missing merchantId or webhook secret");
            return;
        }

        $payload = $this->buildPayload($order, $status, $clientId);
        $body = json_encode($payload, JSON_THROW_ON_ERROR);

        $signature = base64_encode(hash_hmac("sha256", $body, $webhookSecret, true));

        $url = rtrim($backendUrl, "/") . "/ext/merchant/" . $merchantId . "/webhook/magento";

        $client = $this->clientFactory->create([
            "config" => [
                "timeout" => 5,
                "connect_timeout" => 3,
            ],
        ]);

        $response = $client->request("POST", $url, [
            "headers" => [
                "Content-Type" => "application/json",
                "x-hmac-sha256" => $signature,
            ],
            "body" => $body,
        ]);

        $responseBody = (string) $response->getBody();
        if (str_starts_with($responseBody, "ko:")) {
            $this->logger->warning(
                "[FrakSDK] Webhook rejected by backend: " . $responseBody,
                ["order" => $order->getIncrementId()]
            );
        }
    }

    private function buildPayload(OrderInterface $order, string $status, ?string $clientId): array
    {
        $items = [];
        foreach ($order->getAllVisibleItems() as $item) {
            $items[] = [
                "productId" => (string) $item->getProductId(),
                "quantity" => (int) $item->getQtyOrdered(),
                "price" => (string) $item->getPrice(),
                "name" => (string) $item->getSku(),
                "title" => (string) $item->getName(),
            ];
        }

        return [
            "id" => (string) $order->getIncrementId(),
            "customerId" => (string) ($order->getCustomerId() ?? $order->getCustomerEmail()),
            "status" => $this->mapOrderStatus($status),
            "token" => (string) ($order->getProtectCode() ?? $order->getQuoteId()),
            "currency" => $order->getOrderCurrencyCode(),
            "totalPrice" => (string) $order->getGrandTotal(),
            "items" => $items,
            "clientId" => $clientId,
        ];
    }

    private function mapOrderStatus(string $status): string
    {
        return match ($status) {
            "confirmed" => "confirmed",
            "refunded" => "refunded",
            default => "pending",
        };
    }
}
