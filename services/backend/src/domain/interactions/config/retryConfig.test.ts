import { describe, expect, it } from "vitest";
import {
    calculateNextRetry,
    hasExceededMaxRetries,
    RETRY_CONFIG,
} from "./retryConfig";

describe("Retry Configuration", () => {
    describe("RETRY_CONFIG constants", () => {
        it("should have correct config for no_session", () => {
            expect(RETRY_CONFIG.no_session).toEqual({
                maxAttempts: 30,
                initialDelay: 12 * 60 * 60 * 1000, // 12 hours
                backoffMultiplier: 2,
                maxDelay: 48 * 60 * 60 * 1000, // 48 hours
            });
        });

        it("should have correct config for failed", () => {
            expect(RETRY_CONFIG.failed).toEqual({
                maxAttempts: 30,
                initialDelay: 3 * 60 * 60 * 1000, // 3 hours
                backoffMultiplier: 2,
                maxDelay: 48 * 60 * 60 * 1000, // 48 hours
            });
        });

        it("should have correct config for execution_failed", () => {
            expect(RETRY_CONFIG.execution_failed).toEqual({
                maxAttempts: 50,
                initialDelay: 2 * 60 * 1000, // 2 minutes
                backoffMultiplier: 2,
                maxDelay: 60 * 60 * 1000, // 1 hour
            });
        });
    });

    describe("calculateNextRetry", () => {
        describe("no_session status", () => {
            it("should return initial delay for first retry", () => {
                const now = Date.now();
                const nextRetry = calculateNextRetry("no_session", 1);
                const expectedDelay = 12 * 60 * 60 * 1000; // 12 hours

                expect(nextRetry.getTime()).toBeGreaterThanOrEqual(
                    now + expectedDelay - 100
                );
                expect(nextRetry.getTime()).toBeLessThanOrEqual(
                    now + expectedDelay + 100
                );
            });

            it("should apply exponential backoff", () => {
                const now = Date.now();
                const nextRetry = calculateNextRetry("no_session", 2);
                const expectedDelay = 12 * 60 * 60 * 1000 * 2; // 24 hours

                expect(nextRetry.getTime()).toBeGreaterThanOrEqual(
                    now + expectedDelay - 100
                );
                expect(nextRetry.getTime()).toBeLessThanOrEqual(
                    now + expectedDelay + 100
                );
            });

            it("should cap at max delay", () => {
                const now = Date.now();
                const nextRetry = calculateNextRetry("no_session", 10);
                const maxDelay = 48 * 60 * 60 * 1000; // 48 hours

                expect(nextRetry.getTime()).toBeGreaterThanOrEqual(
                    now + maxDelay - 100
                );
                expect(nextRetry.getTime()).toBeLessThanOrEqual(
                    now + maxDelay + 100
                );
            });
        });

        describe("failed status", () => {
            it("should return initial delay for first retry", () => {
                const now = Date.now();
                const nextRetry = calculateNextRetry("failed", 1);
                const expectedDelay = 3 * 60 * 60 * 1000; // 3 hours

                expect(nextRetry.getTime()).toBeGreaterThanOrEqual(
                    now + expectedDelay - 100
                );
                expect(nextRetry.getTime()).toBeLessThanOrEqual(
                    now + expectedDelay + 100
                );
            });

            it("should apply exponential backoff", () => {
                const now = Date.now();
                const nextRetry = calculateNextRetry("failed", 3);
                const expectedDelay = 3 * 60 * 60 * 1000 * 2 * 2; // 12 hours

                expect(nextRetry.getTime()).toBeGreaterThanOrEqual(
                    now + expectedDelay - 100
                );
                expect(nextRetry.getTime()).toBeLessThanOrEqual(
                    now + expectedDelay + 100
                );
            });
        });

        describe("execution_failed status", () => {
            it("should return initial delay for first retry", () => {
                const now = Date.now();
                const nextRetry = calculateNextRetry("execution_failed", 1);
                const expectedDelay = 2 * 60 * 1000; // 2 minutes

                expect(nextRetry.getTime()).toBeGreaterThanOrEqual(
                    now + expectedDelay - 100
                );
                expect(nextRetry.getTime()).toBeLessThanOrEqual(
                    now + expectedDelay + 100
                );
            });

            it("should cap at 1 hour max delay", () => {
                const now = Date.now();
                const nextRetry = calculateNextRetry("execution_failed", 20);
                const maxDelay = 60 * 60 * 1000; // 1 hour

                expect(nextRetry.getTime()).toBeGreaterThanOrEqual(
                    now + maxDelay - 100
                );
                expect(nextRetry.getTime()).toBeLessThanOrEqual(
                    now + maxDelay + 100
                );
            });

            it("should handle rapid retries correctly", () => {
                const retry1 = calculateNextRetry("execution_failed", 1);
                const retry2 = calculateNextRetry("execution_failed", 2);
                const retry3 = calculateNextRetry("execution_failed", 3);

                // Each should be later than the previous
                expect(retry2.getTime()).toBeGreaterThan(retry1.getTime());
                expect(retry3.getTime()).toBeGreaterThan(retry2.getTime());
            });
        });
    });

    describe("hasExceededMaxRetries", () => {
        it("should return false when under max attempts", () => {
            expect(hasExceededMaxRetries("no_session", 1)).toBe(false);
            expect(hasExceededMaxRetries("no_session", 29)).toBe(false);
            expect(hasExceededMaxRetries("failed", 15)).toBe(false);
            expect(hasExceededMaxRetries("execution_failed", 25)).toBe(false);
        });

        it("should return true when exceeded max attempts", () => {
            expect(hasExceededMaxRetries("no_session", 31)).toBe(true);
            expect(hasExceededMaxRetries("failed", 31)).toBe(true);
            expect(hasExceededMaxRetries("execution_failed", 51)).toBe(true);
        });

        it("should return true when exactly at max + 1", () => {
            expect(hasExceededMaxRetries("no_session", 31)).toBe(true);
            expect(hasExceededMaxRetries("failed", 31)).toBe(true);
            expect(hasExceededMaxRetries("execution_failed", 51)).toBe(true);
        });

        it("should return false when exactly at max", () => {
            expect(hasExceededMaxRetries("no_session", 30)).toBe(false);
            expect(hasExceededMaxRetries("failed", 30)).toBe(false);
            expect(hasExceededMaxRetries("execution_failed", 50)).toBe(false);
        });

        it("should handle zero retries", () => {
            expect(hasExceededMaxRetries("no_session", 0)).toBe(false);
            expect(hasExceededMaxRetries("failed", 0)).toBe(false);
            expect(hasExceededMaxRetries("execution_failed", 0)).toBe(false);
        });
    });

    describe("Edge cases", () => {
        it("should handle very high retry counts", () => {
            const result = calculateNextRetry("execution_failed", 1000);
            expect(result).toBeInstanceOf(Date);
            expect(result.getTime()).toBeGreaterThan(Date.now());
        });

        it("should produce consistent results for same inputs", () => {
            const result1 = calculateNextRetry("failed", 5);
            // Small delay to ensure different timestamps
            const result2 = calculateNextRetry("failed", 5);

            // Should be within 1 second of each other
            expect(
                Math.abs(result1.getTime() - result2.getTime())
            ).toBeLessThan(1000);
        });
    });
});
