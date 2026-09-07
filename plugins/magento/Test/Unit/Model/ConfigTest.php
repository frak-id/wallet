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

    public function testUrlGettersReturnConfiguredValues(): void
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

    /**
     * The whole pairing guard rests on a cleared field arriving as null.
     *
     * @dataProvider blankConfigValueProvider
     */
    public function testBlankUrlFieldsNormaliseToNull(mixed $raw): void
    {
        $this->scopeConfig->method("getValue")->willReturn($raw);

        self::assertNull($this->config->getWalletUrl());
        self::assertNull($this->config->getBackendUrl());
    }

    /**
     * @return array<string, array{0: mixed}>
     */
    public static function blankConfigValueProvider(): array
    {
        return [
            "null" => [null],
            "empty string" => [""],
            "single space" => [" "],
            "tabs and newline" => ["\t\n "],
        ];
    }

    public function testGetEnvironmentReturnsBothConfiguredOrigins(): void
    {
        $this->scopeConfig
            ->method("getValue")
            ->willReturnMap([
                ["fraklabs_sdk/urls/wallet_url", ScopeInterface::SCOPE_STORE, null, "https://wallet-dev.frak.id"],
                ["fraklabs_sdk/urls/backend_url", ScopeInterface::SCOPE_STORE, null, "https://backend.gcp-dev.frak.id"],
            ]);

        self::assertSame(
            ["wallet" => "https://wallet-dev.frak.id", "backend" => "https://backend.gcp-dev.frak.id"],
            $this->config->getEnvironment()
        );
        self::assertFalse($this->config->isEnvironmentHalfConfigured());
    }

    /**
     * @dataProvider halfConfiguredProvider
     */
    public function testGetEnvironmentFallsBackAsAPair(
        ?string $wallet,
        ?string $backend,
        bool $isHalfConfigured
    ): void {
        $this->scopeConfig
            ->method("getValue")
            ->willReturnMap([
                ["fraklabs_sdk/urls/wallet_url", ScopeInterface::SCOPE_STORE, null, $wallet],
                ["fraklabs_sdk/urls/backend_url", ScopeInterface::SCOPE_STORE, null, $backend],
            ]);

        self::assertSame(
            [
                "wallet" => Config::DEFAULT_WALLET_URL,
                "backend" => Config::DEFAULT_BACKEND_URL,
            ],
            $this->config->getEnvironment()
        );
        self::assertSame($isHalfConfigured, $this->config->isEnvironmentHalfConfigured());
    }

    /**
     * @return array<string, array{0: string|null, 1: string|null, 2: bool}>
     */
    public static function halfConfiguredProvider(): array
    {
        return [
            "wallet set, backend cleared" => ["https://wallet-dev.frak.id", null, true],
            "backend set, wallet cleared" => [null, "https://backend.gcp-dev.frak.id", true],
            "both cleared" => [null, null, false],
        ];
    }

    public function testDefaultOriginsMatchShippedConfigXml(): void
    {
        $xml = simplexml_load_file(__DIR__ . "/../../../etc/config.xml");
        $urls = $xml->default->fraklabs_sdk->urls;

        self::assertSame(Config::DEFAULT_WALLET_URL, (string) $urls->wallet_url);
        self::assertSame(Config::DEFAULT_BACKEND_URL, (string) $urls->backend_url);
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
