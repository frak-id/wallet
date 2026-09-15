import { describe, expect, it } from "vitest";
import type { ButtonShareStyleValues } from "../types";
import {
    DEFAULT_TIER,
    parseStyleCss,
    serializeStyleCss,
    styleValuesToCssProperties,
    TRANSPARENT,
} from "./styleCodec";

const PLACEMENT_TIER = "product";

const everyControl: ButtonShareStyleValues = {
    bg: TRANSPARENT,
    fg: "#000000",
    bw: 1,
    bc: "#112233",
    fs: 12,
    py: 10,
    px: 24,
    mt: 4,
    mb: 8,
    ml: 12,
    mr: 16,
};

function roundTrip(
    values: ButtonShareStyleValues,
    foreignCss = "",
    tier = PLACEMENT_TIER
) {
    const stored = serializeStyleCss(values, foreignCss, tier) ?? "";
    return parseStyleCss(stored);
}

describe("serializeStyleCss", () => {
    it("emits nothing when no control is set and there is no foreign CSS", () => {
        expect(serializeStyleCss({}, "", PLACEMENT_TIER)).toBeUndefined();
    });

    it("emits only foreign CSS when no control is set", () => {
        expect(
            serializeStyleCss({}, ".button:hover{opacity:.8}", PLACEMENT_TIER)
        ).toBe(".button:hover{opacity:.8}");
    });

    it("emits a declaration only for the controls that are set", () => {
        const out = serializeStyleCss({ fs: 12 }, "", PLACEMENT_TIER) ?? "";
        expect(out).toContain("font-size:12px!important");
        expect(out).not.toContain("background");
        expect(out).not.toContain("color");
        expect(out).not.toContain("margin");
    });

    it("marks every declaration important", () => {
        const out = serializeStyleCss(everyControl, "", PLACEMENT_TIER) ?? "";
        const rule = out.match(/\.button\{([^}]*)\}/);
        expect(rule).not.toBeNull();
        for (const declaration of (rule?.[1] ?? "").split(";")) {
            expect(declaration).toContain("!important");
        }
    });

    it("renders the transparent background token verbatim", () => {
        expect(
            serializeStyleCss({ bg: TRANSPARENT }, "", PLACEMENT_TIER)
        ).toContain("background:transparent!important");
    });

    it("pairs a border width with a border style so the border is visible", () => {
        const out = serializeStyleCss({ bw: 1 }, "", PLACEMENT_TIER) ?? "";
        expect(out).toContain("border-style:solid!important");
        expect(out).toContain("border-width:1px!important");
    });

    it("nests the rule at a placement tier", () => {
        expect(serializeStyleCss({ fs: 12 }, "", PLACEMENT_TIER)).toContain(
            "\n.button{"
        );
    });

    it("self-scopes the rule at the default tier", () => {
        expect(serializeStyleCss({ fs: 12 }, "", DEFAULT_TIER)).toContain(
            "frak-button-share .button{"
        );
    });

    it("emits foreign CSS before the block so the block wins source order", () => {
        const out =
            serializeStyleCss(
                { bg: TRANSPARENT },
                ".button{background:red!important}",
                PLACEMENT_TIER
            ) ?? "";
        expect(out.indexOf("background:red")).toBeLessThan(
            out.indexOf("background:transparent")
        );
    });

    it("drops a value it could not have produced", () => {
        const out = serializeStyleCss(
            { fg: "red; } */ .evil {" } as ButtonShareStyleValues,
            "",
            PLACEMENT_TIER
        );
        expect(out).toBeUndefined();
    });
});

describe("parseStyleCss", () => {
    it("reads back every control exactly as it was written", () => {
        expect(roundTrip(everyControl).values).toEqual(everyControl);
    });

    it("reads unset controls back as unset", () => {
        expect(roundTrip({ fs: 12 }).values).toEqual({ fs: 12 });
    });

    it("keeps a zero border width distinct from an unset one", () => {
        expect(roundTrip({ bw: 0 }).values).toEqual({ bw: 0 });
        expect(roundTrip({}).values.bw).toBeUndefined();
    });

    it("preserves foreign CSS across a round trip", () => {
        const foreign = ".button:hover{opacity:.8}";
        expect(roundTrip(everyControl, foreign).foreignCss).toBe(foreign);
    });

    it("treats CSS appended after the block as foreign on the next round trip", () => {
        const stored = `${serializeStyleCss({ fs: 12 }, "", PLACEMENT_TIER)}\n.button:focus{outline:none}`;
        const parsed = parseStyleCss(stored);
        expect(parsed.values).toEqual({ fs: 12 });
        expect(parsed.foreignCss).toBe(".button:focus{outline:none}");
    });

    it("leaves no declaration behind when a control is cleared between saves", () => {
        const first = serializeStyleCss(
            { fs: 12, bg: TRANSPARENT },
            "",
            PLACEMENT_TIER
        );
        const reopened = parseStyleCss(first);
        const second =
            serializeStyleCss(
                { fs: 12 },
                reopened.foreignCss,
                PLACEMENT_TIER
            ) ?? "";
        expect(second).not.toContain("background");
        expect(parseStyleCss(second).values).toEqual({ fs: 12 });
    });

    it("returns empty values for a string with no marker", () => {
        const stored = ".button{color:red}";
        expect(parseStyleCss(stored)).toEqual({
            values: {},
            foreignCss: stored,
        });
    });

    it("returns empty values for an undefined or empty stored value", () => {
        expect(parseStyleCss(undefined)).toEqual({
            values: {},
            foreignCss: "",
        });
        expect(parseStyleCss("")).toEqual({ values: {}, foreignCss: "" });
    });

    it("treats a malformed payload as foreign CSS", () => {
        const stored = `/* frak:style {"fs": */\n.button{font-size:12px!important}\n/* /frak:style */`;
        expect(parseStyleCss(stored)).toEqual({
            values: {},
            foreignCss: stored,
        });
    });

    it("treats an unterminated marker as foreign CSS", () => {
        const stored = `.button:hover{opacity:.8}\n/* frak:style {"fs":12}\n.button{font-size:12px!important}`;
        expect(parseStyleCss(stored)).toEqual({
            values: {},
            foreignCss: stored,
        });
    });

    it("treats a marker with no closing sentinel as foreign CSS", () => {
        const stored = `/* frak:style {"fs":12} */\n.button{font-size:12px!important}`;
        expect(parseStyleCss(stored)).toEqual({
            values: {},
            foreignCss: stored,
        });
    });

    it("keeps the last marker and treats an earlier one as foreign", () => {
        const first = serializeStyleCss({ fs: 12 }, "", PLACEMENT_TIER);
        const second = serializeStyleCss({ fs: 20 }, "", PLACEMENT_TIER);
        const parsed = parseStyleCss(`${first}\n${second}`);
        expect(parsed.values).toEqual({ fs: 20 });
        expect(parsed.foreignCss).toBe(first);
    });

    it("recovers the newest values when a damaged block precedes them", () => {
        const damaged = `/* frak:style {"bg":"#111111"} */\n.button{background:#111111!important}`;
        const rewritten = serializeStyleCss(
            { bg: "#ff0000" },
            damaged,
            PLACEMENT_TIER
        );

        const parsed = parseStyleCss(rewritten);
        expect(parsed.values).toEqual({ bg: "#ff0000" });
        expect(parsed.foreignCss).toBe(damaged);
    });

    it("ignores an unknown key in an otherwise valid marker", () => {
        const stored = `/* frak:style {"fs":12,"zz":"x"} */\n.button{font-size:12px!important}\n/* /frak:style */`;
        expect(parseStyleCss(stored).values).toEqual({ fs: 12 });
    });
});

describe("styleValuesToCssProperties", () => {
    it("returns the same properties the serializer emits when every control is set", () => {
        expect(styleValuesToCssProperties(everyControl)).toEqual({
            background: TRANSPARENT,
            color: "#000000",
            borderStyle: "solid",
            borderWidth: "1px",
            borderColor: "#112233",
            fontSize: "12px",
            paddingTop: "10px",
            paddingBottom: "10px",
            paddingLeft: "24px",
            paddingRight: "24px",
            marginTop: "4px",
            marginBottom: "8px",
            marginLeft: "12px",
            marginRight: "16px",
        });
    });

    it("returns only the properties for the controls that are set", () => {
        expect(styleValuesToCssProperties({ fs: 12, mt: 4 })).toEqual({
            fontSize: "12px",
            marginTop: "4px",
        });
    });

    it("returns nothing for empty values", () => {
        expect(styleValuesToCssProperties({})).toEqual({});
    });
});
