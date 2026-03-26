<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Model\Retry;

use FrakLabs\Sdk\Api\WebhookRetryInterface;
use Magento\Framework\MessageQueue\PublisherInterface;

class MessageQueueRetry implements WebhookRetryInterface
{
    private const TOPIC_NAME = "fraklabs.webhook.retry";

    public function __construct(
        private readonly PublisherInterface $publisher
    ) {}

    public function enqueue(string $orderId, int $storeId, string $payload): void
    {
        $this->publisher->publish(self::TOPIC_NAME, [
            "order_id" => $orderId,
            "store_id" => $storeId,
            "payload" => $payload,
        ]);
    }

    public function processRetries(): void
    {
    }
}
