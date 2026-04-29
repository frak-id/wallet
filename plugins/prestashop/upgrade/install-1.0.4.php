<?php

/**
 * Upgrade to 1.0.4 — install-path defensive overhaul + module-access parity.
 *
 * 1.0.4 ships every fix from the install/upgrade hardening campaign:
 *   - `cleanLeftovers()` now scrubs orphan `authorization_role` rows that
 *     prior aborted uninstalls left behind (1062 on re-install root cause).
 *   - `registerTab()` / `unregisterTab()` bypass `Tab::getIdFromClassName()`
 *     in favour of a direct `SELECT` because the helper caches results in
 *     PrestaShop's in-process `Cache` singleton — the cached pre-DELETE id
 *     was triggering a silent no-op insert when `cleanLeftovers()` ran in
 *     the same request as `registerTab()` on the upgrade path.
 *   - This script is the convergence guard for the v0.0.4 → 1.0.4 chain.
 *     Every prior upgrade script's idempotent end-state work re-runs here
 *     so shops that landed on a broken intermediate version (notably 1.0.3
 *     with no `ps_tab` row from the cache-bug-induced silent step-9
 *     failure) self-heal on the bump to 1.0.4.
 *
 * On top of the convergence pass, this script closes the **module-level
 * authorization-role parity gap** that the upgrade path has carried since
 * 1.0.1. `parent::install()` (called only on fresh installs, NEVER on
 * upgrades) inserts 4 × `ROLE_MOD_MODULE_FRAKINTEGRATION_{CREATE,READ,
 * UPDATE,DELETE}` rows alongside the matching `module_access` rows so the
 * BO Permissions panel can expose per-action toggles for the module. The
 * upgrade path's `Tab::add()` only emits the tab-level slugs
 * (`ROLE_MOD_TAB_ADMINFRAKINTEGRATION_*`), leaving v0.0.4 → 1.0.x upgrade
 * shops without the module-level toggles. Functionally fine — the module
 * still works — but the BO surface area diverged from a fresh install.
 * {@see FrakInstaller::ensureModuleAccessRoles()} replicates PS core's
 * `Module::install()` role-insert logic exactly (see PS 8.2.6
 * `classes/module/Module.php:463-479`) with `INSERT IGNORE` for
 * idempotency, so this restores byte-for-byte parity on every shop that
 * runs through the upgrade path.
 *
 * Idempotent — re-running on a partial-upgrade install is a no-op:
 *   - `cleanLeftovers()` deletes rows that don't exist (no-op).
 *   - `registerTab()` short-circuits when the row already exists.
 *   - `ensureModuleAccessRoles()` uses `INSERT IGNORE` on both tables.
 *
 * @param Module $module The FrakIntegration module instance, supplied by
 *                       PrestaShop's upgrade dispatcher.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

// Defensive class loading — see `upgrade/install-1.0.1.php` for the full
// rationale (autoloader stale after in-place zip extraction). Cheap on
// healthy installs; required to survive PS Module Manager's "probe before
// upgrade" path on shops with `opcache.validate_timestamps=0`.
$frak_class_files = glob(__DIR__ . '/../classes/*.php');
if (is_array($frak_class_files)) {
    foreach ($frak_class_files as $frak_class_file) {
        if (basename($frak_class_file) === 'index.php') {
            continue;
        }
        require_once $frak_class_file;
    }
}

function upgrade_module_1_0_4($module)
{
    // CRITICAL: never `return false` from this function. PrestaShop's
    // `Module::runUpgradeModule()` calls `$this->disable()` on any false
    // return, which trips `ModuleTabManagementSubscriber` to disable the
    // admin tab too. See `upgrade/install-1.0.1.php` for the full rationale.

    // 1. Defensive scrub of orphan rows from any prior aborted uninstall
    //    AND any prior upgrade script that ran with the cached-Tab-id bug
    //    (pre-1.0.4 installs would have completed without inserting the
    //    tab + tab-level roles even though `registerTab()` returned true).
    //    `keep_module_row=true` is critical: deleting `ps_module.id_module`
    //    mid-upgrade detaches the module from `runUpgradeModule()`'s
    //    controller and breaks the rest of this script.
    FrakInstaller::cleanLeftovers($module, ['keep_module_row' => true]);

    // 2. (Re-)create the admin tab + tab-level authorization roles. With
    //    the cache bypass landed in `registerTab()`, the same-request
    //    sequence `cleanLeftovers()` → `registerTab()` now actually
    //    inserts the row instead of short-circuiting on a stale cached id.
    //    Idempotent — short-circuits when the `ps_tab` row already exists.
    if (!FrakInstaller::registerTab($module)) {
        PrestaShopLogger::addLog('[FrakSDK] upgrade 1.0.4 step 2 (registerTab) returned false', 3);
    }

    // 3. Restore module-level access roles to match a fresh `parent::install()`.
    //    Closes the BO Permissions parity gap that every v0.0.4 → 1.0.x
    //    upgrade path has carried since 1.0.1. Idempotent via `INSERT IGNORE`
    //    on both `authorization_role.slug` (UNIQUE) and
    //    `module_access.(id_profile, id_authorization_role)` (composite PK).
    if (!FrakInstaller::ensureModuleAccessRoles($module)) {
        PrestaShopLogger::addLog('[FrakSDK] upgrade 1.0.4 step 3 (ensureModuleAccessRoles) returned false', 3);
    }

    // 4. Heal residual `active=0` state from any prior upgrade script that
    //    silently returned false in a pre-1.0.4 release. `runUpgradeModule()`
    //    calls `$this->disable()` on a false return but never re-enables on
    //    a successful subsequent upgrade — so a merchant who hit a return
    //    false on 1.0.1 step 9 (the original cache-bug-induced silent
    //    failure) ends up at 1.0.0 with active=0 and no path to recover
    //    short of uninstall/reinstall. As the latest script in the chain,
    //    this is the canonical place to flip the bit back. `enable()` is
    //    idempotent on healthy installs (already active=1).
    if (!(bool) $module->active) {
        $module->enable();
    }

    return true;
}
