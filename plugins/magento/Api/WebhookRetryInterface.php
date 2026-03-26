<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Api;

interface WebhookRetryInterface
{
    public function enqueue(string $orderId, int $storeId, string $payload): void;

    public function processRetries(): void;
}
