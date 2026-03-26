<?php

declare(strict_types=1);

namespace FrakLabs\Sdk\Observer;

use FrakLabs\Sdk\Model\Config;
use FrakLabs\Sdk\Model\WebhookSender;
use Magento\Framework\Event\Observer;
use Magento\Framework\Event\ObserverInterface;
use Psr\Log\LoggerInterface;

class OrderStatusUpdateObserver implements ObserverInterface
{
    public function __construct(
        private readonly Config $config,
        private readonly WebhookSender $webhookSender,
        private readonly LoggerInterface $logger
    ) {}

    public function execute(Observer $observer): void
    {
        $eventName = (string) $observer->getEvent()->getName();

        try {
            if ($eventName === 'sales_order_invoice_pay') {
                $invoice = $observer->getEvent()->getInvoice();
                $order = $invoice?->getOrder();
                if ($order && $this->config->isEnabled((int) $order->getStoreId())) {
                    $this->webhookSender->sendOrderWebhook($order, 'confirmed', null);
                }
                return;
            }

            if ($eventName === 'sales_order_creditmemo_save_after') {
                $creditmemo = $observer->getEvent()->getCreditmemo();
                $order = $creditmemo?->getOrder();
                if ($order && $this->config->isEnabled((int) $order->getStoreId())) {
                    $this->webhookSender->sendOrderWebhook($order, 'refunded', null);
                }
            }
        } catch (\Exception $e) {
            $this->logger->error(
                '[FrakSDK] Status update webhook failed: ' . $e->getMessage(),
                ['event' => $eventName]
            );
        }
    }
}
