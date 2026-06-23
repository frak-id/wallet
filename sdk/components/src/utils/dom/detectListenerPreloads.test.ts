import { afterEach, describe, expect, it } from "vitest";
import { detectListenerPreloads } from "./detectListenerPreloads";

describe("detectListenerPreloads", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("returns an empty list when no Frak component is mounted", () => {
        document.body.innerHTML = "<div>plain content</div>";

        expect(detectListenerPreloads()).toEqual([]);
    });

    it.each([
        "frak-button-share",
        "frak-button-wallet",
        "frak-open-in-app",
        "frak-post-purchase",
        "frak-banner",
    ])("returns ['sharing'] when <%s> is on the page", (tag) => {
        document.body.innerHTML = `<${tag}></${tag}>`;

        expect(detectListenerPreloads()).toEqual(["sharing"]);
    });

    it("returns ['sharing'] when several Frak components are present", () => {
        document.body.innerHTML = `
            <frak-button-share></frak-button-share>
            <frak-button-wallet></frak-button-wallet>
            <frak-banner></frak-banner>
        `;

        expect(detectListenerPreloads()).toEqual(["sharing"]);
    });

    it("ignores non-Frak custom elements that happen to share a prefix", () => {
        document.body.innerHTML =
            "<frakish-element></frakish-element><my-button></my-button>";

        expect(detectListenerPreloads()).toEqual([]);
    });
});
