<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Model;

use FrakLabs\Sdk\Api\WebhookRetryInterface;
use FrakLabs\Sdk\Model\Retry\CronRetry;
use FrakLabs\Sdk\Model\Retry\MessageQueueRetry;
use Magento\Framework\App\DeploymentConfig;

/**
 * Selects the appropriate webhook retry backend at runtime
 *
 * Uses Magento MessageQueue (RabbitMQ) when configured, otherwise falls back to cron + DB table.
 * Named "Resolver" instead of "Factory" to avoid collision with Magento's auto-generated factory
 * naming convention (which would cause PHPStan to infer a non-existent return type).
 */
class WebhookRetryResolver
{
    /**
     * @param DeploymentConfig $deploymentConfig
     * @param MessageQueueRetry $mqRetry
     * @param CronRetry $cronRetry
     */
    public function __construct(
        private readonly DeploymentConfig $deploymentConfig,
        private readonly MessageQueueRetry $mqRetry,
        private readonly CronRetry $cronRetry
    ) {
    }

    /**
     * Create the appropriate retry implementation based on available infrastructure
     *
     * @return WebhookRetryInterface
     */
    public function create(): WebhookRetryInterface
    {
        $amqpConfig = $this->deploymentConfig->get("queue/amqp");
        if (!empty($amqpConfig)) {
            return $this->mqRetry;
        }

        return $this->cronRetry;
    }
}
