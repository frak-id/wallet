<?php

/**
 * Severity tiers for {@see FrakLogger}.
 *
 * Backed integer enum so the value handed to `PrestaShopLogger::addLog()`
 * (which expects an int) stays a single source of truth — no risk of an
 * int constant drifting out of sync with the documented PS severity
 * numbering.
 *
 * `Info` / `Warning` are file-only (buffered, never reach `ps_log`);
 * `Error` / `Critical` get forwarded to `PrestaShopLogger` so failures
 * remain visible under `Advanced Parameters → Logs`. The escalation cut
 * lives in {@see FrakLogger::log()}.
 */
enum FrakLogLevel: int
{
    case Info = 1;
    case Warning = 2;
    case Error = 3;
    case Critical = 4;

    /**
     * Short human-readable tag emitted into the file-buffered log lines.
     * Padded to 4 characters so columns align in the rotated log files.
     */
    public function label(): string
    {
        return match ($this) {
            self::Info => 'INFO',
            self::Warning => 'WARN',
            self::Error => 'ERR ',
            self::Critical => 'CRIT',
        };
    }

    /**
     * Whether this level should escalate to `PrestaShopLogger::addLog()` so
     * the entry surfaces in the admin UI. `Info` / `Warning` stay
     * file-only to keep the `ps_log` table out of the critical path.
     */
    public function escalatesToPrestaShopLogger(): bool
    {
        return $this->value >= self::Error->value;
    }
}
