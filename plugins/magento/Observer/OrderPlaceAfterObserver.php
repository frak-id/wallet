<?php

declare(strict_types=1);

namespace FrakLabs\Sdk\Observer;

use FrakLabs\Sdk\Api\WebhookRetryInterface;
use FrakLabs\Sdk\Model\Config;
use FrakLabs\Sdk\Model\WebhookRetryFactory;
use FrakLabs\Sdk\Model\WebhookSender;
use Magento\Framework\Event\Observer;
use Magento\Framework\Event\ObserverInterface;
use Magento\Framework\Stdlib\Cookie\CookieReaderInterface;
use Magento\Sales\Api\Data\OrderInterface;
use Psr\Log\LoggerInterface;

class OrderPlaceAfterObserver implements ObserverInterface
{
    public function __construct(
        private readonly Config $config,
        private readonly WebhookSender $webhookSender,
        private readonly WebhookRetryFactory $retryFactory,
        private readonly CookieReaderInterface $cookieReader,
        private readonly LoggerInterface $logger
    ) {}

    public function execute(Observer $observer): void
    {
        // Handle both single-order and multi-order events
        $order = $observer->getEvent()->getOrder();
        $orders = $observer->getEvent()->getOrders();

        if ($orders) {
            foreach ($orders as $singleOrder) {
                $this->processOrder($singleOrder);
            }
        } elseif ($order) {
            $this->processOrder($order);
        }
    }

    private function processOrder(OrderInterface $order): void
    {
        // CRITICAL: resolve config for the ORDER's store, not the current store
        if (!$this->config->isEnabled((int) $order->getStoreId())) {
            return;
        }

        if (!$order->getId()) {
            return;
        }

        try {
            // Cookie exists only in checkout HTTP context
            $clientId = $this->cookieReader->getCookie('frak_client_id');
            $this->webhookSender->sendOrderWebhook($order, 'pending', $clientId);
        } catch (\Exception $e) {
            // Never let webhook failure break checkout — enqueue for retry
            $this->logger->error(
                '[FrakSDK] Webhook failed, enqueueing for retry: ' . $e->getMessage(),
                ['order_id' => $order->getIncrementId()]
            );

            try {
                $clientId = $this->cookieReader->getCookie('frak_client_id');
                $retry = $this->retryFactory->create();
                $payload = json_encode([
                    'order_id' => $order->getIncrementId(),
                    'status' => 'pending',
                    'client_id' => $clientId,
                ], JSON_THROW_ON_ERROR);
                $retry->enqueue(
                    (string) $order->getIncrementId(),
                    (int) $order->getStoreId(),
                    $payload
                );
            } catch (\Exception $retryException) {
                $this->logger->error(
                    '[FrakSDK] Retry enqueue also failed: ' . $retryException->getMessage(),
                    ['order_id' => $order->getIncrementId()]
                );
            }
        }
    }
}
