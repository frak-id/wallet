<?php

declare(strict_types=1);

namespace FrakLabs\PrestaShop\Test\Unit;

use FrakLogger;
use FrakLogLevel;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../classes/FrakLogLevel.php';
require_once __DIR__ . '/../../classes/FrakLogger.php';

/**
 * Cover the pure-PHP buffer behaviour of {@see FrakLogger}. Filesystem
 * flushing is left to integration tests because the cache directory is a
 * PrestaShop-runtime path; the buffer + level-escalation contract is what
 * matters for callers and is fully unit-testable.
 */
final class FrakLoggerTest extends TestCase
{
    protected function setUp(): void
    {
        // Drain any leftover entries from previous tests so each test
        // starts from a clean buffer. Mirrors the same drain helper the
        // production code never uses.
        FrakLogger::drainForTesting();
    }

    public function testInfoLogsAreBufferedAtLevelInfo(): void
    {
        FrakLogger::info('hello');

        $drained = FrakLogger::drainForTesting();
        $this->assertCount(1, $drained);
        $this->assertSame('hello', $drained[0]['message']);
        $this->assertSame(FrakLogLevel::Info, $drained[0]['level']);
        $this->assertSame(1, FrakLogLevel::Info->value);
    }

    public function testWarningLogsLandAtLevelWarning(): void
    {
        FrakLogger::warning('careful');

        $drained = FrakLogger::drainForTesting();
        $this->assertSame(FrakLogLevel::Warning, $drained[0]['level']);
        $this->assertSame(2, FrakLogLevel::Warning->value);
    }

    public function testErrorLogsLandAtLevelError(): void
    {
        // PrestaShopLogger forwarding is best-effort (`class_exists` guard);
        // in unit tests the class doesn't exist so the buffer entry is the
        // only artefact we verify.
        FrakLogger::error('boom');

        $drained = FrakLogger::drainForTesting();
        $this->assertSame(FrakLogLevel::Error, $drained[0]['level']);
        $this->assertSame(3, FrakLogLevel::Error->value);
    }

    public function testEnumValuesMatchPrestaShopLoggerNumbering(): void
    {
        // Backed-int values track `PrestaShopLogger::addLog` so the
        // `class_exists` forwarding in `log()` produces visually identical
        // entries in `Advanced Parameters → Logs`.
        $this->assertSame(1, FrakLogLevel::Info->value);
        $this->assertSame(2, FrakLogLevel::Warning->value);
        $this->assertSame(3, FrakLogLevel::Error->value);
        $this->assertSame(4, FrakLogLevel::Critical->value);
    }

    public function testEscalationCutLandsAtError(): void
    {
        // The escalation predicate lives on the enum so the file-only vs
        // PrestaShopLogger-forwarded split is a single-place edit. Pin the
        // current cut so a future renumbering can't silently flip the
        // escalation set.
        $this->assertFalse(FrakLogLevel::Info->escalatesToPrestaShopLogger());
        $this->assertFalse(FrakLogLevel::Warning->escalatesToPrestaShopLogger());
        $this->assertTrue(FrakLogLevel::Error->escalatesToPrestaShopLogger());
        $this->assertTrue(FrakLogLevel::Critical->escalatesToPrestaShopLogger());
    }

    public function testBufferOrderIsPreserved(): void
    {
        FrakLogger::info('first');
        FrakLogger::warning('second');
        FrakLogger::error('third');

        $drained = FrakLogger::drainForTesting();
        $this->assertSame(
            ['first', 'second', 'third'],
            array_map(static fn (array $entry): string => $entry['message'], $drained)
        );
    }

    public function testDrainForTestingEmptiesTheBuffer(): void
    {
        FrakLogger::info('about to be drained');
        $first = FrakLogger::drainForTesting();
        $second = FrakLogger::drainForTesting();

        $this->assertCount(1, $first);
        $this->assertSame([], $second, 'Second drain must be empty — drain semantics mirror flush()');
    }

    public function testEachEntryCarriesATimestamp(): void
    {
        $before = time();
        FrakLogger::info('stamped');
        $after = time();

        $drained = FrakLogger::drainForTesting();
        $this->assertGreaterThanOrEqual($before, $drained[0]['ts']);
        $this->assertLessThanOrEqual($after, $drained[0]['ts']);
    }

    public function testShutdownIsRegisteredAtMostOnce(): void
    {
        // First `log()` call wires `register_shutdown_function` and flips
        // the static flag. Subsequent calls must observe the flag as
        // already set so they don't re-register the handler. We can't
        // directly observe `register_shutdown_function`'s internal queue
        // from PHP, but the `if (!self::$shutdownRegistered)` gate is
        // what enforces the at-most-once contract — verifying the flag
        // stays set across calls is the highest-fidelity assertion
        // available in pure-PHP unit tests.
        FrakLogger::info('first');
        $afterFirst = FrakLogger::isShutdownRegisteredForTesting();

        FrakLogger::info('second');
        FrakLogger::warning('third');
        FrakLogger::error('fourth');
        $afterMany = FrakLogger::isShutdownRegisteredForTesting();

        $this->assertTrue($afterFirst, 'Flag must be set after the first log() call');
        $this->assertTrue($afterMany, 'Flag stays set across subsequent log() calls');
    }
}
