import { describe, expect, it } from "vitest";
import { deriveScheduledAt, isScheduleValid } from "./schedule";

describe("push schedule", () => {
    it("treats immediate sends as having no timestamp", () => {
        const schedule = { type: "now", date: "", time: "" } as const;
        expect(deriveScheduledAt(schedule)).toBeUndefined();
        expect(isScheduleValid(schedule)).toBe(true);
    });

    it("is invalid until an option is picked", () => {
        const schedule = { type: "", date: "", time: "" } as const;
        expect(deriveScheduledAt(schedule)).toBeUndefined();
        expect(isScheduleValid(schedule)).toBe(false);
    });

    it("rejects 'later' until both date and time are set", () => {
        const iso = "2026-06-15T00:00:00.000Z";
        expect(isScheduleValid({ type: "later", date: iso, time: "" })).toBe(
            false
        );
        expect(
            isScheduleValid({ type: "later", date: "", time: "10:00" })
        ).toBe(false);
        expect(
            deriveScheduledAt({ type: "later", date: iso, time: "" })
        ).toBeUndefined();
    });

    it("derives an epoch timestamp from a complete 'later' schedule", () => {
        const iso = "2026-06-15T00:00:00.000Z";
        const schedule = { type: "later", date: iso, time: "10:00" } as const;
        const expected = new Date(iso);
        expected.setHours(10, 0, 0, 0);
        expect(isScheduleValid(schedule)).toBe(true);
        expect(deriveScheduledAt(schedule)).toBe(expected.getTime());
    });
});
