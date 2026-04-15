<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Model\Retry;

use FrakLabs\Sdk\Api\WebhookRetryInterface;
use Magento\Framework\MessageQueue\PublisherInterface;

class MessageQueueRetry implements WebhookRetryInterface
{
    private const TOPIC_NAME = "fraklabs.webhook.retry";

    /**
     * @param PublisherInterface $publisher
     */
    public function __construct(
        private readonly PublisherInterface $publisher
    ) {
    }

    /**
     * Enqueue a failed webhook for retry via AMQP message queue
     *
     * @param string $orderId
     * @param int $storeId
     * @param string $payload
     * @return void
     */
    public function enqueue(string $orderId, int $storeId, string $payload): void
    {
        $this->publisher->publish(self::TOPIC_NAME, [
            "order_id" => $orderId,
            "store_id" => $storeId,
            "payload" => $payload,
        ]);
    }

    /**
     * Process retries — no-op because the MQ consumer handles delivery
     *
     * @return void
     */
    public function processRetries(): void
    {
        // Intentionally empty: the message queue consumer handles retry delivery.
    }
}
