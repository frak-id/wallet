import { describe, expect, it } from "vitest";
import { hasDiscardableSectionChanges, SECTION_KEYS } from "./sections";

describe("hasDiscardableSectionChanges", () => {
    it("is false when nothing is dirty", () => {
        expect(hasDiscardableSectionChanges({})).toBe(false);
        expect(
            hasDiscardableSectionChanges({
                [SECTION_KEYS.defaultComponents]: false,
            })
        ).toBe(false);
    });

    it("is true for a section that unmounts on a tab change", () => {
        expect(
            hasDiscardableSectionChanges({
                [SECTION_KEYS.defaultComponents]: true,
            })
        ).toBe(true);
    });

    // Identity and sharing render above the selector, so their edits survive a
    // tab change — prompting to discard them would be a lie.
    it("is false for the sections that stay mounted", () => {
        expect(
            hasDiscardableSectionChanges({
                [SECTION_KEYS.identity]: true,
                [SECTION_KEYS.sharing]: true,
            })
        ).toBe(false);
    });

    it("is true when a discardable section is dirty alongside them", () => {
        expect(
            hasDiscardableSectionChanges({
                [SECTION_KEYS.identity]: true,
                [SECTION_KEYS.sharing]: true,
                [SECTION_KEYS.defaultComponents]: true,
            })
        ).toBe(true);
    });
});
