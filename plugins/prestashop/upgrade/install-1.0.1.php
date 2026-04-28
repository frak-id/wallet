<?php

/**
 * Upgrade from any pre-1.0.1 install (effectively v0.0.4 in production —
 * v1.0.0 was tagged in the legacy `frak-id/prestashop-plugin` repo but never
 * shipped from this monorepo) to 1.0.1.
 *
 * PrestaShop auto-discovers upgrade scripts by filename: when the
 * filesystem version (`config.xml#version` propagated by `build.sh`)
 * exceeds the DB version (`ps_module.version`), every
 * `upgrade/install-X.Y.Z.php` whose version sits in the open interval
 * `(DB_version, FS_version]` runs in ascending order. Each script defines
 * `upgrade_module_X_Y_Z($module)` (dots → underscores) and returns `true`
 * on success.
 *
 * Replaces the legacy in-class `FrakIntegration::ensureSettingsMigrated()`
 * pattern (settings-version row + per-request guard from the constructor).
 * PrestaShop's native versioning is the single source of truth post-1.0.1,
 * so the homegrown `FRAK_SETTINGS_VERSION` row is purged alongside the
 * other deprecated keys at the bottom of this script.
 *
 * Migration scope (audited against tag `v0.0.4` of `frak-id/prestashop-plugin`):
 *   1. Hooks: drop the unused `displayFooter` (legacy floating-button surface)
 *      and the racy `actionOrderStatusUpdate` (replaced by post-commit
 *      `actionOrderStatusPostUpdate`).
 *   2. Hooks: register the post-commit order hook + every distinct hook
 *      in `FrakPlacementRegistry::distinctHooks()` so existing installs
 *      gain the auxiliary placement surfaces (`displayTop`, `displayHome`,
 *      `displayShoppingCart`, `displayOrderDetail`).
 *   3. Schema: provision the `frak_webhook_queue` table via `sql/install.php`
 *      (CREATE TABLE IF NOT EXISTS — safe re-entry on partial upgrades).
 *   4. Cron: generate `FRAK_CRON_TOKEN` if missing (existing tokens are
 *      preserved verbatim — rotating would break any merchant cron job
 *      already wired to the URL).
 *   5. Placements: seed every `FRAK_PLACEMENT_*` Configuration row with
 *      its declared default — `seedDefaults()` skips rows that already
 *      exist, so any merchant choices on pre-existing placements survive
 *      the upgrade.
 *   6. Cleanup: wipe deprecated Configuration rows (modal i18n, share-button
 *      copy/style, floating-button toggles, webhook log ring) plus the
 *      now-obsolete `FRAK_SETTINGS_VERSION` row. The full v0.0.4 set is
 *      enumerated below; floating-button keys were missing from the
 *      legacy in-class sweep.
 *
 * @param Module $module The FrakIntegration module instance, supplied by
 *                       PrestaShop's upgrade dispatcher.
 */
if (!defined('_PS_VERSION_')) {
    exit;
}

function upgrade_module_1_0_1($module)
{
    // 1. Drop hooks that the new architecture no longer dispatches. PrestaShop
    //    already prunes `ps_hook_module` on `parent::uninstall()` — this is
    //    only the upgrade path, so we drop them explicitly.
    //    `displayFooter` was the legacy floating-button surface (removed).
    //    `actionOrderStatusUpdate` raced under multistore / high load —
    //    superseded by the post-commit variant, see `frakintegration.php`.
    $module->unregisterHook('displayFooter');
    $module->unregisterHook('actionOrderStatusUpdate');

    // 2. Register the post-commit order hook + every distinct hook required
    //    by the placement registry. `registerHook()` is idempotent on
    //    `(module, hook)`, so calling it for hooks already registered (e.g.
    //    `header`, `displayProductAdditionalInfo`, `displayOrderConfirmation`
    //    on a v0.0.4 install) is a no-op.
    $module->registerHook('actionOrderStatusPostUpdate');
    foreach (FrakPlacementRegistry::distinctHooks() as $hook) {
        $module->registerHook($hook);
    }

    // 3. Provision the webhook retry queue table. Idempotent — `sql/install.php`
    //    uses `CREATE TABLE IF NOT EXISTS`, so re-running on a partial upgrade
    //    is a no-op.
    include __DIR__ . '/../sql/install.php';
    foreach ($sql as $query) {
        if (!Db::getInstance()->execute($query)) {
            return false;
        }
    }

    // 4. Generate the cron token if missing. Existing tokens are preserved
    //    verbatim — rotating would invalidate any cron job the merchant has
    //    already wired up against the displayed URL.
    if ((string) Configuration::get('FRAK_CRON_TOKEN') === '') {
        Configuration::updateValue('FRAK_CRON_TOKEN', bin2hex(random_bytes(32)));
    }

    // 5. Seed placement defaults. `seedDefaults()` checks `Configuration::hasKey()`
    //    per row, so any merchant choices already present survive the upgrade.
    FrakPlacementRegistry::seedDefaults();

    // 6. Wipe deprecated Configuration rows. Audit baseline:
    //    `https://github.com/frak-id/prestashop-plugin/blob/v0.0.4/frakintegration.php`
    //    (uninstall path enumerates every legacy key the module ever wrote).
    //    `FRAK_SETTINGS_VERSION` is purged here — PrestaShop's native
    //    `ps_module.version` replaces the homegrown bookkeeping post-1.0.1.
    $deprecated = [
        // Modal i18n / language — now backend-driven via business.frak.id.
        'FRAK_MODAL_LNG',
        'FRAK_MODAL_I18N',
        // Floating-button surface — removed entirely (the share-button on
        // product pages is the replacement). Missing from the legacy in-class
        // sweep, so v0.0.4 upgrades carry these forever without this script.
        'FRAK_FLOATING_BUTTON_ENABLED',
        'FRAK_FLOATING_BUTTON_POSITION',
        // Per-merchant share-button copy / style — now resolved by the SDK
        // against the business dashboard's placement config.
        'FRAK_SHARING_BUTTON_ENABLED',
        'FRAK_SHARING_BUTTON_TEXT',
        'FRAK_SHARING_BUTTON_STYLE',
        'FRAK_SHARING_BUTTON_CUSTOM_STYLE',
        // Configuration-backed log ring — replaced by PrestaShopLogger entries.
        'FRAK_WEBHOOK_LOGS',
        // Homegrown settings-version row — superseded by ps_module.version.
        'FRAK_SETTINGS_VERSION',
    ];
    foreach ($deprecated as $key) {
        Configuration::deleteByName($key);
    }

    return true;
}
