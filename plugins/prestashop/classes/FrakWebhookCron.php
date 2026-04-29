<?php

/**
 * Drain the webhook retry queue.
 *
 * Invoked by `controllers/front/cron.php` once per cron tick (the merchant
 * wires the URL printed on the admin page into `ps_cronjobs` or their
 * server cron). Pulls due rows via {@see FrakWebhookQueue::due()}, retries
 * the whole batch in PARALLEL via {@see FrakWebhookHelper::sendBatch()},
 * and updates each row's terminal state.
 *
 * Per-tick batch size is bounded so a single cron run never holds the
 * worker for an unbounded duration even if the queue is large. The cron is
 * idempotent: rows are state-machine tracked, so an aborted run resumes
 * cleanly on the next tick.
 *
 * **Concurrency lock:** acquired via MySQL `GET_LOCK` ({@see FrakLock}).
 * Session-scoped — the lock dies with the connection on PHP shutdown,
 * so a crashed drainer never wedges the queue past its TTL. If a
 * previous tick is still running (slow backend + multiple rows can push
 * a tick beyond the 5-min cron interval), the new tick early-returns
 * instead of double-sending rows whose state hasn't been updated yet.
 * The backend is idempotent on `(merchantId, externalId, status)` so
 * concurrent retries are harmless, but skipping the duplicate work saves
 * HTTP attempts and log noise.
 *
 * **Parallel dispatch:** the drainer dispatches every due row in parallel
 * via {@see FrakWebhookHelper::sendBatch()}. A sequential drain would pay
 * N × (connect + TLS + request) latency — 25 rows × ~2 s = ~50 s per
 * tick on a slow backend, which can overlap with the next 5-min tick.
 * Symfony HttpClient's `stream()` collapses this to ~one round-trip
 * window, fitting well inside the cron interval.
 *
 * Logging is intentionally sparse: only the terminal `parked` state (a row
 * that exhausted MAX_ATTEMPTS) writes to `PrestaShopLogger`. Transient
 * failures and per-tick housekeeping are queryable via the queue table
 * itself — `FrakWebhookQueue::stats()` exposes them on the admin panel.
 *
 * Mirrors `plugins/magento/Model/Retry/CronRetry.php` so the two plugins
 * share the same retry semantics.
 */
class FrakWebhookCron
{
    /**
     * Maximum rows processed per cron tick. Keeps the worker bounded; the
     * remainder is picked up on the next tick.
     */
    public const BATCH_SIZE = 25;

    /** Lock key passed to {@see FrakLock::acquire()} to gate concurrent runs. */
    public const LOCK_KEY = 'cron.webhook_drainer';

    /**
     * @return array{processed:int,success:int,failure:int,skipped?:bool}
     */
    public static function run(): array
    {
        $stats = ['processed' => 0, 'success' => 0, 'failure' => 0];

        if (!FrakLock::acquire(self::LOCK_KEY)) {
            // Previous tick still running. Operationally expected on slow
            // backends; the next tick will pick up where this one would
            // have started, so no log emitted.
            return $stats + ['skipped' => true];
        }

        try {
            $rows = FrakWebhookQueue::due(self::BATCH_SIZE);
            if (empty($rows)) {
                return $stats;
            }

            // Build the batch input map in one pass so we can dispatch
            // every entry through `sendBatch` and process the result map
            // in a second pass without re-iterating the DB rows.
            $entries = [];
            $row_index = [];
            foreach ($rows as $row) {
                $id = (int) $row['id_frak_webhook_queue'];
                $entries[] = [
                    'id' => $id,
                    'order_id' => (int) $row['id_order'],
                    'status' => (string) $row['status'],
                ];
                $row_index[$id] = $row;
            }

            $results = FrakWebhookHelper::sendBatch($entries);

            foreach ($results as $id => $result) {
                $stats['processed']++;
                $row = $row_index[$id] ?? null;
                if ($row === null) {
                    continue;
                }
                $order_id = (int) $row['id_order'];
                $next_attempt = ((int) $row['attempts']) + 1;

                if (is_array($result) && !empty($result['success'])) {
                    FrakWebhookQueue::markSuccess($id);
                    $stats['success']++;
                    continue;
                }

                $error = is_array($result) && isset($result['error'])
                    ? (string) $result['error']
                    : 'Unknown error';
                FrakWebhookQueue::markFailure($id, $next_attempt, $error);
                $stats['failure']++;

                $is_final = $next_attempt >= FrakWebhookQueue::MAX_ATTEMPTS;
                if ($is_final) {
                    // Terminal failure — the queue row is parked and will
                    // never retry on its own. Surface to PrestaShopLogger
                    // so the merchant tech sees it in Advanced Parameters
                    // → Logs and can investigate (usually a wrong webhook
                    // secret or an unresolved merchant).
                    PrestaShopLogger::addLog(
                        '[FrakSDK] Queue row ' . $id . ' (order ' . $order_id
                        . ') parked after ' . $next_attempt . '/' . FrakWebhookQueue::MAX_ATTEMPTS
                        . ' attempts: ' . $error,
                        3
                    );
                }
            }

            return $stats;
        } finally {
            FrakLock::release(self::LOCK_KEY);
            // Opportunistic GC of the cache table — once per cron tick.
            // No lock-store GC anymore: MySQL session locks auto-release
            // on connection close.
            FrakInfra::housekeeping();
        }
    }
}
