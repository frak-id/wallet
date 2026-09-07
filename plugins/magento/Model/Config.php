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

    /**
     * Origins used when the admin URL fields are not both set. Mirrors the
     * defaults in `etc/config.xml`; the getters stay null-returning so callers
     * can tell a cleared field from a configured one.
     */
    public const DEFAULT_WALLET_URL = "https://wallet.frak.id";
    public const DEFAULT_BACKEND_URL = "https://backend.frak.id";

    /**
     * Initialize with Magento scope config
     *
     * @param ScopeConfigInterface $scopeConfig
     */
    public function __construct(
        private readonly ScopeConfigInterface $scopeConfig
    ) {
    }

    /**
     * Check if the Frak SDK module is enabled for a given store
     *
     * @param int|null $storeId
     * @return bool
     */
    public function isEnabled(?int $storeId = null): bool
    {
        return $this->scopeConfig->isSetFlag(
            self::XML_PATH_ENABLED,
            ScopeInterface::SCOPE_STORE,
            $storeId
        );
    }

    /**
     * Get the Frak merchant ID for a given store
     *
     * @param int|null $storeId
     * @return string|null
     */
    public function getMerchantId(?int $storeId = null): ?string
    {
        return $this->getStringValue(self::XML_PATH_MERCHANT_ID, $storeId);
    }

    /**
     * Get the webhook signing secret, with decryption guard for 0:3: prefix
     *
     * @param int|null $storeId
     * @return string|null
     */
    public function getWebhookSecret(?int $storeId = null): ?string
    {
        $secret = $this->getStringValue(self::XML_PATH_WEBHOOK_SECRET, $storeId);
        if ($secret === null) {
            return null;
        }

        return str_starts_with($secret, "0:3:") ? null : $secret;
    }

    /**
     * Get the Frak wallet application URL
     *
     * @param int|null $storeId
     * @return string|null
     */
    public function getWalletUrl(?int $storeId = null): ?string
    {
        return $this->getStringValue(self::XML_PATH_WALLET_URL, $storeId);
    }

    /**
     * Get the CDN URL for Frak SDK components
     *
     * @param int|null $storeId
     * @return string|null
     */
    public function getComponentsUrl(?int $storeId = null): ?string
    {
        return $this->getStringValue(self::XML_PATH_COMPONENTS_URL, $storeId);
    }

    /**
     * Get the Frak backend API URL
     *
     * @param int|null $storeId
     * @return string|null
     */
    public function getBackendUrl(?int $storeId = null): ?string
    {
        return $this->getStringValue(self::XML_PATH_BACKEND_URL, $storeId);
    }

    /**
     * Resolve the wallet + backend origin pair.
     *
     * Both-or-neither: a null means the merchant cleared that field, and
     * honouring the surviving half would pair a custom origin with the other
     * environment's default. Every consumer reads the pair from here so the
     * page, the tracker and the webhook cannot disagree on the backend.
     *
     * @param int|null $storeId
     * @return array{wallet: string, backend: string}
     */
    public function getEnvironment(?int $storeId = null): array
    {
        $wallet = $this->getWalletUrl($storeId);
        $backend = $this->getBackendUrl($storeId);

        if ($wallet === null || $backend === null) {
            return [
                "wallet" => self::DEFAULT_WALLET_URL,
                "backend" => self::DEFAULT_BACKEND_URL,
            ];
        }

        return ["wallet" => $wallet, "backend" => $backend];
    }

    /**
     * Whether exactly one of the two origin fields is set.
     *
     * @param int|null $storeId
     * @return bool
     */
    public function isEnvironmentHalfConfigured(?int $storeId = null): bool
    {
        $wallet = $this->getWalletUrl($storeId);
        $backend = $this->getBackendUrl($storeId);

        return ($wallet === null) !== ($backend === null);
    }

    /**
     * Get the SDK display language
     *
     * @param int|null $storeId
     * @return string|null
     */
    public function getLanguage(?int $storeId = null): ?string
    {
        return $this->getStringValue(self::XML_PATH_LANGUAGE, $storeId);
    }

    /**
     * Get the merchant logo URL for SDK modals
     *
     * @param int|null $storeId
     * @return string|null
     */
    public function getLogoUrl(?int $storeId = null): ?string
    {
        return $this->getStringValue(self::XML_PATH_LOGO_URL, $storeId);
    }

    /**
     * Check if the share button should be displayed
     *
     * @param int|null $storeId
     * @return bool
     */
    public function showShareButton(?int $storeId = null): bool
    {
        return $this->scopeConfig->isSetFlag(
            self::XML_PATH_SHARE_BUTTON_ENABLED,
            ScopeInterface::SCOPE_STORE,
            $storeId
        );
    }

    /**
     * Get the wallet button screen position
     *
     * @param int|null $storeId
     * @return string|null
     */
    public function getWalletButtonPosition(?int $storeId = null): ?string
    {
        return $this->getStringValue(self::XML_PATH_WALLET_BUTTON_POSITION, $storeId);
    }

    /**
     * Get the store name from Magento config
     *
     * @param int|null $storeId
     * @return string|null
     */
    public function getStoreName(?int $storeId = null): ?string
    {
        return $this->getStringValue(self::XML_PATH_STORE_NAME, $storeId);
    }

    /**
     * Read a string config value, normalising blank input to null.
     *
     * Trimmed first: the URL fields carry no `<validate>`, so a merchant who
     * "clears" one by leaving a space would otherwise save a non-null value
     * that every downstream guard reads as configured.
     *
     * @param string $path
     * @param int|null $storeId
     * @return string|null
     */
    private function getStringValue(string $path, ?int $storeId = null): ?string
    {
        $value = $this->scopeConfig->getValue(
            $path,
            ScopeInterface::SCOPE_STORE,
            $storeId
        );

        if (is_string($value)) {
            $value = trim($value);
        }

        if ($value === null || $value === "") {
            return null;
        }

        return (string) $value;
    }
}
