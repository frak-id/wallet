import { mockWebLocks } from "@frak-labs/test-foundation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withBrowserLock } from "./withBrowserLock";

/** Resolves only once `release()` is called, so a lock can be held open. */
function pendingTask() {
    let release: () => void = () => {};
    const started = vi.fn();
    const task = () => {
        started();
        return new Promise<string>((resolve) => {
            release = () => resolve("done");
        });
    };
    return { task, started, release: () => release() };
}

describe("withBrowserLock", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        Reflect.deleteProperty(navigator, "locks");
    });

    it("runs unsynchronised when the browser has no lock manager", async () => {
        const first = pendingTask();
        const second = pendingTask();

        const runs = Promise.all([
            withBrowserLock("no-manager", first.task),
            withBrowserLock("no-manager", second.task),
        ]);

        expect(first.started).toHaveBeenCalled();
        expect(second.started).toHaveBeenCalled();
        first.release();
        second.release();
        await runs;
    });

    describe("with a lock manager", () => {
        it("serialises waiters instead of running them together", async () => {
            mockWebLocks();
            const first = pendingTask();
            const second = pendingTask();

            const runs = Promise.all([
                withBrowserLock("serial", first.task),
                withBrowserLock("serial", second.task),
            ]);
            await vi.waitFor(() => expect(first.started).toHaveBeenCalled());

            expect(second.started).not.toHaveBeenCalled();
            first.release();
            await vi.waitFor(() => expect(second.started).toHaveBeenCalled());
            second.release();
            expect(await runs).toEqual(["done", "done"]);
        });

        it("skips an ifAvailable caller while the lock is held", async () => {
            mockWebLocks();
            const holder = pendingTask();
            const contender = pendingTask();

            const held = withBrowserLock("claim", holder.task);
            await vi.waitFor(() => expect(holder.started).toHaveBeenCalled());

            const skipped = await withBrowserLock("claim", contender.task, {
                ifAvailable: true,
            });

            expect(skipped).toBeUndefined();
            expect(contender.started).not.toHaveBeenCalled();
            holder.release();
            await held;
        });

        it("grants an ifAvailable caller once the lock is free", async () => {
            mockWebLocks();

            const result = await withBrowserLock(
                "claim-free",
                async () => "ran",
                { ifAvailable: true }
            );

            expect(result).toBe("ran");
        });

        it("runs anyway when a holder outlasts the wait ceiling", async () => {
            vi.useFakeTimers();
            mockWebLocks();
            const holder = pendingTask();
            const waiter = pendingTask();

            const held = withBrowserLock("stuck", holder.task);
            await vi.waitFor(() => expect(holder.started).toHaveBeenCalled());
            const waiting = withBrowserLock("stuck", waiter.task);

            await vi.advanceTimersByTimeAsync(5_000);

            expect(waiter.started).toHaveBeenCalled();
            waiter.release();
            expect(await waiting).toBe("done");
            holder.release();
            await held;
            vi.useRealTimers();
        });

        it("propagates a failure from the task it did acquire for", async () => {
            mockWebLocks();

            await expect(
                withBrowserLock("throwing", async () => {
                    throw new Error("task failed");
                })
            ).rejects.toThrow("task failed");
        });
    });
});
