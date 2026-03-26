<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Model\Retry;

use DateTimeImmutable;
use FrakLabs\Sdk\Api\WebhookRetryInterface;
use FrakLabs\Sdk\Model\WebhookSender;
use Magento\Framework\App\ResourceConnection;
use Magento\Sales\Model\OrderFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

class CronRetry implements WebhookRetryInterface
{
    private const TABLE_NAME = "fraklabs_webhook_queue";
    private const MAX_ATTEMPTS = 5;
    private const BACKOFF_INTERVALS = [300, 900, 3600, 21600, 86400];

    /**
     * Initialize with database connection, webhook sender, order factory, and logger
     *
     * @param ResourceConnection $resourceConnection
     * @param WebhookSender $webhookSender
     * @param OrderFactory $orderFactory
     * @param LoggerInterface $logger
     */
    public function __construct(
        private readonly ResourceConnection $resourceConnection,
        private readonly WebhookSender $webhookSender,
        private readonly OrderFactory $orderFactory,
        private readonly LoggerInterface $logger
    ) {
    }

    /**
     * @inheritdoc
     */
    public function enqueue(string $orderId, int $storeId, string $payload): void
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);
        $now = $this->getCurrentTimestamp();

        $connection->insert($tableName, [
            "order_id" => $orderId,
            "store_id" => $storeId,
            "payload" => $payload,
            "attempts" => 0,
            "status" => "pending",
            "next_retry_at" => $now,
            "created_at" => $now,
        ]);
    }

    /**
     * @inheritdoc
     */
    public function processRetries(): void
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);
        $now = $this->getCurrentTimestamp();

        $select = $connection->select()
            ->from($tableName)
            ->where("status = ?", "pending")
            ->where("next_retry_at <= ?", $now)
            ->where("attempts < ?", self::MAX_ATTEMPTS);

        $rows = $connection->fetchAll($select);

        foreach ($rows as $row) {
            $queueId = (int) $row["id"];
            $attempts = (int) $row["attempts"];

            try {
                $this->attemptWebhook(
                    orderId: (string) $row["order_id"],
                    payload: (string) $row["payload"]
                );

                $connection->update(
                    $tableName,
                    [
                        "status" => "success",
                        "attempts" => $attempts + 1,
                        "last_attempt_at" => $now,
                        "error_message" => null,
                    ],
                    ["id = ?" => $queueId]
                );
            } catch (Throwable $throwable) {
                $updatedAttempts = $attempts + 1;
                $isFailed = $updatedAttempts >= self::MAX_ATTEMPTS;

                $connection->update(
                    $tableName,
                    [
                        "status" => $isFailed ? "failed" : "pending",
                        "attempts" => $updatedAttempts,
                        "last_attempt_at" => $now,
                        "next_retry_at" => $isFailed
                            ? $now
                            : $this->getNextRetryTimestamp($updatedAttempts),
                        "error_message" => mb_substr($throwable->getMessage(), 0, 65535),
                    ],
                    ["id = ?" => $queueId]
                );

                $this->logger->warning(
                    "[FrakSDK] Webhook retry failed",
                    [
                        "queue_id" => $queueId,
                        "order_id" => (string) $row["order_id"],
                        "attempts" => $updatedAttempts,
                        "message" => $throwable->getMessage(),
                    ]
                );
            }
        }
    }

    /**
     * Attempt to resend a webhook from persisted payload
     *
     * @param string $orderId
     * @param string $payload
     * @return void
     */
    private function attemptWebhook(string $orderId, string $payload): void
    {
        $decodedPayload = json_decode($payload, true, 512, JSON_THROW_ON_ERROR);
        $status = is_string($decodedPayload["status"] ?? null) ? $decodedPayload["status"] : "pending";
        $clientId = is_string($decodedPayload["clientId"] ?? null) ? $decodedPayload["clientId"] : null;

        $order = $this->loadOrderByIncrementId($orderId);
        if ($order === null) {
            throw new RuntimeException("Order not found for increment ID: {$orderId}");
        }

        $this->webhookSender->sendOrderWebhook($order, $status, $clientId);
    }

    /**
     * Load an order by its increment ID via constructor-injected factory
     *
     * @param string $orderId
     * @return \Magento\Sales\Api\Data\OrderInterface|null
     */
    private function loadOrderByIncrementId(string $orderId): ?\Magento\Sales\Api\Data\OrderInterface
    {
        $order = $this->orderFactory->create()->loadByIncrementId($orderId);
        if (!$order->getEntityId()) {
            return null;
        }

        return $order;
    }

    /**
     * Get the current timestamp formatted for database storage
     *
     * @return string
     */
    private function getCurrentTimestamp(): string
    {
        return (new DateTimeImmutable())->format("Y-m-d H:i:s");
    }

    /**
     * Calculate the next retry timestamp using exponential backoff (5m, 15m, 1h, 6h, 24h)
     *
     * @param int $attempts
     * @return string
     */
    private function getNextRetryTimestamp(int $attempts): string
    {
        $index = min($attempts - 1, count(self::BACKOFF_INTERVALS) - 1);
        $delaySeconds = self::BACKOFF_INTERVALS[$index];

        return (new DateTimeImmutable("+{$delaySeconds} seconds"))->format("Y-m-d H:i:s");
    }
}
