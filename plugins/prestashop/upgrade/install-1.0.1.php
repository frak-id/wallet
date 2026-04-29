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
 *   2. Hooks: register every plumbing + placement hook the current
 *      architecture dispatches: `actionOrderStatusPostUpdate`,
 *      `actionFrontControllerSetMedia` (asset-pipeline integration), plus
 *      every distinct hook in `FrakPlacementRegistry::distinctHooks()` so
 *      existing installs gain the auxiliary placement surfaces (`displayTop`,
 *      `displayHome`, `displayShoppingCart`, `displayOrderDetail`).
 *   3. Schema: provision the `frak_webhook_queue` and `frak_cache` tables
 *      via `sql/install.php` (CREATE TABLE IF NOT EXISTS — safe re-entry
 *      on partial upgrades). `frak_cache` backs {@see FrakCache} and
 *      replaces the autoloaded `FRAK_MERCHANT` / negative-cache
 *      Configuration rows the resolver previously bloated `ps_configuration`
 *      with.
 *   4. Cron: generate `FRAK_CRON_TOKEN` if missing (existing tokens are
 *      preserved verbatim — rotating would break any merchant cron job
 *      already wired to the URL).
 *   5. Placements: seed every placement's enable flag in the bundled
 *      `FRAK_PLACEMENTS` Configuration row. `seedDefaults()` no-ops when
 *      the row already exists.
 *   6. Defensive sweep: any pre-1.0.1 dev shop carrying the unreleased
 *      per-placement `FRAK_PLACEMENT_*` rows has them folded into the
 *      bundled storage (preserves merchant choices) and the legacy rows
 *      deleted. Production v0.0.4 shops never had these rows, so the
 *      sweep is a no-op for them.
 *   7. Defensive sweep: any pre-1.0.1 dev shop carrying the unreleased
 *      `FRAK_MERCHANT` / `FRAK_MERCHANT_UNRESOLVED_AT` Configuration rows
 *      has them deleted — the resolver re-fetches on first miss against
 *      the new `frak_cache` backing store.
 *   8. Cleanup: wipe deprecated Configuration rows (modal i18n,
 *      share-button copy/style, floating-button toggles, webhook log
 *      ring) plus the now-obsolete `FRAK_SETTINGS_VERSION` row. The full
 *      v0.0.4 set is enumerated below; floating-button keys were missing
 *      from the legacy in-class sweep.
 *   9. Admin tab: register a `ps_tab` row for `AdminFrakIntegration` so
 *      the configuration page surfaces as a sidebar entry under "Modules"
 *      and gets wired into PrestaShop's standard Permissions panel.
 *
 * Idempotent on every step — re-running on a partial-upgrade install is a
 * no-op.
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

    // 2. Register the plumbing + placement hooks the current architecture
    //    dispatches. `registerHook()` is idempotent on `(module, hook)`, so
    //    calling it for hooks already registered (e.g. `header`,
    //    `displayProductAdditionalInfo`, `displayOrderConfirmation` on a
    //    v0.0.4 install) is a no-op.
    //
    //    `actionFrontControllerSetMedia` is the asset-pipeline hook the
    //    SDK script registers through — adding it here brings v0.0.4
    //    upgrades onto the new `registerJavascript` path without a
    //    reinstall.
    $core_hooks = [
        'header',
        'actionFrontControllerSetMedia',
        'actionOrderStatusPostUpdate',
    ];
    foreach (array_merge($core_hooks, FrakPlacementRegistry::distinctHooks()) as $hook) {
        $module->registerHook($hook);
    }

    // 3. Provision the webhook retry queue + cache tables. Idempotent —
    //    `sql/install.php` uses `CREATE TABLE IF NOT EXISTS`, so re-running
    //    on a partial upgrade is a no-op.
    $sql = [];
    include __DIR__ . '/../sql/install.php';
    foreach ($sql as $query) {
        if (!Db::getInstance()->execute($query)) {
            return false;
        }
    }

    // 3b. Defensive index addition. `CREATE TABLE IF NOT EXISTS` is a
    //     no-op on shops that already provisioned `frak_webhook_queue`
     //    from an earlier dev iteration without `idx_updated`, so we can't
    //     rely on step 3 to add the index retrospectively. Check
    //     `information_schema.statistics` and ALTER if the index is
    //     missing — keeps the admin observability panel's "latest error"
    //     lookup off a filesort regardless of which point on the upgrade
    //     timeline a shop joined.
    $index_check = 'SELECT COUNT(*) AS cnt FROM information_schema.statistics'
        . ' WHERE table_schema = DATABASE()'
        . ' AND table_name = "' . _DB_PREFIX_ . 'frak_webhook_queue"'
        . ' AND index_name = "idx_updated"';
    $row = Db::getInstance()->getRow($index_check);
    if (is_array($row) && (int) ($row['cnt'] ?? 0) === 0) {
        Db::getInstance()->execute(
            'ALTER TABLE `' . _DB_PREFIX_ . 'frak_webhook_queue`'
            . ' ADD KEY `idx_updated` (`updated_at`)'
        );
    }

    // 4. Generate the cron token if missing. Existing tokens are preserved
    //    verbatim — rotating would invalidate any cron job the merchant has
    //    already wired up against the displayed URL.
    if ((string) Configuration::get('FRAK_CRON_TOKEN') === '') {
        Configuration::updateValue('FRAK_CRON_TOKEN', bin2hex(random_bytes(32)));
    }

    // 5. Seed placement defaults into the bundled `FRAK_PLACEMENTS` row.
    //    No-ops when the row already exists (e.g. a re-run upgrade) so
    //    merchant choices on previously-stored placements survive.
    FrakPlacementRegistry::seedDefaults();

    // 6. Defensive sweep: fold any pre-1.0.1 per-placement rows into the
    //    bundled storage row. The unreleased 1.0.x iteration of this module
    //    stored placement toggles in N separate `FRAK_PLACEMENT_*` rows;
    //    1.0.1 collapses them into a single `FRAK_PLACEMENTS` JSON row to
    //    keep the autoloaded `ps_configuration` payload small. Production
    //    v0.0.4 shops never had these rows; dev shops that ran 1.0.x
    //    locally do — this sweep migrates their choices verbatim then
    //    deletes the legacy rows.
    $stored_map = FrakPlacementRegistry::loadStoredMap();
    $migrated = false;
    foreach (FrakPlacementRegistry::PLACEMENTS as $id => $placement) {
        $legacy_key = $placement['config_key'] ?? null;
        if ($legacy_key === null || !Configuration::hasKey($legacy_key)) {
            continue;
        }
        if (!array_key_exists($id, $stored_map)) {
            $row = Configuration::get($legacy_key);
            $stored_map[$id] = ($row === false || $row === null || $row === '')
                ? $placement['default']
                : (bool) $row;
            $migrated = true;
        }
        Configuration::deleteByName($legacy_key);
    }
    if ($migrated) {
        $encoded = json_encode($stored_map);
        if ($encoded === false) {
            return false;
        }
        Configuration::updateValue(FrakPlacementRegistry::STORAGE_KEY, $encoded);
    }

    // 7. Defensive sweep: drop pre-1.0.1 merchant cache Configuration
    //    rows. The resolver now reads from `frak_cache:merchant:{host}` /
    //    `frak_cache:merchant_unresolved:{host}` — a fresh `getRecord()`
    //    after the upgrade re-resolves and writes to the new backing
    //    store. Skipping the data migration is safe because merchant
    //    UUIDs are immutable per domain (no risk of a different id
    //    resolving for the same host) and the resolver pays one HTTP
    //    round-trip on the first miss. As with step 6, production v0.0.4
    //    shops never had these rows.
    Configuration::deleteByName('FRAK_MERCHANT');
    Configuration::deleteByName('FRAK_MERCHANT_UNRESOLVED_AT');

    // 8. Wipe deprecated Configuration rows. Audit baseline:
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

    // 9. Register the admin Tab. Idempotent — skips when a row already exists
    //    (e.g. on a partial upgrade re-run). Sits under Modules so the
    //    operational tooling (queue health, drain queue, refresh merchant)
    //    is one click away for daily ops, and gates per-employee access via
    //    the standard Permissions panel.
    if ((int) Tab::getIdFromClassName('AdminFrakIntegration') === 0) {
        $tab = new Tab();
        $tab->active = 1;
        $tab->class_name = 'AdminFrakIntegration';
        $tab->name = [];
        foreach (Language::getLanguages(true) as $lang) {
            $tab->name[$lang['id_lang']] = $module->l('Frak');
        }
        $tab->id_parent = (int) Tab::getIdFromClassName('AdminParentModulesSf');
        $tab->module = $module->name;
        if (!$tab->add()) {
            return false;
        }
    }

    return true;
}
