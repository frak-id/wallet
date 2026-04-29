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
 * Why PrestaShop's native `\Db::getInstance()` (post-DIY refactor):
 *   - The webhook queue is a small surface (5 small CRUD methods + a
 *     stats aggregation), so the parameterised-query advantage Doctrine
 *     DBAL gave us doesn't justify the 1.9 MB vendor cost on the merchant
 *     install. PrestaShop's `Db` class wraps the same PDO/mysqli handle
 *     PrestaShop already uses, so the per-request connection count stays
 *     at PS's native one.
 *   - All free-form strings (`status`, `last_error`) go through `pSQL()`
 *     to keep the SQL injection surface zero. Numeric columns
 *     (`id_order`, `attempts`) are cast to `int` at the boundary.
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
     * Enqueue a failed delivery for retry. The row starts in `pending` state
     * with `next_retry_at = NOW() + BACKOFF_SECONDS[0]` so the cron drainer
     * picks it up after the first backoff window — the synchronous call from
     * the hook already counts as one attempt.
     *
     * The opaque webhook token is NOT stored on the row — the cron drainer
     * derives it from the loaded `Order` via
     * {@see FrakOrderResolver::getWebhookPayload()} so the source-of-truth
     * for the token shape lives in one resolver.
     *
     * @param int    $order_id Source PrestaShop order id (idempotency anchor).
     * @param string $status   Mapped Frak status: pending|confirmed|cancelled|refunded.
     * @param string $error    The error message that triggered the enqueue. Stored
     *                         so the cron drainer's first attempt has a paper
     *                         trail even if the retry succeeds.
     */
    public static function enqueue(int $order_id, string $status, string $error = ''): bool
    {
        return (bool) Db::getInstance()->insert(self::TABLE, [
            'id_order' => (int) $order_id,
            'status' => pSQL($status),
            'attempts' => 0,
            'next_retry_at' => pSQL(date('Y-m-d H:i:s', time() + self::BACKOFF_SECONDS[0])),
            // html_ok=true: pSQL would otherwise call htmlentitiesUTF8()
            // which mangles error strings containing `<`, `>`, `&`. We
            // only need backslash + apostrophe escaping for SQL safety,
            // which html_ok=true still does.
            'last_error' => pSQL(self::truncateError($error), true),
            'state' => pSQL(FrakWebhookState::Pending->value),
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
        $sql = 'SELECT * FROM `' . _DB_PREFIX_ . self::TABLE . '`'
            . " WHERE `state` = '" . pSQL(FrakWebhookState::Pending->value) . "'"
            . ' AND `next_retry_at` <= NOW()'
            . ' AND `attempts` < ' . (int) self::MAX_ATTEMPTS
            . ' ORDER BY `next_retry_at` ASC'
            . ' LIMIT ' . max(1, (int) $limit);

        $rows = Db::getInstance()->executeS($sql);
        return is_array($rows) ? $rows : [];
    }

    /**
     * Transition a row to `success`. Called by the cron drainer after a 2xx.
     */
    public static function markSuccess(int $id): bool
    {
        return (bool) Db::getInstance()->update(
            self::TABLE,
            [
                'state' => pSQL(FrakWebhookState::Success->value),
                'last_error' => null,
            ],
            '`id_frak_webhook_queue` = ' . (int) $id,
            0,
            // null_values=true so `last_error => null` writes a literal NULL
            // (clears the audit trail on success) instead of the empty
            // string `''` PS Db's default flow would emit.
            true
        );
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

        return (bool) Db::getInstance()->update(
            self::TABLE,
            [
                'attempts' => (int) $attempts,
                'state' => pSQL(($is_final ? FrakWebhookState::Failed : FrakWebhookState::Pending)->value),
                'next_retry_at' => pSQL(date('Y-m-d H:i:s', time() + $delay)),
                'last_error' => pSQL(self::truncateError($error), true),
            ],
            '`id_frak_webhook_queue` = ' . (int) $id
        );
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
     * Snapshot of queue health for the admin observability panel.
     *
     * Single round-trip to MySQL via a `GROUP BY state` aggregation so the
     * admin page render stays well under the typical 50 ms front-page
     * budget even when the queue has thousands of rows. The latest-error
     * lookup is a separate small query (LIMIT 1, ordered by updated_at)
     * because we only need its timestamp + truncated message, not a full
     * table scan.
     *
     * Returns zeroes / nulls when the table is missing (the schema migrator
     * has not run yet) so the admin page still renders during a partial
     * upgrade. `Db::executeS()` returns `false` on schema errors in
     * production; in dev mode it throws `PrestaShopDatabaseException`,
     * which we catch to keep the panel renderable in both modes.
     *
     * @return array{pending:int,failed:int,success:int,oldest_pending_at:?string,last_error:?string,last_error_at:?string}
     */
    public static function stats(): array
    {
        $defaults = [
            'pending' => 0,
            'failed' => 0,
            'success' => 0,
            'oldest_pending_at' => null,
            'last_error' => null,
            'last_error_at' => null,
        ];

        $db = Db::getInstance();
        $table = _DB_PREFIX_ . self::TABLE;

        try {
            $rows = $db->executeS(
                'SELECT `state`, COUNT(*) AS `cnt`, MIN(`next_retry_at`) AS `oldest`'
                . ' FROM `' . $table . '`'
                . ' GROUP BY `state`'
            );
        } catch (PrestaShopDatabaseException $e) {
            // Table missing or other schema-level failure — return the
            // zero-state snapshot so the admin panel still renders.
            return $defaults;
        }
        if (!is_array($rows)) {
            return $defaults;
        }

        $stats = $defaults;
        foreach ($rows as $row) {
            $state = FrakWebhookState::tryFrom((string) ($row['state'] ?? ''));
            if ($state === null) {
                continue;
            }
            $count = isset($row['cnt']) ? (int) $row['cnt'] : 0;
            switch ($state) {
                case FrakWebhookState::Pending:
                    $stats['pending'] = $count;
                    $stats['oldest_pending_at'] = isset($row['oldest']) ? (string) $row['oldest'] : null;
                    break;
                case FrakWebhookState::Failed:
                    $stats['failed'] = $count;
                    break;
                case FrakWebhookState::Success:
                    $stats['success'] = $count;
                    break;
            }
        }

        // Most recent failure (parked or pending) for the admin error
        // surface. Filter on `last_error IS NOT NULL` so successful retries
        // (which clear `last_error` via `markSuccess`) are skipped.
        //
        // `Db::getRow()` automatically appends `LIMIT 1` to the SQL it
        // receives — passing one in by hand produces `… LIMIT 1 LIMIT 1`,
        // which MariaDB rejects with a syntax error. The `ORDER BY
        // updated_at DESC` is what `idx_updated` covers (see sql/install.php).
        try {
            $latest = $db->getRow(
                'SELECT `last_error`, `updated_at`'
                . ' FROM `' . $table . '`'
                . " WHERE `last_error` IS NOT NULL AND `last_error` <> ''"
                . ' ORDER BY `updated_at` DESC'
            );
        } catch (PrestaShopDatabaseException $e) {
            return $stats;
        }
        if (is_array($latest)) {
            $stats['last_error'] = isset($latest['last_error']) ? (string) $latest['last_error'] : null;
            $stats['last_error_at'] = isset($latest['updated_at']) ? (string) $latest['updated_at'] : null;
        }

        return $stats;
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
