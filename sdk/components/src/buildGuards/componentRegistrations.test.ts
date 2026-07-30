import { describe, expect, it } from "vitest";
import {
    extractExpectedTags,
    findMissingRegistrations,
    hasRegistration,
} from "./componentRegistrations";

/**
 * Verbatim tail of `cdn/ButtonShare.DMwS3SV_.js` as published to jsDelivr while
 * the package declared `"sideEffects": false`. The registration call is absent;
 * note the `frak-button-share` literal that survives via `useLightDomStyles`,
 * which is what makes a naive tag-literal check pass on a broken bundle.
 */
const BROKEN_CHUNK =
    "function m({placement:m,text:h,classname:g=``}){u(`frak-button-share`,m,T?.css);" +
    "return r(`button`,{type:`button`,class:L,onClick:I,children:F})}export{m as ButtonShare};";

/** Same chunk from a correct build: the minified registration is present. */
const FIXED_CHUNK = BROKEN_CHUNK.replace(
    "export{m as ButtonShare};",
    "r(m,`frak-button-share`,[`text`,`placement`,`preview`],{shadow:!1});export{m as ButtonShare};"
);

describe("extractExpectedTags", () => {
    it("reads the tag from a registerWebComponent call", () => {
        const source = `
            registerWebComponent(ButtonShare, "frak-button-share", [
                "text",
                "placement",
            ], { shadow: false });
        `;
        expect(extractExpectedTags(source)).toEqual(["frak-button-share"]);
    });

    it("collects every registration in a file", () => {
        const source = `
            registerWebComponent(Banner, "frak-banner", ["placement"]);
            registerWebComponent(PostPurchase, "frak-post-purchase", ["token"]);
        `;
        expect(extractExpectedTags(source)).toEqual([
            "frak-banner",
            "frak-post-purchase",
        ]);
    });

    it("returns nothing for a file that registers no component", () => {
        expect(extractExpectedTags("export const a = 1;")).toEqual([]);
    });
});

describe("hasRegistration", () => {
    it("detects a minified registration", () => {
        expect(hasRegistration(FIXED_CHUNK, "frak-button-share")).toBe(true);
    });

    it("detects an unminified registration", () => {
        const chunk = `registerWebComponent(ButtonShare, "frak-button-share", [\n"text",\n]);`;
        expect(hasRegistration(chunk, "frak-button-share")).toBe(true);
    });

    it("rejects the tree-shaken chunk that shipped the outage", () => {
        expect(hasRegistration(BROKEN_CHUNK, "frak-button-share")).toBe(false);
    });

    it("does not count a bare tag literal as a registration", () => {
        // `useLightDomStyles("frak-button-share", placementId, css)` — the tag
        // is followed by an identifier, not the observed-attributes array.
        expect(
            hasRegistration(
                'u("frak-button-share",m,T?.css)',
                "frak-button-share"
            )
        ).toBe(false);
    });

    it("does not match a different tag sharing a prefix", () => {
        expect(hasRegistration(FIXED_CHUNK, "frak-button")).toBe(false);
    });
});

describe("findMissingRegistrations", () => {
    it("reports nothing when every tag is registered somewhere", () => {
        expect(
            findMissingRegistrations(["frak-button-share"], [FIXED_CHUNK])
        ).toEqual([]);
    });

    it("reports the tag dropped by tree-shaking", () => {
        expect(
            findMissingRegistrations(["frak-button-share"], [BROKEN_CHUNK])
        ).toEqual(["frak-button-share"]);
    });

    it("reports a tag no chunk registers at all", () => {
        expect(
            findMissingRegistrations(
                ["frak-button-share", "frak-banner"],
                [FIXED_CHUNK]
            )
        ).toEqual(["frak-banner"]);
    });
});
