import { describe, expect, it } from "vitest";
import { missionSubjectOf } from "./missions";

describe("missionSubjectOf", () => {
    it.each([
        ["referrer", "referee"],
        ["referee", "recipient"],
        ["welcome_bonus", "recipient"],
    ] as const)("a held %s reward waits on the %s", (role, subject) => {
        expect(missionSubjectOf(role)).toBe(subject);
    });
});
