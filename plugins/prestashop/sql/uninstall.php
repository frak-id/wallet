<?php

/**
 * Schema teardown for the Frak module.
 *
 * Loaded from {@see FrakIntegration::uninstall()} via `include __DIR__ . '/sql/uninstall.php'`.
 * Symmetric with `sql/install.php`; the caller iterates and executes each
 * statement. Configuration row cleanup stays in `uninstall()` proper because
 * those are key-value rows, not schema.
 *
 * Cache + Lock tables (`frak_cache_items`, `frak_lock_keys`) are dropped via
 * {@see FrakInfra::dropInfrastructureTables()} from `uninstall()` — kept out of
 * this file because the table names are owned by the Symfony adapters that
 * created them, not by this manifest.
 *
 * Idempotent (`DROP TABLE IF EXISTS`) so re-running on a partial uninstall is a no-op.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

$sql = [];

$sql[FrakWebhookQueue::TABLE] = 'DROP TABLE IF EXISTS `' . _DB_PREFIX_ . FrakWebhookQueue::TABLE . '`';
