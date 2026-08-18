/**
 * Cross-instance mutual exclusion over the Web Locks API.
 *
 * A page routinely holds several copies of this SDK — a CDN bundle beside an
 * npm import, each with its own module state — and every copy reads the same
 * `localStorage`. Module-level guards (`withCache`, an in-flight promise) are
 * per-copy and cannot see each other, so anything that must happen *once per
 * origin* rather than once per copy has to claim a lock the browser owns.
 *
 * For values, prefer `withCache`: a lock only orders execution, it carries no
 * result across copies, so cache misses would just re-fetch in series.
 */

/**
 * How long a waiting caller tolerates a holder before giving up and running
 * anyway. A frozen (bfcache) tab keeps its lock, and no caller here may hang
 * on one.
 */
const LOCK_WAIT_TIMEOUT_MS = 5_000;

type BrowserLockOptions = {
    /** Skip the task entirely when another instance holds the lock. */
    ifAvailable?: boolean;
};

function lockManager(): LockManager | undefined {
    // Absent off a secure context, which merchant pages on plain http are.
    if (typeof navigator === "undefined") return undefined;
    return navigator.locks;
}

/**
 * Run `task` under the named origin-wide lock. Waits for a holder, up to
 * {@link LOCK_WAIT_TIMEOUT_MS}.
 */
export function withBrowserLock<T>(
    name: string,
    task: () => Promise<T>
): Promise<T>;
/**
 * Run `task` only if the lock is free, otherwise resolve `undefined` without
 * running it — for work a sibling instance is already doing.
 */
export function withBrowserLock<T>(
    name: string,
    task: () => Promise<T>,
    options: { ifAvailable: true }
): Promise<T | undefined>;
export async function withBrowserLock<T>(
    name: string,
    task: () => Promise<T>,
    options: BrowserLockOptions = {}
): Promise<T | undefined> {
    const locks = lockManager();
    // Unsupported degrades to unsynchronised, never to not running: every
    // caller here is correct-but-duplicated without the lock.
    if (!locks) return task();

    if (options.ifAvailable) {
        return locks.request(name, { ifAvailable: true }, async (lock) =>
            lock ? task() : undefined
        );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOCK_WAIT_TIMEOUT_MS);
    // Distinguishes a lock that was never granted from a task that threw:
    // only the former may be retried unlocked.
    let acquired = false;
    try {
        return await locks.request(name, { signal: controller.signal }, () => {
            acquired = true;
            return task();
        });
    } catch (error) {
        if (acquired) throw error;
        return task();
    } finally {
        clearTimeout(timeout);
    }
}
