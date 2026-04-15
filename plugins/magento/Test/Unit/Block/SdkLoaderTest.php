<?php

declare(strict_types=1);

namespace FrakLabs\Sdk\Test\Unit\Block;

use FrakLabs\Sdk\Block\SdkLoader;
use FrakLabs\Sdk\Model\Config;
use Magento\Framework\View\Element\Template\Context;
use Magento\Store\Model\StoreManagerInterface;
use Magento\Store\Api\Data\StoreInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class SdkLoaderTest extends TestCase
{
    private Config&MockObject $config;
    private StoreManagerInterface&MockObject $storeManager;
    private Context&MockObject $context;
    private SdkLoader $sdkLoader;

    protected function setUp(): void
    {
        $this->config = $this->createMock(Config::class);
        $this->storeManager = $this->createMock(StoreManagerInterface::class);
        $this->context = $this->createMock(Context::class);

        $this->sdkLoader = new SdkLoader($this->context, $this->config, $this->storeManager);
    }

    public function testIsEnabledDelegatesToConfig(): void
    {
        $this->config->expects(self::once())->method("isEnabled")->with()->willReturn(true);

        self::assertTrue($this->sdkLoader->isEnabled());
    }

    public function testGetComponentsUrlReturnsConfigValue(): void
    {
        $this->config->expects(self::once())->method("getComponentsUrl")->with()->willReturn("https://cdn.frak.id/components");

        self::assertSame("https://cdn.frak.id/components", $this->sdkLoader->getComponentsUrl());
    }

    public function testGetFrakConfigReturnsValidJson(): void
    {
        $store = $this->createMock(StoreInterface::class);
        $store->method("getName")->willReturn("Frak Demo Store");

        $this->storeManager->method("getStore")->willReturn($store);
        $this->config->method("getWalletUrl")->willReturn("https://wallet.frak.id");
        $this->config->method("getLanguage")->willReturn("fr");
        $this->config->method("getLogoUrl")->willReturn("https://cdn.frak.id/logo.png");
        $this->config->method("getMerchantId")->willReturn("merchant-123");
        $this->config->method("getWalletButtonPosition")->willReturn("right");

        $json = $this->sdkLoader->getFrakConfig();
        $data = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

        self::assertIsArray($data);
        self::assertArrayHasKey("config", $data);
        self::assertArrayHasKey("modalConfig", $data);
        self::assertArrayHasKey("modalShareConfig", $data);
        self::assertArrayHasKey("modalWalletConfig", $data);
        self::assertSame("https://wallet.frak.id", $data["config"]["walletUrl"]);
        self::assertSame("Frak Demo Store", $data["config"]["metadata"]["name"]);
        self::assertSame("fr", $data["config"]["metadata"]["lang"]);
        self::assertSame("https://cdn.frak.id/logo.png", $data["config"]["metadata"]["logoUrl"]);
        self::assertSame("merchant-123", $data["config"]["metadata"]["merchantId"]);
        self::assertSame("right", $data["modalWalletConfig"]["metadata"]["position"]);
    }
}
