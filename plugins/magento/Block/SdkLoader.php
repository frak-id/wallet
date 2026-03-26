<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Block;

use FrakLabs\Sdk\Model\Config;
use Magento\Framework\View\Element\Template;
use Magento\Store\Model\StoreManagerInterface;

class SdkLoader extends Template
{
    public function __construct(
        Template\Context $context,
        private readonly Config $config,
        private readonly StoreManagerInterface $storeManager,
        array $data = []
    ) {
        parent::__construct($context, $data);
    }

    public function isEnabled(): bool
    {
        return $this->config->isEnabled();
    }

    public function getComponentsUrl(): string
    {
        return $this->config->getComponentsUrl();
    }

    public function getFrakConfig(): string
    {
        $setup = [
            "config" => [
                "walletUrl" => $this->config->getWalletUrl(),
                "metadata" => [
                    "name" => $this->storeManager->getStore()->getName(),
                    "lang" => $this->config->getLanguage(),
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
                    "position" => $this->config->getWalletButtonPosition(),
                ],
            ],
        ];

        $encoded = json_encode($setup, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return $encoded === false ? "{}" : $encoded;
    }

    public function getBackendUrl(): string
    {
        return $this->config->getBackendUrl();
    }
}
