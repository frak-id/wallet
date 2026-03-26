<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Block;

use FrakLabs\Sdk\Model\Config;
use Magento\Checkout\Model\Session as CheckoutSession;
use Magento\Framework\View\Element\Template;

class PurchaseTracker extends Template
{
    public function __construct(
        Template\Context $context,
        private readonly Config $config,
        private readonly CheckoutSession $checkoutSession,
        array $data = []
    ) {
        parent::__construct($context, $data);
    }

    public function isEnabled(): bool
    {
        return $this->config->isEnabled();
    }

    public function getBackendUrl(): string
    {
        return $this->config->getBackendUrl();
    }

    public function getOrderTrackingData(): ?string
    {
        $order = $this->checkoutSession->getLastRealOrder();
        if (!$order || !$order->getId()) {
            return null;
        }

        $trackingData = [
            "customerId" => (string) $order->getCustomerEmail(),
            "orderId" => (string) $order->getIncrementId(),
            "token" => (string) $order->getProtectCode(),
            "merchantId" => (string) $this->config->getMerchantId(),
        ];

        $encoded = json_encode($trackingData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return $encoded === false ? null : $encoded;
    }

    public function escapeJs(string $string): string
    {
        return addslashes($string);
    }
}
