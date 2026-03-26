<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Model;

use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Store\Model\ScopeInterface;

class Config
{
    private const XML_PATH_ENABLED = "fraklabs_sdk/general/enabled";
    private const XML_PATH_MERCHANT_ID = "fraklabs_sdk/general/merchant_id";
    private const XML_PATH_WEBHOOK_SECRET = "fraklabs_sdk/general/webhook_secret";
    private const XML_PATH_WALLET_URL = "fraklabs_sdk/urls/wallet_url";
    private const XML_PATH_COMPONENTS_URL = "fraklabs_sdk/urls/components_url";
    private const XML_PATH_BACKEND_URL = "fraklabs_sdk/urls/backend_url";
    private const XML_PATH_LANGUAGE = "fraklabs_sdk/appearance/language";
    private const XML_PATH_LOGO_URL = "fraklabs_sdk/appearance/logo_url";
    private const XML_PATH_SHARE_BUTTON_ENABLED = "fraklabs_sdk/appearance/share_button_enabled";
    private const XML_PATH_WALLET_BUTTON_POSITION = "fraklabs_sdk/appearance/wallet_button_position";
    private const XML_PATH_STORE_NAME = "general/store_information/name";

    public function __construct(
        private readonly ScopeConfigInterface $scopeConfig
    ) {}

    public function isEnabled(?int $storeId = null): bool
    {
        return $this->scopeConfig->isSetFlag(
            self::XML_PATH_ENABLED,
            ScopeInterface::SCOPE_STORE,
            $storeId
        );
    }

    public function getMerchantId(?int $storeId = null): ?string
    {
        return $this->getStringValue(self::XML_PATH_MERCHANT_ID, $storeId);
    }

    public function getWebhookSecret(?int $storeId = null): ?string
    {
        $secret = $this->getStringValue(self::XML_PATH_WEBHOOK_SECRET, $storeId);
        if ($secret === null) {
            return null;
        }

        return str_starts_with($secret, "0:3:") ? null : $secret;
    }

    public function getWalletUrl(?int $storeId = null): ?string
    {
        return $this->getStringValue(self::XML_PATH_WALLET_URL, $storeId);
    }

    public function getComponentsUrl(?int $storeId = null): ?string
    {
        return $this->getStringValue(self::XML_PATH_COMPONENTS_URL, $storeId);
    }

    public function getBackendUrl(?int $storeId = null): ?string
    {
        return $this->getStringValue(self::XML_PATH_BACKEND_URL, $storeId);
    }

    public function getLanguage(?int $storeId = null): ?string
    {
        return $this->getStringValue(self::XML_PATH_LANGUAGE, $storeId);
    }

    public function getLogoUrl(?int $storeId = null): ?string
    {
        return $this->getStringValue(self::XML_PATH_LOGO_URL, $storeId);
    }

    public function showShareButton(?int $storeId = null): bool
    {
        return $this->scopeConfig->isSetFlag(
            self::XML_PATH_SHARE_BUTTON_ENABLED,
            ScopeInterface::SCOPE_STORE,
            $storeId
        );
    }

    public function getWalletButtonPosition(?int $storeId = null): ?string
    {
        return $this->getStringValue(self::XML_PATH_WALLET_BUTTON_POSITION, $storeId);
    }

    public function getStoreName(?int $storeId = null): ?string
    {
        return $this->getStringValue(self::XML_PATH_STORE_NAME, $storeId);
    }

    private function getStringValue(string $path, ?int $storeId = null): ?string
    {
        $value = $this->scopeConfig->getValue(
            $path,
            ScopeInterface::SCOPE_STORE,
            $storeId
        );

        if ($value === null || $value === "") {
            return null;
        }

        return (string) $value;
    }
}
