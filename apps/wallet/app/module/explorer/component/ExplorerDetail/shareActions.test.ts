import { describe, expect, test, vi } from "vitest";
import {
    isCreateStepDisabled,
    resolvePrimaryShareAction,
} from "./shareActions";

describe("resolvePrimaryShareAction", () => {
    test("uses the share handler when native sharing is available", () => {
        const handleShare = vi.fn();
        const handleCopy = vi.fn();
        expect(resolvePrimaryShareAction(true, handleShare, handleCopy)).toBe(
            handleShare
        );
    });

    test("falls back to copy when native sharing is unavailable", () => {
        const handleShare = vi.fn();
        const handleCopy = vi.fn();
        expect(resolvePrimaryShareAction(false, handleShare, handleCopy)).toBe(
            handleCopy
        );
    });
});

describe("isCreateStepDisabled", () => {
    test("is disabled while creating or loading", () => {
        expect(isCreateStepDisabled(true, false)).toBe(true);
        expect(isCreateStepDisabled(false, true)).toBe(true);
        expect(isCreateStepDisabled(true, true)).toBe(true);
    });

    test("is enabled when neither creating nor loading", () => {
        expect(isCreateStepDisabled(false, false)).toBe(false);
    });
});
