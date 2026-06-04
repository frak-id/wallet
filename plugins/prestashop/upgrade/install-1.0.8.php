<?php

/**
 * Upgrade to 1.0.8 — heal the front-office hook wipe introduced in 1.0.4.
 *
 * `upgrade/install-1.0.4.php` (the v0.0.4 → 1.0.x convergence guard) calls
 * `FrakInstaller::cleanLeftovers($module, ['keep_module_row' => true])`. Until
 * the fix that ships alongside this script, `cleanLeftovers()` step 1 deleted
 * EVERY `ps_hook_module` row for the module unconditionally, and the upgrade
 * scripts only re-registered the admin `Tab` + module-access roles afterwards
 * — never the front-office hooks. So the bump to 1.0.4 stripped `header`,
 * `actionFrontControllerSetMedia`, every `display*` placement, AND the
 * server-side webhook hooks (`actionOrderStatusPostUpdate`,
 * `actionOrderSlipAdd`, `actionCronJob`) and never put them back.
 *
 * Net effect on every shop that ran the legacy `frak-id/prestashop-plugin`
 * (internal version 1.0.0) and upgraded to any release in 1.0.4–1.0.7: the
 * module still shows installed + enabled with a reachable configuration page,
 * but the storefront carries ZERO Frak output — no SDK `<script>`, no
 * `window.FrakSetup`, no purchase webhooks. SDK analytics + purchase
 * attribution go silent the instant the upgrade runs, with no error surfaced
 * anywhere the merchant would look.
 *
 * `FrakInstaller::cleanLeftovers()` now skips the `hook_module` delete when
 * `keep_module_row=true`, so no future upgrade can strip a live module's
 * hooks. But shops already broken by 1.0.4–1.0.7 sit at
 * `ps_module.version >= 1.0.4` and will NEVER re-run `install-1.0.4.php`
 * (PrestaShop only runs upgrade scripts whose version is in the open-closed
 * interval `(db_version, fs_version]`), so they cannot self-heal from the
 * `cleanLeftovers()` fix alone. This script is the healing pass: it
 * re-registers the full canonical hook set on the bump to 1.0.8.
 *
 * Idempotent: `registerHook()` is a no-op on `(module, hook)` pairs that are
 * already subscribed, so a healthy install (one that never hit the wipe, or a
 * fresh 1.0.8 that came through `install()`) passes through untouched.
 *
 * @param Module $module The FrakIntegration module instance, supplied by
 *                       PrestaShop's upgrade dispatcher.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

// Defensive class loading — see `upgrade/install-1.0.1.php` for the full
// rationale (stale Composer autoloader / OPcache bytecode after an in-place
// zip extraction can leave the prior bootstrap's class map live in memory).
// `require_once` is a no-op once the autoloader has resolved a class, so this
// is free on healthy installs.
$frak_class_files = glob(__DIR__ . '/../classes/*.php');
if (is_array($frak_class_files)) {
    foreach ($frak_class_files as $frak_class_file) {
        if (basename($frak_class_file) === 'index.php') {
            continue;
        }
        require_once $frak_class_file;
    }
}

function upgrade_module_1_0_8($module)
{
    // CRITICAL: never `return false` from this function. PrestaShop's
    // `Module::runUpgradeModule()` calls `$this->disable()` on any false
    // return, which trips `ModuleTabManagementSubscriber` to disable the
    // admin tab too — turning a recoverable hiccup into a soft-uninstall the
    // merchant can't click their way out of. See `upgrade/install-1.0.1.php`
    // for the full rationale. Every step logs failures but returns true.

    // Re-register the canonical hook set. `FrakInstaller::allHooks()` is the
    // single source of truth shared with the fresh-install path, so a hook
    // added in a future release heals here automatically. `registerHook()` is
    // idempotent on `(module, hook)`, so this is a no-op on installs that
    // still hold their subscriptions and a full repair on shops the 1.0.4
    // wipe left hookless.
    foreach (FrakInstaller::allHooks() as $hook) {
        if (!$module->registerHook($hook)) {
            PrestaShopLogger::addLog('[FrakSDK] upgrade 1.0.8 registerHook(' . $hook . ') returned false', 3);
        }
    }

    // Defensive: heal any residual `active=0` state left by a pre-1.0.4 silent
    // false-return (mirrors `install-1.0.4.php` step 4). A shop broken purely
    // by the hook wipe stays `active=1`, so this is usually a no-op — but a
    // module that also tripped an older disable path would otherwise fire no
    // hooks regardless of how many we register. `enable()` is idempotent on a
    // healthy install.
    if (!(bool) $module->active) {
        $module->enable();
    }

    return true;
}
