<?php

declare(strict_types=1);

namespace FrakLabs\PrestaShop\Test\Unit;

use FrakPlacementRegistry;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../classes/FrakPlacementRegistry.php';

/**
 * Cover the pure-PHP pieces of the placement registry. Anything reading from
 * `Configuration` (the `isEnabled()` / `seedDefaults()` / `clearAll()` paths)
 * is left to the integration suite because the PrestaShop runtime is not
 * bootstrapped here.
 */
final class FrakPlacementRegistryTest extends TestCase
{
    public function testEveryPlacementCarriesTheRequiredFields(): void
    {
        // Schema sanity — drift here breaks `dispatchHook()` (component) and
        // the admin template (label / description / config_key).
        foreach (FrakPlacementRegistry::PLACEMENTS as $id => $placement) {
            $this->assertIsString($id);
            $this->assertSame(
                ['component', 'hook', 'config_key', 'default', 'placement_attr', 'label', 'description'],
                array_keys($placement),
                "Placement '{$id}' is missing one or more required fields"
            );
            $this->assertContains(
                $placement['component'],
                [
                    FrakPlacementRegistry::COMPONENT_BANNER,
                    FrakPlacementRegistry::COMPONENT_SHARE_BUTTON,
                    FrakPlacementRegistry::COMPONENT_POST_PURCHASE,
                ],
                "Placement '{$id}' references an unknown component"
            );
            $this->assertStringStartsWith(
                'FRAK_PLACEMENT_',
                $placement['config_key'],
                "Placement '{$id}' uses an out-of-band config key prefix"
            );
            $this->assertIsBool($placement['default']);
            $this->assertNotSame('', $placement['placement_attr']);
            $this->assertNotSame('', $placement['hook']);
        }
    }

    public function testConfigKeysAreUnique(): void
    {
        // A duplicate `config_key` would let two placements clobber each
        // other's Configuration row, silently breaking the admin toggles.
        $keys = array_map(
            static fn (array $placement): string => $placement['config_key'],
            FrakPlacementRegistry::PLACEMENTS
        );

        $this->assertCount(count($keys), array_unique($keys));
    }

    public function testDistinctHooksDeduplicates(): void
    {
        // Multiple placements can share a hook (e.g. share button + banner
        // on the same surface). `distinctHooks()` must dedupe so the install
        // loop does not register the same hook twice.
        $hooks = FrakPlacementRegistry::distinctHooks();

        $this->assertSame($hooks, array_values(array_unique($hooks)));
        // Sanity-check the headline hooks we expect on a fresh install.
        $this->assertContains('displayProductAdditionalInfo', $hooks);
        $this->assertContains('displayOrderConfirmation', $hooks);
        $this->assertContains('displayOrderDetail', $hooks);
        $this->assertContains('displayTop', $hooks);
    }

    public function testForHookFiltersToMatchingPlacements(): void
    {
        $matched = FrakPlacementRegistry::forHook('displayProductAdditionalInfo');

        $this->assertArrayHasKey('share_product', $matched);
        // Foreign placements should not leak into the result.
        $this->assertArrayNotHasKey('banner_top', $matched);
        $this->assertArrayNotHasKey('post_purchase_confirmation', $matched);
    }

    public function testForHookReturnsEmptyForUnknownHook(): void
    {
        $this->assertSame([], FrakPlacementRegistry::forHook('displaySomethingElse'));
    }

    public function testProductAndOrderPlacementsAreOptOut(): void
    {
        // Existing module behaviour: the legacy product / order placements
        // are on by default so upgrading shops do not lose render coverage.
        $this->assertTrue(FrakPlacementRegistry::PLACEMENTS['share_product']['default']);
        $this->assertTrue(FrakPlacementRegistry::PLACEMENTS['post_purchase_confirmation']['default']);
        $this->assertTrue(FrakPlacementRegistry::PLACEMENTS['post_purchase_detail']['default']);
    }

    public function testAuxiliaryBannerSurfaceIsOptIn(): void
    {
        // The auxiliary top-banner surface is opt-in so upgrades do not
        // change the storefront until the merchant explicitly enables it.
        $this->assertFalse(FrakPlacementRegistry::PLACEMENTS['banner_top']['default']);
    }
}
