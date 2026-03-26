<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Model;

use FrakLabs\Sdk\Api\WebhookRetryInterface;
use FrakLabs\Sdk\Model\Retry\CronRetry;
use FrakLabs\Sdk\Model\Retry\MessageQueueRetry;
use Magento\Framework\App\DeploymentConfig;

class WebhookRetryFactory
{
    public function __construct(
        private readonly DeploymentConfig $deploymentConfig,
        private readonly MessageQueueRetry $mqRetry,
        private readonly CronRetry $cronRetry
    ) {}

    public function create(): WebhookRetryInterface
    {
        $amqpConfig = $this->deploymentConfig->get("queue/amqp");
        if (!empty($amqpConfig)) {
            return $this->mqRetry;
        }

        return $this->cronRetry;
    }
}
