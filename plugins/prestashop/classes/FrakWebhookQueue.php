<?php

/**
 * Retry queue for failed order webhooks.
 *
 * The order hook (`hookActionOrderStatusPostUpdate`) attempts a synchronous
 * dispatch via `FrakWebhookHelper::send()` with tight timeouts (5 s request,
 * 3 s connect). If the attempt fails — network error, non-2xx response, or
 * any thrown `Exception` — the failure is enqueued here and a cron drainer
 * (`FrakWebhookCron`) retries with exponential backoff so the merchant's
 * order-status transaction commits in <50 ms even when the Frak backend is
 * unreachable.
 *
 * Why a custom table and not the `Configuration` table:
 *   - PrestaShop autoloads every `Configuration` row on every request
 *     (front + back office + AJAX). A retry queue stored there would bloat
 *     every page load.
 *   - We need indexed lookups by `(state, next_retry_at)` to drain
 *     efficiently from cron — `Configuration` is a key-value bag.
 *   - We need transactional state transitions (`pending → success/failed`)
 *     and a per-row attempt counter; both are awkward to model in a JSON
 *     blob.
 *
 * Backoff schedule mirrors the Magento sister plugin
 * (`plugins/magento/Model/Retry/CronRetry.php`): 5 m, 15 m, 1 h, 6 h, 24 h,
 * with `MAX_ATTEMPTS = 5`. Failures past the cap transition to `failed` and
 * stop polling — the `last_error` column captures the final error so the
 * merchant can investigate from `PrestaShopLogger` correlated with the queue
 * row.
 *
 * Idempotency: the backend dedupes by `(merchantId, externalId, status)`
 * (`/ext/merchant/{id}/webhook/custom` upsert path), so re-deliveries from
 * the cron retry are safe even if a previous attempt actually succeeded but
 * never reached our caller (e.g., the response timed out).
 */
class FrakWebhookQueue
{
    public const TABLE = 'frak_webhook_queue';
    public const STATE_PENDING = 'pending';
    public const STATE_SUCCESS = 'success';
    public const STATE_FAILED = 'failed';

    /** Maximum delivery attempts before the row is parked in `failed`. */
    public const MAX_ATTEMPTS = 5;

    /**
     * Backoff between attempts, in seconds. Index `n` is the wait BEFORE
     * attempt `n + 1` (so after the first failure we wait 5 minutes, after
     * the second 15 minutes, etc.). Mirrors Magento's schedule.
     *
     * @var int[]
     */
    public const BACKOFF_SECONDS = [300, 900, 3600, 21600, 86400];

    /**
     * Create the table. Idempotent — safe to call from `install()` and from
     * the migrator on every upgrade until `FRAK_QUEUE_VERSION` matches
     * `QUEUE_VERSION`.
     */
    public static function createTable(): bool
    {
        $sql = 'CREATE TABLE IF NOT EXISTS `' . _DB_PREFIX_ . self::TABLE . '` (
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

        return (bool) Db::getInstance()->execute($sql);
    }

    /**
     * Drop the table on uninstall. Symmetric with `createTable()`.
     */
    public static function dropTable(): bool
    {
        return (bool) Db::getInstance()->execute(
            'DROP TABLE IF EXISTS `' . _DB_PREFIX_ . self::TABLE . '`'
        );
    }

    /**
     * Enqueue a failed delivery for retry. The row starts in `pending` state
     * with `next_retry_at = NOW()` so the next cron tick picks it up.
     *
     * @param int    $order_id Source PrestaShop order id (idempotency anchor).
     * @param string $status   Mapped Frak status: pending|confirmed|cancelled|refunded.
     * @param string $token    Cart `secure_key` — preserved verbatim because the
     *                         payload builder appends `_{order_id}` at send time.
     * @param string $error    The error message that triggered the enqueue. Stored
     *                         so the cron drainer's first attempt has a paper
     *                         trail even if the retry succeeds.
     */
    public static function enqueue(int $order_id, string $status, string $token, string $error = ''): bool
    {
        return (bool) Db::getInstance()->insert(self::TABLE, [
            'id_order' => $order_id,
            'status' => pSQL($status),
            'token' => pSQL($token),
            'attempts' => 0,
            // The synchronous call from the hook already counts as one
            // attempt; the cron drainer should re-try after the first
            // backoff window (5 m) rather than retry immediately.
            'next_retry_at' => date('Y-m-d H:i:s', time() + self::BACKOFF_SECONDS[0]),
            'last_error' => pSQL(self::truncateError($error)),
            'state' => self::STATE_PENDING,
        ]);
    }

    /**
     * Fetch up to `$limit` due rows, ordered by `next_retry_at` ASC. The
     * cron drainer iterates this set and calls `markSuccess` / `markFailure`
     * per row.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function due(int $limit = 50): array
    {
        $sql = 'SELECT * FROM `' . _DB_PREFIX_ . self::TABLE . '`
            WHERE `state` = "' . pSQL(self::STATE_PENDING) . '"
              AND `next_retry_at` <= NOW()
              AND `attempts` < ' . (int) self::MAX_ATTEMPTS . '
            ORDER BY `next_retry_at` ASC
            LIMIT ' . max(1, $limit);

        $rows = Db::getInstance()->executeS($sql);
        return is_array($rows) ? $rows : [];
    }

    /**
     * Transition a row to `success`. Called by the cron drainer after a 2xx.
     */
    public static function markSuccess(int $id): bool
    {
        return (bool) Db::getInstance()->update(self::TABLE, [
            'state' => self::STATE_SUCCESS,
            'last_error' => null,
        ], '`id_frak_webhook_queue` = ' . (int) $id);
    }

    /**
     * Transition a row toward retry — or `failed` once the attempt counter
     * reaches `MAX_ATTEMPTS`. The new `next_retry_at` is `now + BACKOFF[$attempts - 1]`
     * with a clamp to the last bucket so attempt numbers above `count(BACKOFF)`
     * still resolve to a valid wait.
     *
     * @param int    $id       Queue row id.
     * @param int    $attempts The new attempt count (caller pre-increments).
     * @param string $error    Last error message for the audit trail.
     */
    public static function markFailure(int $id, int $attempts, string $error): bool
    {
        $is_final = $attempts >= self::MAX_ATTEMPTS;
        $delay = self::BACKOFF_SECONDS[min($attempts - 1, count(self::BACKOFF_SECONDS) - 1)];

        return (bool) Db::getInstance()->update(self::TABLE, [
            'attempts' => $attempts,
            'state' => $is_final ? self::STATE_FAILED : self::STATE_PENDING,
            'next_retry_at' => date('Y-m-d H:i:s', time() + $delay),
            'last_error' => pSQL(self::truncateError($error)),
        ], '`id_frak_webhook_queue` = ' . (int) $id);
    }

    /**
     * Compute the next backoff window in seconds for a given attempt
     * number. Public + static so the unit suite can pin the schedule
     * without instantiating the class. Attempt numbers above the cap clamp
     * to the last bucket — keeps the formula `now + nextBackoff(n)` valid
     * even when the caller mis-passes a value beyond `MAX_ATTEMPTS`.
     */
    public static function nextBackoffSeconds(int $attempts): int
    {
        $index = min(max($attempts - 1, 0), count(self::BACKOFF_SECONDS) - 1);
        return self::BACKOFF_SECONDS[$index];
    }

    /**
     * Truncate the error column so we never overflow MySQL's TEXT limit
     * (~65 KB) on adversarial backend responses. 8 KB is plenty for a stack
     * trace + a reasonable response body.
     */
    private static function truncateError(string $error): string
    {
        return mb_substr($error, 0, 8192);
    }
}
