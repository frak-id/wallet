<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Block;

use FrakLabs\Sdk\Model\Config;
use Magento\Framework\View\Element\Template;
use Magento\Store\Model\StoreManagerInterface;

class SdkLoader extends Template
{
    /**
     * Initialize block with SDK config and store manager
     *
     * @param Template\Context $context
     * @param Config $config
     * @param StoreManagerInterface $storeManager
     * @param array $data
     */
    public function __construct(
        Template\Context $context,
        private readonly Config $config,
        private readonly StoreManagerInterface $storeManager,
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
     * Get the CDN URL for Frak SDK components
     *
     * @return string
     */
    public function getComponentsUrl(): string
    {
        return $this->config->getComponentsUrl()
            ?? "https://cdn.jsdelivr.net/npm/@frak-labs/components@latest";
    }

    /**
     * Get the full window.FrakSetup JSON config for SDK initialization
     *
     * @return string
     */
    public function getFrakConfig(): string
    {
        $setup = [
            "config" => [
                "walletUrl" => $this->config->getWalletUrl() ?? "https://wallet.frak.id",
                "metadata" => [
                    "name" => $this->storeManager->getStore()->getName(),
                    "lang" => $this->config->getLanguage() ?? "en",
                    "logoUrl" => $this->config->getLogoUrl(),
                    "merchantId" => $this->config->getMerchantId(),
                ],
                "customizations" => [
                    "css" => null,
                    "i18n" => new \stdClass(),
                ],
            ],
            "modalConfig" => [
                "login" => [
                    "allowSso" => true,
                    "ssoMetadata" => [
                        "logoUrl" => $this->config->getLogoUrl(),
                    ],
                ],
            ],
            "modalShareConfig" => new \stdClass(),
            "modalWalletConfig" => [
                "metadata" => [
                    "position" => $this->config->getWalletButtonPosition() ?? "right",
                ],
            ],
        ];

        $encoded = json_encode($setup, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return $encoded === false ? "{}" : $encoded;
    }

    /**
     * Get the Frak backend URL
     *
     * @return string
     */
    public function getBackendUrl(): string
    {
        return $this->config->getBackendUrl() ?? "https://backend.frak.id";
    }
}
