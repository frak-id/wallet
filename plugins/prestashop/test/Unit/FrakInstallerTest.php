<?php

declare(strict_types=1);

/*
 * Regression coverage for the front-office hook wipe that took every legacy
 * (`frak-id/prestashop-plugin` v1.0.0) → 1.0.4+ upgrade offline:
 * `FrakInstaller::cleanLeftovers($module, ['keep_module_row' => true])` used
 * to delete every `ps_hook_module` row, and the upgrade scripts only put the
 * admin tab + access roles back — never the front-office / webhook hooks — so
 * the SDK `<script>` and purchase webhooks silently vanished while the module
 * still reported installed + enabled.
 *
 * The PrestaShop doubles (see `doubles.php`) record every executed SQL string
 * so the test can assert WHICH deletes run for a given `keep_module_row`
 * option without a real PrestaShop + MySQL behind it.
 */

namespace FrakLabs\PrestaShop\Test\Unit;

use CMS;
use Configuration;
use FrakAmbassadorPage;
use FrakConfig;
use FrakInstaller;
use FrakTestDbRecorder;
use Language;
use Module;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/doubles.php';
require_once __DIR__ . '/../../classes/FrakPlacementRegistry.php';
require_once __DIR__ . '/../../classes/FrakConfig.php';
require_once __DIR__ . '/../../classes/FrakInstaller.php';
require_once __DIR__ . '/../../classes/FrakAmbassadorPage.php';

final class FrakInstallerTest extends TestCase
{
    protected function setUp(): void
    {
        frak_test_reset_doubles();
    }

    public function testCleanLeftoversKeepsHooksOnUpgradePath(): void
    {
        // The exact call the convergence guard makes
        // (`upgrade/install-1.0.4.php` line 77). `keep_module_row=true`
        // means "this is a live module being healed" — its hook
        // subscriptions MUST survive, because the upgrade scripts do not
        // re-register the front-office hooks after the scrub.
        FrakInstaller::cleanLeftovers(new Module(), ['keep_module_row' => true]);

        $executedSql = implode("\n", FrakTestDbRecorder::$executed);

        // cleanLeftovers still scrubs the tab + auth-role orphans on the
        // upgrade path, so it must have run *some* SQL — guard against a
        // vacuous pass if the method ever short-circuits entirely.
        $this->assertNotSame('', $executedSql, 'cleanLeftovers should still scrub orphan rows on the upgrade path');

        // ...but it must NOT touch hook_module: that is the regression.
        $this->assertStringNotContainsStringIgnoringCase(
            'hook_module',
            $executedSql,
            'cleanLeftovers(keep_module_row=true) must NOT delete hook_module rows — '
            . 'wiping them without a re-register silently strips SDK injection + webhooks'
        );
    }

    public function testCleanLeftoversStillScrubsHooksOnFullCleanup(): void
    {
        // The install / uninstall paths pass keep_module_row=false. There
        // the hook_module scrub is intended: install re-registers right
        // after, uninstall wants every row gone. Pin it so the upgrade-path
        // gate above is not "fixed" by simply deleting the scrub wholesale.
        FrakInstaller::cleanLeftovers(new Module());

        $executedSql = implode("\n", FrakTestDbRecorder::$executed);

        $this->assertStringContainsStringIgnoringCase(
            'hook_module',
            $executedSql,
            'cleanLeftovers(keep_module_row=false) must still scrub hook_module on install/uninstall'
        );
    }

    public function testUninstallDeactivatesTheCreatedPageKeepsItsIdAndDropsTheFlag(): void
    {
        $id = $this->createdPage();
        FrakConfig::setAmbassadorHiddenByDisable();

        $this->assertTrue(FrakInstaller::uninstall(new Module()));

        $this->assertFalse(CMS::$rows[$id]['active']);
        $this->assertSame($id, FrakConfig::getAmbassadorPageId());
        $this->assertFalse(Configuration::hasKey(FrakConfig::AMBASSADOR_HIDDEN_BY_DISABLE));
    }

    public function testFullCleanupKeepsThePageIdAndDropsTheFlag(): void
    {
        $id = $this->createdPage();
        FrakConfig::setAmbassadorHiddenByDisable();

        FrakInstaller::cleanLeftovers(new Module());

        $this->assertSame($id, FrakConfig::getAmbassadorPageId());
        $this->assertFalse(Configuration::hasKey(FrakConfig::AMBASSADOR_HIDDEN_BY_DISABLE));
    }

    public function testUpgradeCleanupKeepsThePageIdAndTheFlag(): void
    {
        $id = $this->createdPage();
        FrakConfig::setAmbassadorHiddenByDisable();

        FrakInstaller::cleanLeftovers(new Module(), ['keep_module_row' => true]);

        $this->assertSame($id, FrakConfig::getAmbassadorPageId());
        $this->assertTrue(FrakConfig::isAmbassadorHiddenByDisable());
    }

    private function createdPage(): int
    {
        Language::$languages = [['id_lang' => 1, 'iso_code' => 'en']];
        FrakAmbassadorPage::ensure();

        return FrakConfig::getAmbassadorPageId();
    }

    public function testAllHooksCoversEveryFrontOfficeAndPlumbingHook(): void
    {
        // `allHooks()` is the single source of truth the fresh-install path
        // and the `install-1.0.8.php` healing script both register from.
        // A hook silently dropping out of this set is exactly how the SDK
        // stops loading, so pin every surface the module depends on.
        $hooks = FrakInstaller::allHooks();

        $required = [
            // Always-on plumbing.
            'header',
            'actionFrontControllerSetMedia',
            'actionOrderStatusPostUpdate',
            'actionOrderSlipAdd',
            'actionCronJob',
            'filterCmsContent',
            // Placement-driven display surfaces.
            'displayProductAdditionalInfo',
            'displayNavFullWidth',
            'displayOrderConfirmation',
            'displayOrderDetail',
        ];

        foreach ($required as $hook) {
            $this->assertContains($hook, $hooks, "allHooks() must include '{$hook}'");
        }

        // No duplicates — registerHook() is idempotent, but a dupe here
        // would signal CORE_HOOKS / placement-registry drift.
        $this->assertSame(array_values(array_unique($hooks)), array_values($hooks));
    }
}
