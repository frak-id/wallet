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
        // the admin template (label / description / config_key). The optional
        // `options` schema is exercised separately so this test stays readable
        // when the option set grows.
        $required = ['component', 'hook', 'config_key', 'default', 'placement_attr', 'label', 'description'];
        foreach (FrakPlacementRegistry::PLACEMENTS as $id => $placement) {
            $this->assertIsString($id);
            foreach ($required as $field) {
                $this->assertArrayHasKey(
                    $field,
                    $placement,
                    "Placement '{$id}' is missing required field '{$field}'"
                );
            }
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

    public function testPlacementOptionSchemasAreInternallyConsistent(): void
    {
        // Per-option schema sanity. Drift here breaks the admin form renderer
        // (`buildPlacementOptionInputs` reads `type` / `label` / `default`)
        // AND the writer (`sanitizeOptionUpdates` keys off `type` and the
        // shape of the matching meta). Walking every declared option keeps
        // future additions honest without a per-option assertion.
        $allowed_types = [
            FrakPlacementRegistry::OPTION_TYPE_SELECT,
            FrakPlacementRegistry::OPTION_TYPE_TEXT,
        ];

        foreach (FrakPlacementRegistry::PLACEMENTS as $id => $placement) {
            $options = $placement['options'] ?? [];
            if ($options === []) {
                continue;
            }
            foreach ($options as $key => $meta) {
                $this->assertIsString($key, "Placement '{$id}' option key must be a string");
                $this->assertNotSame('', $key, "Placement '{$id}' has an empty option key");
                $this->assertIsArray($meta, "Placement '{$id}' option '{$key}' meta must be an array");

                $this->assertArrayHasKey('type', $meta, "Option '{$id}.{$key}' is missing 'type'");
                $this->assertContains($meta['type'], $allowed_types, "Option '{$id}.{$key}' has unknown type");
                $this->assertArrayHasKey('label', $meta, "Option '{$id}.{$key}' is missing 'label'");
                $this->assertArrayHasKey('default', $meta, "Option '{$id}.{$key}' is missing 'default'");

                if ($meta['type'] === FrakPlacementRegistry::OPTION_TYPE_SELECT) {
                    $this->assertArrayHasKey('choices', $meta, "Select option '{$id}.{$key}' is missing 'choices'");
                    $this->assertIsArray($meta['choices'], "Select option '{$id}.{$key}' choices must be a map");
                    $this->assertNotEmpty($meta['choices'], "Select option '{$id}.{$key}' must declare at least one choice");
                    $this->assertArrayHasKey(
                        $meta['default'],
                        $meta['choices'],
                        "Select option '{$id}.{$key}' default '{$meta['default']}' is not in its choices"
                    );
                }
            }
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
