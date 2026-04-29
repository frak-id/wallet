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
 * Idempotent — re-running on a partial-upgrade install is a no-op:
 * `unregisterHook()` is a no-op when the module isn't subscribed to the
 * hook, and `registerHook()` is a no-op when the subscription already
 * exists.
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
        return false;
    }

    return true;
}
