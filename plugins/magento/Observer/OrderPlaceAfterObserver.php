<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Observer;

use FrakLabs\Sdk\Model\Config;
use FrakLabs\Sdk\Model\WebhookRetryResolver;
use FrakLabs\Sdk\Model\WebhookSender;
use Magento\Framework\Event\Observer;
use Magento\Framework\Event\ObserverInterface;
use Magento\Framework\Stdlib\Cookie\CookieReaderInterface;
use Magento\Sales\Api\Data\OrderInterface;
use Psr\Log\LoggerInterface;

class OrderPlaceAfterObserver implements ObserverInterface
{
    /**
     * @param Config $config
     * @param WebhookSender $webhookSender
     * @param WebhookRetryResolver $retryResolver
     * @param CookieReaderInterface $cookieReader
     * @param LoggerInterface $logger
     */
    public function __construct(
        private readonly Config $config,
        private readonly WebhookSender $webhookSender,
        private readonly WebhookRetryResolver $retryResolver,
        private readonly CookieReaderInterface $cookieReader,
        private readonly LoggerInterface $logger
    ) {
    }

    /**
     * Handle checkout_submit_all_after event
     *
     * Supports both single-order and multi-order (multi-address checkout) events.
     *
     * @param Observer $observer
     * @return void
     */
    public function execute(Observer $observer): void
    {
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

    /**
     * Process a single order: send webhook or enqueue for retry on failure
     *
     * @param OrderInterface $order
     * @return void
     */
    private function processOrder(OrderInterface $order): void
    {
        if (!$this->config->isEnabled((int) $order->getStoreId())) {
            return;
        }

        if (!$order->getEntityId()) {
            return;
        }

        try {
            $clientId = $this->cookieReader->getCookie('frak_client_id');
            $this->webhookSender->sendOrderWebhook($order, 'pending', $clientId);
        } catch (\Exception $e) {
            $this->logger->error(
                '[FrakSDK] Webhook failed, enqueueing for retry: ' . $e->getMessage(),
                ['order_id' => $order->getIncrementId()]
            );

            try {
                $clientId = $this->cookieReader->getCookie('frak_client_id');
                $retry = $this->retryResolver->create();
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
