<?php

/**
 * Upgrade from 1.0.2 (or any prior 1.0.x install registered the legacy
 * banner hook) to 1.0.3.
 *
 * Migrates the `banner_top` placement off `displayTop` (rendered inside
 * the classic theme's `.col-md-10` next to the desktop logo) onto
 * `displayNavFullWidth` (full-width slot below the header), so the
 * referral / in-app banner spans the viewport instead of cramming next
 * to the storefront header.
 *
 * The `banner_top` placement is the only surface that ever consumed
 * `displayTop`, so the unregister is unambiguous: no other Frak
 * placement loses its hook subscription.
 *
 * Also acts as the **convergence guard** for the v0.0.4 → 1.0.3 chain.
 * `runUpgradeModule()` runs every script between the DB version and the
 * filesystem version in ascending order, then bumps `ps_module.version`
 * to the highest one that returned `true`. If an intermediate script
 * (e.g. `install-1.0.1.php` step 9 `registerTab()`) silently returned
 * `false` for a transient reason, the merchant ends up on a version
 * mismatch — in the wild, observed as a 1.0.3-versioned install with
 * no `ps_tab` row, no admin sidebar entry, and no path to the config
 * page. As the LAST script in the chain, this file re-runs the
 * idempotent end-state writes that the prior scripts may have skipped,
 * so a healthy 1.0.3 install always converges on the same canonical
 * shape regardless of which intermediate script tripped.
 *
 * Idempotent — re-running on a partial-upgrade install is a no-op:
 * `unregisterHook()` is a no-op when the module isn't subscribed to the
 * hook, `registerHook()` is a no-op when the subscription already
 * exists, and `FrakInstaller::registerTab()` short-circuits when the
 * `ps_tab` row already exists.
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

function upgrade_module_1_0_3($module)
{
    // Drop the legacy `displayTop` subscription. Only `banner_top` ever
    // used it — the share-button / post-purchase placements live on their
    // own hooks, so this unregister doesn't strand any other surface.
    $module->unregisterHook('displayTop');

    // Subscribe to the new hook the registry now points `banner_top` at.
    // `registerHook()` is idempotent on `(module, hook)`, so a partial-
    // upgrade re-run is a no-op.
    if (!$module->registerHook('displayNavFullWidth')) {
        PrestaShopLogger::addLog('[FrakSDK] upgrade 1.0.3 registerHook(displayNavFullWidth) returned false', 3);
        // return false;
    }

    // Convergence guard. As the last script in the v0.0.4 → 1.0.3 chain,
    // re-run the idempotent end-state write that `install-1.0.1.php`
    // step 9 was supposed to perform. Self-heals shops that landed on
    // 1.0.3 with a missing `ps_tab` row from a silently-failed step 9
    // (observed in the wild: `runUpgradeModule()` does not surface
    // intermediate-script return values, so a 1.0.1 step 9 false-return
    // can flow downstream as a successful upgrade with no admin tab).
    // `registerTab()` short-circuits via `Tab::getIdFromClassName()` when
    // the row already exists, so this is free on healthy upgrades.
    if (!FrakInstaller::registerTab($module)) {
        PrestaShopLogger::addLog('[FrakSDK] upgrade 1.0.3 convergence (registerTab) returned false', 3);
        // return false;
    }

    return true;
}
