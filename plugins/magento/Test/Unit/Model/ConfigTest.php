<?php

declare(strict_types=1);

namespace FrakLabs\Sdk\Test\Unit\Model;

use FrakLabs\Sdk\Model\Config;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Store\Model\ScopeInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class ConfigTest extends TestCase
{
    private ScopeConfigInterface&MockObject $scopeConfig;
    private Config $config;

    protected function setUp(): void
    {
        $this->scopeConfig = $this->createMock(ScopeConfigInterface::class);
        $this->config = new Config($this->scopeConfig);
    }

    public function testIsEnabledReturnsTrue(): void
    {
        $this->scopeConfig
            ->expects(self::once())
            ->method("isSetFlag")
            ->with("fraklabs_sdk/general/enabled", ScopeInterface::SCOPE_STORE, null)
            ->willReturn(true);

        self::assertTrue($this->config->isEnabled());
    }

    public function testIsEnabledReturnsFalse(): void
    {
        $this->scopeConfig
            ->expects(self::exactly(2))
            ->method("isSetFlag")
            ->with("fraklabs_sdk/general/enabled", ScopeInterface::SCOPE_STORE, null)
            ->willReturn(false);

        self::assertFalse($this->config->isEnabled());
        self::assertFalse($this->config->isEnabled());
    }

    public function testGetMerchantId(): void
    {
        $this->scopeConfig
            ->expects(self::once())
            ->method("getValue")
            ->with("fraklabs_sdk/general/merchant_id", ScopeInterface::SCOPE_STORE, null)
            ->willReturn("merchant-123");

        self::assertSame("merchant-123", $this->config->getMerchantId());
    }

    public function testGetWebhookSecretReturnsNullWhenEncryptedPlaceholderIsDetected(): void
    {
        $this->scopeConfig
            ->expects(self::once())
            ->method("getValue")
            ->with("fraklabs_sdk/general/webhook_secret", ScopeInterface::SCOPE_STORE, null)
            ->willReturn("0:3:encrypted-value");

        self::assertNull($this->config->getWebhookSecret());
    }

    public function testGetWebhookSecretReturnsValue(): void
    {
        $this->scopeConfig
            ->expects(self::once())
            ->method("getValue")
            ->with("fraklabs_sdk/general/webhook_secret", ScopeInterface::SCOPE_STORE, null)
            ->willReturn("plain-secret");

        self::assertSame("plain-secret", $this->config->getWebhookSecret());
    }

    public function testDefaultUrls(): void
    {
        $this->scopeConfig
            ->expects(self::exactly(3))
            ->method("getValue")
            ->willReturnMap([
                ["fraklabs_sdk/urls/wallet_url", ScopeInterface::SCOPE_STORE, null, "https://wallet.frak.id"],
                ["fraklabs_sdk/urls/components_url", ScopeInterface::SCOPE_STORE, null, "https://cdn.frak.id/components"],
                ["fraklabs_sdk/urls/backend_url", ScopeInterface::SCOPE_STORE, null, "https://api.frak.id"],
            ]);

        self::assertSame("https://wallet.frak.id", $this->config->getWalletUrl());
        self::assertSame("https://cdn.frak.id/components", $this->config->getComponentsUrl());
        self::assertSame("https://api.frak.id", $this->config->getBackendUrl());
    }

    public function testStoreIdPassedToScopeConfig(): void
    {
        $storeId = 42;

        $this->scopeConfig
            ->expects(self::exactly(3))
            ->method("getValue")
            ->willReturnMap([
                ["fraklabs_sdk/general/merchant_id", ScopeInterface::SCOPE_STORE, $storeId, "merchant-store-42"],
                ["fraklabs_sdk/general/webhook_secret", ScopeInterface::SCOPE_STORE, $storeId, "secret-store-42"],
                ["fraklabs_sdk/urls/backend_url", ScopeInterface::SCOPE_STORE, $storeId, "https://store42.api.frak.id"],
            ]);

        self::assertSame("merchant-store-42", $this->config->getMerchantId($storeId));
        self::assertSame("secret-store-42", $this->config->getWebhookSecret($storeId));
        self::assertSame("https://store42.api.frak.id", $this->config->getBackendUrl($storeId));
    }
}
