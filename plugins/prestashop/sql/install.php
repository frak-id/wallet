<?php

/**
 * Schema bootstrap for the Frak module.
 *
 * Loaded from {@see FrakIntegration::install()} via `include __DIR__ . '/sql/install.php'`.
 * Defines the `$sql` array of `CREATE TABLE` statements; the caller iterates and
 * executes each one through `Db::getInstance()->execute()`. Convention mirrors
 * the official PrestaShop module template — keeping schema co-located here makes
 * the install lifecycle discoverable without grepping the main module class.
 *
 * Idempotent (`CREATE TABLE IF NOT EXISTS`) so re-running on a partial install
 * never throws — the upgrade flow at `upgrade/install-1.0.1.php` re-runs this
 * to provision the queue on shops upgrading from v0.0.4.
 *
 * Schema rationale (mirrored on FrakWebhookQueue):
 *   - `idx_due` (state, next_retry_at): cron drainer's hot path.
 *   - `idx_order`: dedupe lookups by source order id.
 *   - `state` ENUM matches `FrakWebhookQueue::STATE_*` constants — drift here
 *     would silently fail `markSuccess` / `markFailure` updates.
 *   - 8 KB `last_error` cap (TEXT) is enforced at the application layer
 *     ({@see FrakWebhookQueue::truncateError()}); using LONGTEXT would invite
 *     adversarial backend responses to bloat the row.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

$sql = [];

$sql['frak_webhook_queue'] = 'CREATE TABLE IF NOT EXISTS `' . _DB_PREFIX_ . 'frak_webhook_queue` (
    `id_frak_webhook_queue` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_order` INT(11) UNSIGNED NOT NULL,
    `status` VARCHAR(32) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `attempts` INT(11) UNSIGNED NOT NULL DEFAULT 0,
    `next_retry_at` DATETIME NOT NULL,
    `last_error` TEXT DEFAULT NULL,
    `state` ENUM("pending","success","failed") NOT NULL DEFAULT "pending",
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id_frak_webhook_queue`),
    KEY `idx_due` (`state`, `next_retry_at`),
    KEY `idx_order` (`id_order`)
) ENGINE=' . _MYSQL_ENGINE_ . ' DEFAULT CHARSET=utf8mb4;';
