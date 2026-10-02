<?php

declare(strict_types=1);

namespace FrakLabs\PrestaShop\Test\Unit;

use FrakInfra;
use FrakMerchantResolver;
use FrakTestDbRecorder;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use PHPUnit\Framework\TestCase;
use Tools;

require_once __DIR__ . '/doubles.php';
require_once __DIR__ . '/../../classes/FrakEnv.php';
require_once __DIR__ . '/../../classes/FrakUrls.php';
require_once __DIR__ . '/../../classes/FrakUtils.php';
require_once __DIR__ . '/../../classes/FrakCache.php';
require_once __DIR__ . '/../../classes/FrakHttpClient.php';
require_once __DIR__ . '/../../classes/FrakMerchantResolver.php';

final class FrakMerchantResolverTest extends TestCase
{
    private const PROD_RECORD = '{"id":"prod-id","name":"Prod","domain":"shop.example.com","resolved_at":1}';
    private const DEV_RECORD = '{"id":"dev-id","name":"Dev","domain":"shop.example.com","resolved_at":1}';

    protected function setUp(): void
    {
        frak_test_reset_doubles();
        FrakInfra::resetAll();
    }

    public function testProductionKeysAreUnchanged(): void
    {
        FrakMerchantResolver::invalidate();

        $this->assertSame(
            ['merchant.shop_example_com', 'merchant_unresolved.shop_example_com'],
            FrakTestDbRecorder::$deletedCacheKeys
        );
    }

    public function testProductionReadsItsCachedRecord(): void
    {
        FrakTestDbRecorder::$cacheRows['merchant.shop_example_com'] = self::PROD_RECORD;

        $this->assertSame('prod-id', FrakMerchantResolver::getId());
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testDevUsesKeysThatDifferFromProduction(): void
    {
        define('FRAK_ENV', 'dev');

        FrakMerchantResolver::invalidate();

        $keys = FrakTestDbRecorder::$deletedCacheKeys;
        $this->assertCount(2, $keys);
        $this->assertNotContains('merchant.shop_example_com', $keys);
        $this->assertNotContains('merchant_unresolved.shop_example_com', $keys);
        $this->assertStringContainsString('shop_example_com', $keys[0]);
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testDevNeverReadsTheProductionRecord(): void
    {
        define('FRAK_ENV', 'dev');
        FrakTestDbRecorder::$cacheRows['merchant.shop_example_com'] = self::PROD_RECORD;
        FrakTestDbRecorder::$cacheRows['dev_merchant_unresolved.shop_example_com'] = 'true';

        $this->assertNull(FrakMerchantResolver::getId());
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testDevReadsItsOwnRecord(): void
    {
        define('FRAK_ENV', 'dev');
        FrakTestDbRecorder::$cacheRows['merchant.shop_example_com'] = self::PROD_RECORD;
        FrakTestDbRecorder::$cacheRows['dev_merchant.shop_example_com'] = self::DEV_RECORD;

        $this->assertSame('dev-id', FrakMerchantResolver::getId());
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testMerchantDomainOverrideDrivesTheLookupHost(): void
    {
        define('FRAK_MERCHANT_DOMAIN', 'WWW.Frak-Dev-08.myshopify.com');
        Tools::$shopDomain = 'shop.example.com';

        $this->assertSame('frak-dev-08.myshopify.com', FrakMerchantResolver::currentHost());
    }
}
