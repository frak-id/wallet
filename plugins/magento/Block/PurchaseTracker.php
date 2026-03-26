<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Block;

use FrakLabs\Sdk\Model\Config;
use Magento\Checkout\Model\Session as CheckoutSession;
use Magento\Framework\View\Element\Template;

class PurchaseTracker extends Template
{
    /**
     * Initialize block with SDK config and checkout session
     *
     * @param Template\Context $context
     * @param Config $config
     * @param CheckoutSession $checkoutSession
     * @param array $data
     */
    public function __construct(
        Template\Context $context,
        private readonly Config $config,
        private readonly CheckoutSession $checkoutSession,
        array $data = []
    ) {
        parent::__construct($context, $data);
    }

    /**
     * Check if the Frak SDK module is enabled
     *
     * @return bool
     */
    public function isEnabled(): bool
    {
        return $this->config->isEnabled();
    }

    /**
     * Get the Frak backend URL for client-side purchase tracking
     *
     * @return string
     */
    public function getBackendUrl(): string
    {
        return $this->config->getBackendUrl() ?? "https://backend.frak.id";
    }

    /**
     * Get order tracking data as JSON for the success page JS tracker
     *
     * @return string|null
     */
    public function getOrderTrackingData(): ?string
    {
        $order = $this->checkoutSession->getLastRealOrder();
        if (!$order->getId()) {
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
}
