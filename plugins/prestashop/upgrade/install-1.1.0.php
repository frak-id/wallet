<?php

/**
 * Upgrade to 1.1.0 — subscribe existing installs to `filterCmsContent`.
 *
 * The hook swaps `{frak_*}` markers in CMS pages for their component. Shops
 * upgraded from 1.0.x never ran `install()`, so without this pass they would
 * show the markers as text with no error. PrestaShop only runs this script
 * when `ps_module.version` is below 1.1.0 and the release is 1.1.0 or later.
 *
 * Only the new hook is registered. Re-registering the whole set throws on
 * `header`: core checks it through its `displayHeader` alias, misses the
 * existing row and inserts a duplicate (Hook::registerHook, PS 8.2).
 *
 * @param Module $module The FrakIntegration module instance, supplied by
 *                       PrestaShop's upgrade dispatcher.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

function upgrade_module_1_1_0($module)
{
    // CRITICAL: never `return false` — PrestaShop disables the module on a
    // false return (see `upgrade/install-1.0.1.php`). Log and return true.
    try {
        if (!$module->registerHook('filterCmsContent')) {
            PrestaShopLogger::addLog('[FrakSDK] upgrade 1.1.0 registerHook(filterCmsContent) returned false', 3);
        }
    } catch (\Throwable $e) {
        PrestaShopLogger::addLog('[FrakSDK] upgrade 1.1.0 registerHook(filterCmsContent) failed: ' . $e->getMessage(), 3);
    }

    return true;
}
