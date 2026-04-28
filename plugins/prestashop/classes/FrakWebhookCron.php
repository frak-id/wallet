<?php

/**
 * Drain the webhook retry queue.
 *
 * Invoked by `controllers/front/cron.php` once per cron tick (the merchant
 * wires the URL printed on the admin page into `ps_cronjobs` or their
 * server cron). Pulls due rows via `FrakWebhookQueue::due()`, retries each
 * one through `FrakWebhookHelper::send()`, and updates the row's terminal
 * state.
 *
 * Per-tick batch size is bounded so a single cron run never holds the
 * worker for an unbounded duration even if the queue is large. The cron is
 * idempotent: rows are state-machine tracked, so an aborted run resumes
 * cleanly on the next tick.
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

    /**
     * @return array{processed:int,success:int,failure:int}
     */
    public static function run(): array
    {
        $rows = FrakWebhookQueue::due(self::BATCH_SIZE);
        $stats = ['processed' => 0, 'success' => 0, 'failure' => 0];

        foreach ($rows as $row) {
            $stats['processed']++;
            $id = (int) $row['id_frak_webhook_queue'];
            $order_id = (int) $row['id_order'];
            $status = (string) $row['status'];
            $token = (string) $row['token'];
            $next_attempt = ((int) $row['attempts']) + 1;

            // Strip the trailing `_{order_id}` because `FrakWebhookHelper::buildOrderPayload()`
            // re-appends it. The token column stores the bare cart `secure_key` so the queue
            // entry stays consistent with how the original hook handler invoked send().
            $result = FrakWebhookHelper::send($order_id, $status, $token);

            if (is_array($result) && !empty($result['success'])) {
                FrakWebhookQueue::markSuccess($id);
                $stats['success']++;
                PrestaShopLogger::addLog(
                    'FrakIntegration: cron drained queue row ' . $id . ' (order ' . $order_id . ') after attempt ' . $next_attempt,
                    1
                );
                continue;
            }

            $error = is_array($result) && isset($result['error']) ? (string) $result['error'] : 'Unknown error';
            FrakWebhookQueue::markFailure($id, $next_attempt, $error);
            $stats['failure']++;

            $is_final = $next_attempt >= FrakWebhookQueue::MAX_ATTEMPTS;
            PrestaShopLogger::addLog(
                'FrakIntegration: cron retry ' . $next_attempt . '/' . FrakWebhookQueue::MAX_ATTEMPTS
                . ' failed for queue row ' . $id . ' (order ' . $order_id . '): ' . $error
                . ($is_final ? ' [PARKED]' : ''),
                $is_final ? 3 : 2
            );
        }

        return $stats;
    }
}
