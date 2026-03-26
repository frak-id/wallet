<?php

declare(strict_types=1);

namespace FrakLabs\Sdk\Test\Unit\Model;

use FrakLabs\Sdk\Model\Config;
use FrakLabs\Sdk\Model\WebhookSender;
use GuzzleHttp\Client;
use GuzzleHttp\ClientFactory;
use GuzzleHttp\Psr7\Response;
use Magento\Sales\Api\Data\OrderInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class WebhookSenderTest extends TestCase
{
    private Config&MockObject $config;
    private ClientFactory&MockObject $clientFactory;
    private LoggerInterface&MockObject $logger;
    private Client&MockObject $client;
    private WebhookSender $webhookSender;

    protected function setUp(): void
    {
        $this->config = $this->createMock(Config::class);
        $this->clientFactory = $this->createMock(ClientFactory::class);
        $this->logger = $this->createMock(LoggerInterface::class);
        $this->client = $this->createMock(Client::class);

        $this->webhookSender = new WebhookSender($this->config, $this->clientFactory, $this->logger);
    }

    public function testSendOrderWebhookBuildsCorrectPayload(): void
    {
        $order = $this->createOrderMock();

        $this->mockConfigDefaults(1, "merchant-1", "secret-key", "https://backend.frak.id");
        $this->clientFactory
            ->expects(self::once())
            ->method("create")
            ->willReturn($this->client);

        $this->client
            ->expects(self::once())
            ->method("request")
            ->with(
                "POST",
                "https://backend.frak.id/ext/merchant/merchant-1/webhook/magento",
                self::callback(function (array $options): bool {
                    $payload = json_decode((string) $options["body"], true, 512, JSON_THROW_ON_ERROR);

                    return $payload === [
                        "id" => "100000123",
                        "customerId" => "cust-42",
                        "status" => "pending",
                        "token" => "protect-token",
                        "currency" => "EUR",
                        "totalPrice" => "149.99",
                        "items" => [[
                            "productId" => "777",
                            "quantity" => 2,
                            "price" => "74.995",
                            "name" => "sku-777",
                            "title" => "Test Product",
                        ]],
                        "clientId" => "client-abc",
                    ];
                })
            )
            ->willReturn(new Response(200, [], "ok"));

        $this->webhookSender->sendOrderWebhook($order, "unknown", "client-abc");
    }

    public function testHmacSignatureIsBase64Encoded(): void
    {
        $order = $this->createOrderMock();

        $this->mockConfigDefaults(1, "merchant-1", "very-secret-key", "https://backend.frak.id");
        $this->clientFactory->method("create")->willReturn($this->client);

        $this->client
            ->expects(self::once())
            ->method("request")
            ->with(
                "POST",
                "https://backend.frak.id/ext/merchant/merchant-1/webhook/magento",
                self::callback(function (array $options): bool {
                    $body = (string) $options["body"];
                    $expected = base64_encode(hash_hmac("sha256", $body, "very-secret-key", true));

                    return ($options["headers"]["x-hmac-sha256"] ?? null) === $expected;
                })
            )
            ->willReturn(new Response(200, [], "ok"));

        $this->webhookSender->sendOrderWebhook($order, "confirmed", "client-abc");
    }

    public function testSkipsWhenMerchantIdMissing(): void
    {
        $order = $this->createOrderMock();

        $this->config->method("getMerchantId")->with(1)->willReturn(null);
        $this->config->method("getWebhookSecret")->with(1)->willReturn("secret-key");
        $this->config->method("getBackendUrl")->with(1)->willReturn("https://backend.frak.id");

        $this->logger->expects(self::once())->method("warning");
        $this->clientFactory->expects(self::never())->method("create");

        $this->webhookSender->sendOrderWebhook($order, "pending", "client-abc");
    }

    public function testSkipsWhenWebhookSecretMissing(): void
    {
        $order = $this->createOrderMock();

        $this->config->method("getMerchantId")->with(1)->willReturn("merchant-1");
        $this->config->method("getWebhookSecret")->with(1)->willReturn(null);
        $this->config->method("getBackendUrl")->with(1)->willReturn("https://backend.frak.id");

        $this->logger->expects(self::once())->method("warning");
        $this->clientFactory->expects(self::never())->method("create");

        $this->webhookSender->sendOrderWebhook($order, "pending", "client-abc");
    }

    public function testLogsWarningOnBackendRejection(): void
    {
        $order = $this->createOrderMock();

        $this->mockConfigDefaults(1, "merchant-1", "secret-key", "https://backend.frak.id");
        $this->clientFactory->method("create")->willReturn($this->client);
        $this->client->method("request")->willReturn(new Response(200, [], "ko: invalid signature"));

        $this->logger
            ->expects(self::once())
            ->method("warning")
            ->with(
                self::stringContains("Webhook rejected by backend: ko: invalid signature"),
                ["order" => "100000123"]
            );

        $this->webhookSender->sendOrderWebhook($order, "pending", "client-abc");
    }

    public function testStatusMapping(): void
    {
        $mapOrderStatus = new \ReflectionMethod(WebhookSender::class, "mapOrderStatus");
        $mapOrderStatus->setAccessible(true);

        self::assertSame("confirmed", $mapOrderStatus->invoke($this->webhookSender, "confirmed"));
        self::assertSame("refunded", $mapOrderStatus->invoke($this->webhookSender, "refunded"));
        self::assertSame("pending", $mapOrderStatus->invoke($this->webhookSender, "anything-else"));
    }

    private function mockConfigDefaults(int $storeId, string $merchantId, string $secret, string $backendUrl): void
    {
        $this->config->method("getMerchantId")->with($storeId)->willReturn($merchantId);
        $this->config->method("getWebhookSecret")->with($storeId)->willReturn($secret);
        $this->config->method("getBackendUrl")->with($storeId)->willReturn($backendUrl);
    }

    private function createOrderMock(): OrderInterface&MockObject
    {
        $item = $this->getMockBuilder(\stdClass::class)
            ->addMethods(["getProductId", "getQtyOrdered", "getPrice", "getSku", "getName"])
            ->getMock();

        $item->method("getProductId")->willReturn(777);
        $item->method("getQtyOrdered")->willReturn(2);
        $item->method("getPrice")->willReturn("74.995");
        $item->method("getSku")->willReturn("sku-777");
        $item->method("getName")->willReturn("Test Product");

        $order = $this->createMock(OrderInterface::class);
        $order->method("getStoreId")->willReturn(1);
        $order->method("getAllVisibleItems")->willReturn([$item]);
        $order->method("getIncrementId")->willReturn("100000123");
        $order->method("getCustomerId")->willReturn("cust-42");
        $order->method("getCustomerEmail")->willReturn("customer@example.com");
        $order->method("getProtectCode")->willReturn("protect-token");
        $order->method("getQuoteId")->willReturn(555);
        $order->method("getOrderCurrencyCode")->willReturn("EUR");
        $order->method("getGrandTotal")->willReturn("149.99");

        return $order;
    }
}
