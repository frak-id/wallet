<?php

declare(strict_types=1);

namespace FrakLabs\PrestaShop\Test\Unit;

use FrakWebhookQueue;
use FrakWebhookState;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../classes/FrakWebhookState.php';
require_once __DIR__ . '/../../classes/FrakWebhookQueue.php';

/**
 * Cover the pure / DB-free pieces of the queue: backoff schedule + the
 * MAX_ATTEMPTS contract. Anything that hits `Db::getInstance()` is left to
 * integration tests because the PrestaShop runtime is not bootstrapped here.
 */
final class FrakWebhookQueueTest extends TestCase
{
    public function testBackoffScheduleMatchesMagentoContract(): void
    {
        // The backend retry resolvers (Magento / WordPress) all share this schedule;
        // diverging would create cross-platform behaviour skew on the same backend.
        $this->assertSame(
            [300, 900, 3600, 21600, 86400],
            FrakWebhookQueue::BACKOFF_SECONDS
        );
        $this->assertSame(5, FrakWebhookQueue::MAX_ATTEMPTS);
        $this->assertCount(FrakWebhookQueue::MAX_ATTEMPTS, FrakWebhookQueue::BACKOFF_SECONDS);
    }

    public function testNextBackoffSecondsForEachAttempt(): void
    {
        // Attempt 1 follows the first backoff bucket (5 m), attempt 5 follows the last (24 h).
        $this->assertSame(300, FrakWebhookQueue::nextBackoffSeconds(1));
        $this->assertSame(900, FrakWebhookQueue::nextBackoffSeconds(2));
        $this->assertSame(3600, FrakWebhookQueue::nextBackoffSeconds(3));
        $this->assertSame(21600, FrakWebhookQueue::nextBackoffSeconds(4));
        $this->assertSame(86400, FrakWebhookQueue::nextBackoffSeconds(5));
    }

    public function testNextBackoffClampsBelowOneAndAboveCap(): void
    {
        // Defensive: we never want a negative attempt count to crash with
        // `BACKOFF[-1]` (PHP gives null + warning). We also never want the
        // formula to wrap around for attempts past the last bucket — clamp
        // to the longest backoff so the cron still respects the schedule.
        $this->assertSame(300, FrakWebhookQueue::nextBackoffSeconds(0));
        $this->assertSame(300, FrakWebhookQueue::nextBackoffSeconds(-3));
        $this->assertSame(86400, FrakWebhookQueue::nextBackoffSeconds(99));
    }

    public function testStateEnumValuesMatchSchemaEnum(): void
    {
        // The CREATE TABLE statement uses ENUM('pending','success','failed').
        // Backed-string enum values must agree so `markSuccess` /
        // `markFailure` updates aren't rejected by MySQL.
        $this->assertSame('pending', FrakWebhookState::Pending->value);
        $this->assertSame('success', FrakWebhookState::Success->value);
        $this->assertSame('failed', FrakWebhookState::Failed->value);
    }

    public function testStateEnumIsExhaustive(): void
    {
        // Pin the case set so a future addition (e.g. a `Cancelled` state)
        // forces an explicit test update + a matching SQL ENUM migration.
        // Drift here would silently fail `tryFrom` round-trips in
        // `FrakWebhookQueue::stats()`.
        $this->assertSame(
            ['pending', 'success', 'failed'],
            array_map(
                static fn (FrakWebhookState $case): string => $case->value,
                FrakWebhookState::cases()
            )
        );
    }
}
