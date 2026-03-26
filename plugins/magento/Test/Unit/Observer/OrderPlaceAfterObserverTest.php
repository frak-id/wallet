<?php

declare(strict_types=1);

namespace FrakLabs\Sdk\Test\Unit\Observer;

use FrakLabs\Sdk\Api\WebhookRetryInterface;
use FrakLabs\Sdk\Model\Config;
use FrakLabs\Sdk\Model\WebhookRetryFactory;
use FrakLabs\Sdk\Model\WebhookSender;
use FrakLabs\Sdk\Observer\OrderPlaceAfterObserver;
use Magento\Framework\Event;
use Magento\Framework\Event\Observer;
use Magento\Framework\Stdlib\Cookie\CookieReaderInterface;
use Magento\Sales\Api\Data\OrderInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class OrderPlaceAfterObserverTest extends TestCase
{
    private Config&MockObject $config;
    private WebhookSender&MockObject $webhookSender;
    private WebhookRetryFactory&MockObject $retryFactory;
    private CookieReaderInterface&MockObject $cookieReader;
    private LoggerInterface&MockObject $logger;
    private OrderPlaceAfterObserver $observer;

    protected function setUp(): void
    {
        $this->config = $this->createMock(Config::class);
        $this->webhookSender = $this->createMock(WebhookSender::class);
        $this->retryFactory = $this->createMock(WebhookRetryFactory::class);
        $this->cookieReader = $this->createMock(CookieReaderInterface::class);
        $this->logger = $this->createMock(LoggerInterface::class);

        $this->observer = new OrderPlaceAfterObserver(
            $this->config,
            $this->webhookSender,
            $this->retryFactory,
            $this->cookieReader,
            $this->logger
        );
    }

    public function testSkipsWhenDisabled(): void
    {
        $order = $this->createOrderMock(1, 123, "100000123");
        $observer = $this->createObserverWithEvent($order, null);

        $this->config->expects(self::once())->method("isEnabled")->with(1)->willReturn(false);
        $this->webhookSender->expects(self::never())->method("sendOrderWebhook");

        $this->observer->execute($observer);
    }

    public function testSendsWebhookWhenEnabled(): void
    {
        $order = $this->createOrderMock(1, 123, "100000123");
        $observer = $this->createObserverWithEvent($order, null);

        $this->config->expects(self::once())->method("isEnabled")->with(1)->willReturn(true);
        $this->cookieReader->expects(self::once())->method("getCookie")->with("frak_client_id")->willReturn("client-xyz");
        $this->webhookSender
            ->expects(self::once())
            ->method("sendOrderWebhook")
            ->with($order, "pending", "client-xyz");

        $this->observer->execute($observer);
    }

    public function testHandlesMultipleOrders(): void
    {
        $orderOne = $this->createOrderMock(1, 101, "100000101");
        $orderTwo = $this->createOrderMock(2, 102, "100000102");
        $observer = $this->createObserverWithEvent(null, [$orderOne, $orderTwo]);

        $this->config
            ->expects(self::exactly(2))
            ->method("isEnabled")
            ->willReturnMap([
                [1, true],
                [2, true],
            ]);
        $this->cookieReader->expects(self::exactly(2))->method("getCookie")->with("frak_client_id")->willReturn("client-multi");
        $calls = 0;
        $this->webhookSender
            ->expects(self::exactly(2))
            ->method("sendOrderWebhook")
            ->willReturnCallback(function (OrderInterface $order, string $status, ?string $clientId) use ($orderOne, $orderTwo, &$calls): void {
                if ($calls === 0) {
                    self::assertSame($orderOne, $order);
                } else {
                    self::assertSame($orderTwo, $order);
                }

                self::assertSame("pending", $status);
                self::assertSame("client-multi", $clientId);
                $calls++;
            });

        $this->observer->execute($observer);
    }

    public function testCatchesExceptionWithoutBreakingCheckout(): void
    {
        $order = $this->createOrderMock(1, 123, "100000123");
        $observer = $this->createObserverWithEvent($order, null);

        $this->config->method("isEnabled")->with(1)->willReturn(true);
        $this->cookieReader->method("getCookie")->with("frak_client_id")->willReturn("client-xyz");
        $this->webhookSender->method("sendOrderWebhook")->willThrowException(new \RuntimeException("boom"));

        $retry = $this->createMock(WebhookRetryInterface::class);
        $retry->expects(self::once())->method("enqueue");
        $this->retryFactory->method("create")->willReturn($retry);
        $this->logger->expects(self::once())->method("error");

        $this->observer->execute($observer);
        self::assertTrue(true);
    }

    public function testPassesClientIdFromCookie(): void
    {
        $order = $this->createOrderMock(1, 123, "100000123");
        $observer = $this->createObserverWithEvent($order, null);

        $this->config->method("isEnabled")->with(1)->willReturn(true);
        $this->cookieReader->expects(self::once())->method("getCookie")->with("frak_client_id")->willReturn("cookie-client-id");
        $this->webhookSender
            ->expects(self::once())
            ->method("sendOrderWebhook")
            ->with($order, "pending", "cookie-client-id");

        $this->observer->execute($observer);
    }

    public function testEnqueuesRetryOnFailure(): void
    {
        $order = $this->createOrderMock(5, 200, "200000200");
        $observer = $this->createObserverWithEvent($order, null);

        $this->config->method("isEnabled")->with(5)->willReturn(true);
        $this->cookieReader->method("getCookie")->with("frak_client_id")->willReturn("retry-client-id");
        $this->webhookSender->method("sendOrderWebhook")->willThrowException(new \RuntimeException("send failed"));

        $retry = $this->createMock(WebhookRetryInterface::class);
        $retry
            ->expects(self::once())
            ->method("enqueue")
            ->with(
                "200000200",
                5,
                self::callback(function (string $payload): bool {
                    $data = json_decode($payload, true, 512, JSON_THROW_ON_ERROR);

                    return $data === [
                        "order_id" => "200000200",
                        "status" => "pending",
                        "client_id" => "retry-client-id",
                    ];
                })
            );
        $this->retryFactory->method("create")->willReturn($retry);

        $this->observer->execute($observer);
    }

    private function createObserverWithEvent(?OrderInterface $order, ?array $orders): Observer
    {
        $event = $this->createMock(Event::class);
        $event->method("getOrder")->willReturn($order);
        $event->method("getOrders")->willReturn($orders);

        $observer = $this->createMock(Observer::class);
        $observer->method("getEvent")->willReturn($event);

        return $observer;
    }

    private function createOrderMock(int $storeId, int $id, string $incrementId): OrderInterface&MockObject
    {
        $order = $this->createMock(OrderInterface::class);
        $order->method("getStoreId")->willReturn($storeId);
        $order->method("getId")->willReturn($id);
        $order->method("getIncrementId")->willReturn($incrementId);

        return $order;
    }
}
