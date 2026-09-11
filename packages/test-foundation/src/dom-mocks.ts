/** Mocks for window/document properties jsdom exposes as read-only. */

export function mockWindowOrigin(origin = "http://localhost:3000") {
    Object.defineProperty(window, "origin", {
        writable: true,
        value: origin,
    });
}

export function mockDocumentReferrer(referrer = "https://example.com") {
    Object.defineProperty(document, "referrer", {
        value: referrer,
        writable: true,
        configurable: true,
    });
}

/** `vi` is passed in: vitest cannot be imported from a CommonJS context. */
export function mockWindowHistory(vi: any) {
    Object.defineProperty(window, "history", {
        writable: true,
        value: {
            replaceState: vi.fn(),
            pushState: vi.fn(),
            back: vi.fn(),
            forward: vi.fn(),
            go: vi.fn(),
            length: 0,
            scrollRestoration: "auto" as ScrollRestoration,
            state: null,
        },
    });
}

/** `window.origin` + `document.referrer` defaults for iframe tests. */
export function setupListenerDomMocks(options?: {
    origin?: string;
    referrer?: string;
}) {
    const { origin, referrer } = options || {};
    mockWindowOrigin(origin);
    mockDocumentReferrer(referrer);
}

/**
 * Mock navigator.locks with a real exclusive Web Locks implementation.
 *
 * jsdom/happy-dom ship no `LockManager`, so code guarding cross-instance work
 * runs unsynchronised and races stay invisible. Waiters queue FIFO;
 * `ifAvailable` callers are handed `null` instead of waiting, like the spec.
 *
 * @param target - Object to define `locks` on (default: `navigator`)
 */
export function mockWebLocks(target: object = navigator) {
    const held = new Map<string, Promise<unknown>>();

    type RequestOptions = { ifAvailable?: boolean; signal?: AbortSignal };

    function abortError() {
        return new DOMException("The request was aborted", "AbortError");
    }

    // A waiter aborted before it is granted rejects, and never runs.
    async function waitFor(holder: Promise<unknown>, signal?: AbortSignal) {
        if (!signal) {
            await holder;
            return;
        }
        let onAbort: (() => void) | undefined;
        try {
            await Promise.race([
                holder,
                new Promise((_resolve, reject) => {
                    if (signal.aborted) {
                        reject(abortError());
                        return;
                    }
                    onAbort = () => reject(abortError());
                    signal.addEventListener("abort", onAbort);
                }),
            ]);
        } finally {
            if (onAbort) signal.removeEventListener("abort", onAbort);
        }
    }

    async function request(
        name: string,
        options: RequestOptions | ((lock: unknown) => unknown),
        callback?: (lock: unknown) => unknown
    ) {
        const run = callback ?? (options as (lock: unknown) => unknown);
        const opts = callback ? (options as RequestOptions) : {};

        const tail = held.get(name);
        if (tail && opts.ifAvailable) return run(null);

        // Chained onto the current tail and installed BEFORE any await, so a
        // third contender queues behind this one instead of sharing its turn —
        // and a caller arriving between a holder's release and a waiter's
        // resumption still sees the queue, not a free lock.
        const released = (async () => {
            if (tail) await waitFor(tail, opts.signal);
            return run({ name, mode: "exclusive" });
        })();
        // The queue entry settles only when BOTH the predecessor chain and this
        // caller are done: an aborted waiter rejects `released` while the real
        // holder still runs, and its successor must keep waiting on that holder.
        const settled = Promise.allSettled(
            tail ? [tail, released] : [released]
        ).then(() => {
            // Only the tail clears the map: an intermediate settling must not
            // erase the queue behind it.
            if (held.get(name) === settled) held.delete(name);
        });
        held.set(name, settled);
        return released;
    }

    Object.defineProperty(target, "locks", {
        value: { request },
        writable: true,
        configurable: true,
    });
}
