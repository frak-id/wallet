<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Api;

interface WebhookRetryInterface
{
    /**
     * Enqueue a failed webhook for later retry
     *
     * @param string $orderId
     * @param int $storeId
     * @param string $payload
     * @return void
     */
    public function enqueue(string $orderId, int $storeId, string $payload): void;

    /**
     * Process pending webhook retries
     *
     * @return void
     */
    public function processRetries(): void;
}
