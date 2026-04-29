<?php

/**
 * Schema teardown for the Frak module.
 *
 * Loaded from {@see FrakIntegration::uninstall()} via `include __DIR__ . '/sql/uninstall.php'`.
 * Symmetric with `sql/install.php`; the caller iterates and executes each
 * statement. Configuration row cleanup stays in `uninstall()` proper because
 * those are key-value rows, not schema.
 *
 * Symmetric with `sql/install.php`: drops both the webhook queue and the
 * key/value cache table.
 *
 * Idempotent (`DROP TABLE IF EXISTS`) so re-running on a partial uninstall is a no-op.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

$sql = [];

$sql[FrakWebhookQueue::TABLE] = 'DROP TABLE IF EXISTS `' . _DB_PREFIX_ . FrakWebhookQueue::TABLE . '`';

$sql[FrakCache::TABLE] = 'DROP TABLE IF EXISTS `' . _DB_PREFIX_ . FrakCache::TABLE . '`';
