<?php

/**
 * Lifecycle state of a {@see FrakWebhookQueue} row.
 *
 * Backed string enum mirroring the SQL `ENUM("pending","success","failed")`
 * column on `frak_webhook_queue.state`. Drift between the PHP and MySQL
 * representations would silently fail `markSuccess` / `markFailure`
 * updates — keeping the values pinned in a single typed surface
 * structurally precludes that.
 *
 * `Pending` rows are picked up by {@see FrakWebhookCron::run()} once
 * `next_retry_at <= NOW()`. `Success` is terminal. `Failed` is terminal
 * after `MAX_ATTEMPTS` retries — the row stays in the table for
 * audit + observability via the admin queue health panel.
 */
enum FrakWebhookState: string
{
    case Pending = 'pending';
    case Success = 'success';
    case Failed = 'failed';
}
