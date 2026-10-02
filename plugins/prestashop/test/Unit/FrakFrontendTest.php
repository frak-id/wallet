<?php

declare(strict_types=1);

namespace FrakLabs\PrestaShop\Test\Unit;

use Configuration;
use FrakFrontend;
use FrakInfra;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use PHPUnit\Framework\TestCase;
use Tools;

require_once __DIR__ . '/doubles.php';
require_once __DIR__ . '/../../classes/FrakEnv.php';
require_once __DIR__ . '/../../classes/FrakUrls.php';
require_once __DIR__ . '/../../classes/FrakUtils.php';
require_once __DIR__ . '/../../classes/FrakConfig.php';
require_once __DIR__ . '/../../classes/FrakComponentRenderer.php';
require_once __DIR__ . '/../../classes/FrakFrontend.php';

final class FrakFrontendTest extends TestCase
{
    /** `head()` as released before the dev switch, captured with the brand below. */
    private const PRODUCTION_HEAD = '<link rel="dns-prefetch" href="https://sdk.frak.id">'
        . '<link rel="preconnect" href="https://sdk.frak.id">'
        . '<link rel="dns-prefetch" href="https://cdn.jsdelivr.net">'
        . '<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>'
        . '<script>window.FrakSetup=Object.assign(window.FrakSetup||{},{config:{metadata:{'
        . 'name:"Acme Shop",logoUrl:"https://shop.example/logo.png"}}});</script>'
        . '<script src="https://sdk.frak.id/components.js" defer onerror="var s=document.createElement(\'script\');'
        . 's.src=\'https://cdn.jsdelivr.net/npm/@frak-labs/components@latest/cdn/components.js\';'
        . 's.defer=true;document.head.appendChild(s)"></script>';

    protected function setUp(): void
    {
        frak_test_reset_doubles();
        FrakInfra::resetAll();
        Configuration::updateValue('FRAK_SHOP_NAME', 'Acme Shop');
        Configuration::updateValue('FRAK_LOGO_URL', 'https://shop.example/logo.png');
    }

    public function testNeitherConstantLeavesHeadByteIdentical(): void
    {
        $this->assertSame(self::PRODUCTION_HEAD, FrakFrontend::head());
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testDevLoadsDevSdkAndAddsEnvToTheConfig(): void
    {
        define('FRAK_ENV', 'dev');

        $head = FrakFrontend::head();

        $this->assertStringContainsString('<script src="https://sdk-dev.frak.id/components.js" defer', $head);
        $this->assertStringContainsString('<link rel="preconnect" href="https://sdk-dev.frak.id">', $head);
        $this->assertStringContainsString('@frak-labs/components@beta/cdn/components.js', $head);
        $this->assertStringNotContainsString('sdk.frak.id', $head);
        $this->assertStringContainsString('logoUrl:"https://shop.example/logo.png"},env:"dev"}});', $head);
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testUnknownEnvValueLeavesHeadUnchanged(): void
    {
        define('FRAK_ENV', 'staging');

        $this->assertSame(self::PRODUCTION_HEAD, FrakFrontend::head());
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testMerchantDomainAddsTheNormalisedDomain(): void
    {
        define('FRAK_MERCHANT_DOMAIN', 'WWW.Frak-Dev-08.myshopify.com');

        $head = FrakFrontend::head();

        $this->assertStringContainsString(
            'logoUrl:"https://shop.example/logo.png"},domain:"frak-dev-08.myshopify.com"}});',
            $head
        );
        $this->assertStringNotContainsString('env:', $head);
        $this->assertStringContainsString('https://sdk.frak.id/components.js', $head);
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testDevAndDomainCombine(): void
    {
        define('FRAK_ENV', 'dev');
        define('FRAK_MERCHANT_DOMAIN', 'frak-dev-08.myshopify.com');

        $this->assertStringContainsString(
            '},env:"dev",domain:"frak-dev-08.myshopify.com"}});',
            FrakFrontend::head()
        );
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testDomainIsNeverEmittedRaw(): void
    {
        define('FRAK_MERCHANT_DOMAIN', '</script><script>alert(1)</script>');

        $head = FrakFrontend::head();

        $this->assertSame(1, substr_count($head, '<script>window.FrakSetup'));
        $this->assertStringContainsString('domain:"\u003C/script\u003E\u003Cscript\u003Ealert(1)\u003C/script\u003E"', $head);
        $this->assertStringNotContainsString('alert(1)</script>', $head);
    }

    public function testShopHostIsNotEmittedAsDomain(): void
    {
        Tools::$shopDomain = 'shop.example.com';

        $this->assertStringNotContainsString('domain:', FrakFrontend::head());
    }
}
