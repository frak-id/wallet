<?php

/**
 * Buffered file logger.
 *
 * Replaces direct `PrestaShopLogger::addLog()` calls on hot paths
 * (per-order webhook attempt, per-row cron retry) with an in-memory buffer
 * that flushes to a per-day rotated file in `_PS_CACHE_DIR_/frak/` at
 * request shutdown.
 *
 * Why not `PrestaShopLogger`:
 *   - `PrestaShopLogger::addLog()` is a synchronous INSERT into `ps_log`
 *     filtered only by `PS_MIN_LOGGER_LEVEL_IN_DB`. On the order-status
 *     hook we previously emitted 5+ rows per transition (Triggered /
 *     Started / Sent successfully / etc.); on a busy shop that's the
 *     fastest way to bloat `ps_log` while writing zero useful information.
 *   - Files in `_PS_CACHE_DIR_/frak/` cost a single `file_put_contents`
 *     append at request end regardless of how many lines were buffered.
 *
 * Severity is typed as {@see FrakLogLevel}: `Error` / `Critical` entries
 * forward to `PrestaShopLogger` so they remain visible under
 * `Advanced Parameters → Logs`; `Info` / `Warning` stay file-only. The
 * escalation cut lives on the enum itself (`escalatesToPrestaShopLogger`)
 * so adding a new severity tier is a one-place edit.
 *
 * The buffer is flushed via a registered `shutdown_function` (covers the
 * normal request lifecycle) and is also flushed manually by the cron
 * drainer's exit path so a crash mid-run doesn't lose the audit trail.
 */
class FrakLogger
{
    /**
     * In-memory buffer. Each entry: `{message, level, ts}`.
     *
     * @var array<int, array{message:string,level:FrakLogLevel,ts:int}>
     */
    private static array $buffer = [];

    /** Whether `register_shutdown_function` has already been wired. */
    private static bool $shutdownRegistered = false;

    /**
     * Buffer a log message for batch flush. Severity is a {@see FrakLogLevel}
     * case; the int value handed to `PrestaShopLogger::addLog()` lives on
     * the enum so PHP-int constants and PS severity numbers can never
     * drift apart.
     */
    public static function log(string $message, FrakLogLevel $level = FrakLogLevel::Info): void
    {
        if (!self::$shutdownRegistered) {
            // Registered exactly once per request. Idempotent re-entry guard
            // since PrestaShop news up the module class multiple times per
            // request and the first log() call wins.
            register_shutdown_function([self::class, 'flush']);
            self::$shutdownRegistered = true;
        }
        self::$buffer[] = [
            'message' => $message,
            'level' => $level,
            'ts' => time(),
        ];

        // Forward errors / criticals to PrestaShopLogger immediately so they
        // surface in the admin UI without waiting for the buffer to flush —
        // the merchant-debugging surface needs to see failures live.
        if ($level->escalatesToPrestaShopLogger() && class_exists('PrestaShopLogger')) {
            PrestaShopLogger::addLog($message, $level->value);
        }
    }

    public static function info(string $message): void
    {
        self::log($message, FrakLogLevel::Info);
    }

    public static function warning(string $message): void
    {
        self::log($message, FrakLogLevel::Warning);
    }

    public static function error(string $message): void
    {
        self::log($message, FrakLogLevel::Error);
    }

    /**
     * Flush the buffer to a per-day rotated log file. Safe to call multiple
     * times — empties the buffer on each flush so the shutdown hook and a
     * manual final flush don't double-write.
     *
     * Errors during flush are swallowed: the logger MUST NOT crash a
     * request just because the cache directory is unwritable. The whole
     * point of moving off `ps_log` is to keep logging out of the critical
     * path.
     */
    public static function flush(): void
    {
        if (empty(self::$buffer)) {
            return;
        }

        $cache_dir = defined('_PS_CACHE_DIR_') ? _PS_CACHE_DIR_ : sys_get_temp_dir() . '/';
        $log_dir = rtrim($cache_dir, '/') . '/frak';
        if (!is_dir($log_dir)) {
            // 0775 mirrors PrestaShop's own cache-dir creation conventions.
            // Suppress errors: if the dir can't be created, the file write
            // below will fail gracefully and we drop the lines.
            @mkdir($log_dir, 0775, true);
        }
        $log_path = $log_dir . '/' . date('Y-m-d') . '.log';

        $lines = [];
        foreach (self::$buffer as $entry) {
            $lines[] = sprintf(
                '[%s] [%s] %s',
                date('Y-m-d H:i:s', $entry['ts']),
                $entry['level']->label(),
                $entry['message']
            );
        }
        @file_put_contents(
            $log_path,
            implode(PHP_EOL, $lines) . PHP_EOL,
            FILE_APPEND | LOCK_EX
        );

        self::$buffer = [];
    }

    /**
     * Drain the buffer for inspection (used by tests). Empties the buffer
     * as a side-effect to mirror `flush()` semantics.
     *
     * @return array<int, array{message:string,level:FrakLogLevel,ts:int}>
     */
    public static function drainForTesting(): array
    {
        $drained = self::$buffer;
        self::$buffer = [];
        return $drained;
    }

    /**
     * Inspect whether `register_shutdown_function` has already been wired
     * for this request. Test-only — production code never needs to know,
     * the contract is "the shutdown handler runs at most once and the
     * first `log()` call is what triggers registration".
     *
     * Pairs with {@see FrakLoggerTest::testShutdownIsRegisteredAtMostOnce}
     * to assert the gate behaves correctly across multiple `log()` calls
     * within the same request.
     */
    public static function isShutdownRegisteredForTesting(): bool
    {
        return self::$shutdownRegistered;
    }
}
