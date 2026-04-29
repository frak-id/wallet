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
 * **Concurrency lock:** acquired via Symfony Lock ({@see FrakInfra::lockFactory()})
 * with a 5-minute TTL. If a previous tick is still running (slow backend +
 * multiple rows can push a tick beyond the 5-min cron interval), the new
 * tick early-returns instead of double-sending rows whose state hasn't
 * been updated yet. The backend is idempotent on
 * `(merchantId, externalId, status)` so concurrent retries are harmless,
 * but skipping the duplicate work saves HTTP attempts and log noise.
 *
 * **Parallel dispatch:** the drainer dispatches every due row in parallel
 * via {@see FrakWebhookHelper::sendBatch()}. A sequential drain would pay
 * N × (connect + TLS + request) latency — 25 rows × ~2 s = ~50 s per
 * tick on a slow backend, which can overlap with the next 5-min tick.
 * Symfony HttpClient's `stream()` collapses this to ~one round-trip
 * window, fitting well inside the cron interval.
 *
 * Logging goes through {@see FrakLogger} so per-row entries write to a
 * file at request shutdown instead of `ps_log`. Errors still escalate to
 * `PrestaShopLogger` so they remain visible in the admin UI.
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

    /** Lock key used by {@see FrakInfra::lockFactory()} to gate concurrent runs. */
    public const LOCK_KEY = 'cron.webhook_drainer';

    /**
     * Lock TTL — 5 minutes. Long enough to absorb a slow batch
     * (BATCH_SIZE × REQUEST_TIMEOUT in the worst case) without releasing
     * to a duplicate run, short enough that a crashed cron doesn't wedge
     * the queue for hours. Symfony Lock auto-expires the row after this
     * window via the `DoctrineDbalStore` GC sweep.
     */
    public const LOCK_TTL = 300;

    /**
     * @return array{processed:int,success:int,failure:int,skipped?:bool}
     */
    public static function run(): array
    {
        $stats = ['processed' => 0, 'success' => 0, 'failure' => 0];

        $lock = FrakInfra::lockFactory()->createLock(self::LOCK_KEY, self::LOCK_TTL);
        if (!$lock->acquire()) {
            FrakLogger::warning('cron drainer skipped — previous tick still running');
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
                    FrakLogger::info(
                        'cron drained queue row ' . $id . ' (order ' . $order_id
                        . ') after attempt ' . $next_attempt
                    );
                    continue;
                }

                $error = is_array($result) && isset($result['error'])
                    ? (string) $result['error']
                    : 'Unknown error';
                FrakWebhookQueue::markFailure($id, $next_attempt, $error);
                $stats['failure']++;

                $is_final = $next_attempt >= FrakWebhookQueue::MAX_ATTEMPTS;
                $level = $is_final ? FrakLogLevel::Error : FrakLogLevel::Warning;
                FrakLogger::log(
                    'cron retry ' . $next_attempt . '/' . FrakWebhookQueue::MAX_ATTEMPTS
                    . ' failed for queue row ' . $id . ' (order ' . $order_id . '): ' . $error
                    . ($is_final ? ' [PARKED]' : ''),
                    $level
                );
            }

            return $stats;
        } finally {
            $lock->release();
            // Opportunistic GC of the Cache + Lock tables — once per cron
            // tick. Centralised on {@see FrakInfra::housekeeping()} so the
            // Lock-store-`prune`-availability guard lives next to the Lock
            // store factory, not at the cron call site.
            FrakInfra::housekeeping();
            // Force-flush so the cron log shows up immediately even when
            // the front controller bails before PHP's natural shutdown.
            FrakLogger::flush();
        }
    }
}
