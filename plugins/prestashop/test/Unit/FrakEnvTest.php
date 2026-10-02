<?php

declare(strict_types=1);

namespace FrakLabs\PrestaShop\Test\Unit;

use FrakEnv;
use FrakUrls;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../classes/FrakEnv.php';
require_once __DIR__ . '/../../classes/FrakUrls.php';

/** Constants cannot be undefined in one process: every case that defines one runs isolated. */
final class FrakEnvTest extends TestCase
{
    public function testNeitherConstantMeansProduction(): void
    {
        $this->assertFalse(FrakEnv::isDev());
        $this->assertNull(FrakEnv::ignoredValue());
        $this->assertSame('', FrakEnv::merchantDomain());
        $this->assertSame('https://backend.frak.id', FrakUrls::backendBase());
        $this->assertSame('https://backend.frak.id/user/merchant/resolve', FrakUrls::merchantResolveUrl());
        $this->assertSame('https://backend.frak.id/ext/merchant/', FrakUrls::webhookMerchantPrefix());
        $this->assertSame('https://sdk.frak.id', FrakUrls::sdkPointerHost());
        $this->assertSame('https://sdk.frak.id/components.js', FrakUrls::sdkPointerScript());
        $this->assertSame(
            'https://cdn.jsdelivr.net/npm/@frak-labs/components@latest/cdn/components.js',
            FrakUrls::sdkFallbackScript()
        );
        $this->assertSame('https://business.frak.id', FrakUrls::dashboardOrigin());
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testDevPointsEveryOriginAtTheDevStack(): void
    {
        define('FRAK_ENV', 'dev');

        $this->assertTrue(FrakEnv::isDev());
        $this->assertNull(FrakEnv::ignoredValue());
        $this->assertSame('https://backend.gcp-dev.frak.id/user/merchant/resolve', FrakUrls::merchantResolveUrl());
        $this->assertSame('https://backend.gcp-dev.frak.id/ext/merchant/', FrakUrls::webhookMerchantPrefix());
        $this->assertSame('https://sdk-dev.frak.id', FrakUrls::sdkPointerHost());
        $this->assertSame('https://sdk-dev.frak.id/components.js', FrakUrls::sdkPointerScript());
        $this->assertSame(
            'https://cdn.jsdelivr.net/npm/@frak-labs/components@beta/cdn/components.js',
            FrakUrls::sdkFallbackScript()
        );
        $this->assertSame('https://business-dev.frak.id', FrakUrls::dashboardOrigin());
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testAnyOtherValueIsIgnoredAndReported(): void
    {
        define('FRAK_ENV', 'staging');

        $this->assertFalse(FrakEnv::isDev());
        $this->assertSame('staging', FrakEnv::ignoredValue());
        $this->assertSame('https://backend.frak.id/user/merchant/resolve', FrakUrls::merchantResolveUrl());
        $this->assertSame('https://sdk.frak.id/components.js', FrakUrls::sdkPointerScript());
        $this->assertSame('https://business.frak.id', FrakUrls::dashboardOrigin());
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testMerchantDomainIsReadVerbatim(): void
    {
        define('FRAK_MERCHANT_DOMAIN', 'WWW.Frak-Dev-08.myshopify.com');

        $this->assertSame('WWW.Frak-Dev-08.myshopify.com', FrakEnv::merchantDomain());
        $this->assertFalse(FrakEnv::isDev());
    }
}
