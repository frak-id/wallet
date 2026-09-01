<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Block;

use FrakLabs\Sdk\Model\Config;
use Magento\Framework\View\Element\Template;
use Magento\Store\Model\StoreManagerInterface;
use Psr\Log\LoggerInterface;

class SdkLoader extends Template
{
    /**
     * Initialize block with SDK config, store manager and logger
     *
     * @param Template\Context $context
     * @param Config $config
     * @param StoreManagerInterface $storeManager
     * @param LoggerInterface $logger
     * @param array $data
     */
    public function __construct(
        Template\Context $context,
        private readonly Config $config,
        private readonly StoreManagerInterface $storeManager,
        private readonly LoggerInterface $logger,
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
                "env" => $this->getEnvironment(),
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
     * The wallet + backend origin pair for the SDK's `env` config.
     *
     * Resolution lives on {@see Config::getEnvironment()} so the tracker and
     * the webhook resolve the same backend; this block only reports the
     * half-configured case, which it is the surface positioned to surface.
     *
     * @return array{wallet: string, backend: string}
     */
    private function getEnvironment(): array
    {
        if ($this->config->isEnvironmentHalfConfigured()) {
            $this->logger->warning(
                "Frak: only one of wallet_url/backend_url is set; both fall back to production.",
                [
                    "wallet" => $this->config->getWalletUrl(),
                    "backend" => $this->config->getBackendUrl(),
                ]
            );
        }

        return $this->config->getEnvironment();
    }
}
