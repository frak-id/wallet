import { describe, expect, it } from "vitest";
import {
    isAttemptAllowed,
    nextFailureState,
    TWO_FACTOR_LOCKOUT,
} from "./attemptGuard";

const NOW = 1_000_000_000_000;

describe("attemptGuard", () => {
    describe("isAttemptAllowed", () => {
        it("allows when no window has started", () => {
            expect(
                isAttemptAllowed({ attempts: 0, windowStartedAt: null }, NOW)
            ).toBe(true);
        });

        it("allows while under the ceiling inside the window", () => {
            expect(
                isAttemptAllowed(
                    {
                        attempts: TWO_FACTOR_LOCKOUT.MAX_ATTEMPTS - 1,
                        windowStartedAt: new Date(NOW),
                    },
                    NOW
                )
            ).toBe(true);
        });

        it("blocks once the ceiling is reached inside the window", () => {
            expect(
                isAttemptAllowed(
                    {
                        attempts: TWO_FACTOR_LOCKOUT.MAX_ATTEMPTS,
                        windowStartedAt: new Date(NOW),
                    },
                    NOW
                )
            ).toBe(false);
        });

        it("allows again once the window has elapsed", () => {
            expect(
                isAttemptAllowed(
                    {
                        attempts: TWO_FACTOR_LOCKOUT.MAX_ATTEMPTS,
                        windowStartedAt: new Date(
                            NOW - TWO_FACTOR_LOCKOUT.WINDOW_MS - 1
                        ),
                    },
                    NOW
                )
            ).toBe(true);
        });
    });

    describe("nextFailureState", () => {
        it("starts a fresh window on the first failure", () => {
            const next = nextFailureState(
                { attempts: 0, windowStartedAt: null },
                NOW
            );
            expect(next.attempts).toBe(1);
            expect(next.windowStartedAt).toEqual(new Date(NOW));
        });

        it("increments in place inside an active window", () => {
            const windowStartedAt = new Date(NOW - 1000);
            const next = nextFailureState(
                { attempts: 2, windowStartedAt },
                NOW
            );
            expect(next.attempts).toBe(3);
            expect(next.windowStartedAt).toBe(windowStartedAt);
        });

        it("resets the window after it elapses", () => {
            const next = nextFailureState(
                {
                    attempts: TWO_FACTOR_LOCKOUT.MAX_ATTEMPTS,
                    windowStartedAt: new Date(
                        NOW - TWO_FACTOR_LOCKOUT.WINDOW_MS - 1
                    ),
                },
                NOW
            );
            expect(next.attempts).toBe(1);
            expect(next.windowStartedAt).toEqual(new Date(NOW));
        });
    });
});
