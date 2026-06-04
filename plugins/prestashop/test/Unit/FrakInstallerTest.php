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
 * This file carries two bracketed namespaces: a global block defining the
 * thinnest PrestaShop runtime doubles `cleanLeftovers()` reaches for
 * (Db::getInstance()->execute(), Cache::clean(), Configuration::deleteByName(),
 * pSQL(), _DB_PREFIX_), and the test namespace. The doubles record every
 * executed SQL string so the test can assert WHICH deletes run for a given
 * `keep_module_row` option without a real PrestaShop + MySQL behind it. All
 * doubles are guarded so the suite stays safe if a future test (or a real PS
 * bootstrap) already provides these globals.
 */

namespace {
    if (!defined('_DB_PREFIX_')) {
        define('_DB_PREFIX_', 'ps_');
    }

    if (!function_exists('pSQL')) {
        function pSQL($value, $html_ok = false)
        {
            return is_string($value) ? $value : (string) $value;
        }
    }

    if (!class_exists('FrakTestDbRecorder')) {
        class FrakTestDbRecorder
        {
            /** @var string[] */
            public static array $executed = [];

            public static function reset(): void
            {
                self::$executed = [];
            }

            /** @return true */
            public function execute($sql)
            {
                self::$executed[] = (string) $sql;

                return true;
            }

            /** @return int */
            public function getValue($sql)
            {
                return 0;
            }

            /** @return array{cnt: int} */
            public function getRow($sql)
            {
                return ['cnt' => 0];
            }
        }
    }

    if (!class_exists('Db')) {
        class Db
        {
            public static function getInstance()
            {
                return new \FrakTestDbRecorder();
            }
        }
    }

    if (!class_exists('Cache')) {
        class Cache
        {
            /** @return true */
            public static function clean($pattern)
            {
                return true;
            }
        }
    }

    if (!class_exists('Configuration')) {
        class Configuration
        {
            /** @return true */
            public static function deleteByName($key)
            {
                return true;
            }

            /** @return false */
            public static function get($key)
            {
                return false;
            }

            /** @return false */
            public static function hasKey($key)
            {
                return false;
            }

            /** @return true */
            public static function updateValue($key, $value)
            {
                return true;
            }
        }
    }

    if (!class_exists('Module')) {
        class Module
        {
            public string $name = 'frakintegration';

            public int $active = 1;
        }
    }
}

namespace FrakLabs\PrestaShop\Test\Unit {

    use FrakInstaller;
    use FrakTestDbRecorder;
    use Module;
    use PHPUnit\Framework\TestCase;

    require_once __DIR__ . '/../../classes/FrakPlacementRegistry.php';
    require_once __DIR__ . '/../../classes/FrakConfig.php';
    require_once __DIR__ . '/../../classes/FrakInstaller.php';

    final class FrakInstallerTest extends TestCase
    {
        protected function setUp(): void
        {
            FrakTestDbRecorder::reset();
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
}
