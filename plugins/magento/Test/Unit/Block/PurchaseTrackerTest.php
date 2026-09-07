<?php

declare(strict_types=1);

namespace FrakLabs\Sdk\Test\Unit\Block;

use FrakLabs\Sdk\Block\PurchaseTracker;
use FrakLabs\Sdk\Model\Config;
use Magento\Checkout\Model\Session as CheckoutSession;
use Magento\Framework\View\Element\Template\Context;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class PurchaseTrackerTest extends TestCase
{
    private Config&MockObject $config;
    private CheckoutSession&MockObject $checkoutSession;
    private Context&MockObject $context;
    private PurchaseTracker $purchaseTracker;

    protected function setUp(): void
    {
        $this->config = $this->createMock(Config::class);
        $this->checkoutSession = $this->createMock(CheckoutSession::class);
        $this->context = $this->createMock(Context::class);

        $this->purchaseTracker = new PurchaseTracker(
            $this->context,
            $this->config,
            $this->checkoutSession
        );
    }

    public function testIsEnabledDelegatesToConfig(): void
    {
        $this->config->expects(self::once())->method("isEnabled")->willReturn(true);

        self::assertTrue($this->purchaseTracker->isEnabled());
    }

    public function testGetBackendUrlReturnsTheConfiguredOrigin(): void
    {
        $this->config->method("getEnvironment")->willReturn([
            "wallet" => "https://wallet-dev.frak.id",
            "backend" => "https://backend.gcp-dev.frak.id",
        ]);

        self::assertSame(
            "https://backend.gcp-dev.frak.id",
            $this->purchaseTracker->getBackendUrl()
        );
    }

    /**
     * A half-configured store must not track against an origin the SDK was
     * never handed: the interaction token is minted against the wallet the
     * page reported, and the tracker's fetch swallows the rejection.
     */
    public function testGetBackendUrlFollowsThePairFallback(): void
    {
        $this->config->method("getEnvironment")->willReturn([
            "wallet" => Config::DEFAULT_WALLET_URL,
            "backend" => Config::DEFAULT_BACKEND_URL,
        ]);

        self::assertSame(
            Config::DEFAULT_BACKEND_URL,
            $this->purchaseTracker->getBackendUrl()
        );
    }
}
