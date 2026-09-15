import { describe, expect, it } from "vitest";
import { processCss, processScopedCss } from "./processCss";

const PLACEMENT_SCOPE = 'frak-button-share[placement="hero"]';

describe("processCss", () => {
    it("keeps !important on every declaration", () => {
        const out = processCss(
            ".button{color:#000!important;border:1px solid #000!important}"
        );
        expect(out).toContain("color:#000!important");
        expect(out).toContain("border:1px solid #000!important");
    });

    it("minifies a transparent background to the 0 0 shorthand", () => {
        expect(processCss(".button{background:transparent!important}")).toBe(
            ".button{background:0 0!important}"
        );
    });

    it("strips comments from the served copy", () => {
        expect(
            processCss(
                '/* frak:style {"bg":"transparent"} */.button{color:red}/* /frak:style */'
            )
        ).toBe(".button{color:red}");
    });

    it("serves a self-scoped default-tier rule unscoped", () => {
        expect(
            processCss("frak-button-share .button{color:#000!important}")
        ).toBe("frak-button-share .button{color:#000!important}");
    });

    it("drops every rule that follows an unterminated comment", () => {
        expect(
            processCss(
                '.button:hover{opacity:.8}/* frak:style {"bg":"x"}.button{color:red!important}'
            )
        ).toBe(".button:hover{opacity:.8}");
    });

    it("returns an empty string when an unterminated comment is the whole input", () => {
        expect(processCss('/* frak:style {"bg":"x"}')).toBe("");
    });

    it("lets the later of two rules sharing a selector win", () => {
        expect(
            processCss(
                ".button{background:red!important}.button{background:transparent!important}"
            )
        ).toBe(".button{background:0 0!important}");
    });
});

describe("processScopedCss", () => {
    it("compiles a nested rule to a scoped descendant selector", () => {
        expect(
            processScopedCss(".button{color:#000!important}", PLACEMENT_SCOPE)
        ).toBe(
            "frak-button-share[placement=hero] .button{color:#000!important}"
        );
    });

    it("keeps !important through the scoping wrap", () => {
        expect(
            processScopedCss(
                ".button{background:transparent!important}",
                PLACEMENT_SCOPE
            )
        ).toBe(
            "frak-button-share[placement=hero] .button{background:0 0!important}"
        );
    });

    it("keeps the scoped rule intact when a marker comment wraps it", () => {
        expect(
            processScopedCss(
                '/* frak:style {"bg":"transparent"} */.button{background:transparent!important}/* /frak:style */',
                PLACEMENT_SCOPE
            )
        ).toBe(
            "frak-button-share[placement=hero] .button{background:0 0!important}"
        );
    });

    it("lets the later of two scoped rules sharing a selector win", () => {
        expect(
            processScopedCss(
                ".button{background:red!important}.button{background:transparent!important}",
                PLACEMENT_SCOPE
            )
        ).toBe(
            "frak-button-share[placement=hero] .button{background:0 0!important}"
        );
    });

    it("drops every rule that follows an unterminated comment", () => {
        expect(
            processScopedCss(
                '.button:hover{opacity:.8}/* frak:style {"bg":"x"}.button{color:red!important}',
                PLACEMENT_SCOPE
            )
        ).toBe("frak-button-share[placement=hero] .button:hover{opacity:.8}");
    });
});
