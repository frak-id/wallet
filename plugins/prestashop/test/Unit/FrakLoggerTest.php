<?php

declare(strict_types=1);

namespace FrakLabs\PrestaShop\Test\Unit;

use FrakLogger;
use PHPUnit\Framework\TestCase;

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

    public function testInfoLogsAreBufferedAtLevelOne(): void
    {
        FrakLogger::info('hello');

        $drained = FrakLogger::drainForTesting();
        $this->assertCount(1, $drained);
        $this->assertSame('hello', $drained[0]['message']);
        $this->assertSame(FrakLogger::LEVEL_INFO, $drained[0]['level']);
        $this->assertSame(1, FrakLogger::LEVEL_INFO);
    }

    public function testWarningLogsLandAtLevelTwo(): void
    {
        FrakLogger::warning('careful');

        $drained = FrakLogger::drainForTesting();
        $this->assertSame(FrakLogger::LEVEL_WARNING, $drained[0]['level']);
        $this->assertSame(2, FrakLogger::LEVEL_WARNING);
    }

    public function testErrorLogsLandAtLevelThree(): void
    {
        // PrestaShopLogger forwarding is best-effort (`class_exists` guard);
        // in unit tests the class doesn't exist so the buffer entry is the
        // only artefact we verify.
        FrakLogger::error('boom');

        $drained = FrakLogger::drainForTesting();
        $this->assertSame(FrakLogger::LEVEL_ERROR, $drained[0]['level']);
        $this->assertSame(3, FrakLogger::LEVEL_ERROR);
    }

    public function testCriticalLevelMatchesPrestaShopLoggerNumbering(): void
    {
        // Level numbers track `PrestaShopLogger::addLog` so the
        // `class_exists` forwarding in `log()` produces visually identical
        // entries in `Advanced Parameters → Logs`.
        $this->assertSame(4, FrakLogger::LEVEL_CRITICAL);
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
}
