import { renderHook } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { useLightDomStyles } from "./useLightDomStyles";

const TAG = "frak-button-share";
const CSS = "frak-button-share .button{color:red!important}";

function styleText(key: string): string | null | undefined {
    return document.getElementById(`frak-placement-${TAG}-${key}`)?.textContent;
}

function placementStyleCount(): number {
    return document.head.querySelectorAll('style[id^="frak-placement-"]')
        .length;
}

describe("useLightDomStyles", () => {
    afterEach(() => {
        document.head.replaceChildren();
    });

    it("injects the global tier when the element carries no placement", () => {
        renderHook(() => useLightDomStyles(TAG, undefined, CSS));

        expect(styleText("")).toBe(CSS);
    });

    it("keys placement css apart from the global tier", () => {
        renderHook(() => useLightDomStyles(TAG, "product", CSS));
        renderHook(() => useLightDomStyles(TAG, undefined, CSS));

        expect(styleText("product")).toBe(CSS);
        expect(styleText("")).toBe(CSS);
        expect(placementStyleCount()).toBe(2);
    });

    it("injects nothing when the merchant saved no css", () => {
        renderHook(() => useLightDomStyles(TAG, "product", undefined));
        renderHook(() => useLightDomStyles(TAG, undefined, undefined));

        expect(placementStyleCount()).toBe(0);
    });
});
