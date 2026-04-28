<?php

/**
 * Schema teardown for the Frak module.
 *
 * Loaded from {@see FrakIntegration::uninstall()} via `include __DIR__ . '/sql/uninstall.php'`.
 * Symmetric with `sql/install.php`; the caller iterates and executes each
 * statement. Configuration row cleanup stays in `uninstall()` proper because
 * those are key-value rows, not schema.
 *
 * Idempotent (`DROP TABLE IF EXISTS`) so re-running on a partial uninstall is a no-op.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

$sql = [];

$sql['frak_webhook_queue'] = 'DROP TABLE IF EXISTS `' . _DB_PREFIX_ . 'frak_webhook_queue`';
