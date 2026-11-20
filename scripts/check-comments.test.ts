import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkFile, compareToBaseline } from "./check-comments";

const dir = mkdtempSync(join(tmpdir(), "check-comments-"));
let n = 0;
const rulesOf = (source: string) => {
    const file = join(dir, `f${n++}.ts`);
    writeFileSync(file, source);
    return checkFile(file).map((f) => f.rule);
};
const block = (lines: number) => [
    "/**",
    ...Array.from({ length: lines }, (_, i) => ` * line ${i}`),
    " */",
];

describe("checkFile", () => {
    it("accepts a five-line block over a long enough body", () => {
        const body = ["function f() {", ...Array(6).fill("    g();"), "}"];
        expect(rulesOf([...block(5), ...body].join("\n"))).toEqual([]);
    });

    it("flags a block over five lines of prose", () => {
        const body = ["function f() {", ...Array(8).fill("    g();"), "}"];
        expect(rulesOf([...block(6), ...body].join("\n"))).toEqual([
            "block-too-long",
        ]);
    });

    it("does not count the @param tail against the budget", () => {
        const source = [
            "/**",
            " * Adds.",
            " * @param a first",
            " * @param b second",
            " * @param c third",
            " * @param d fourth",
            " * @param e fifth",
            " */",
            "function add(a, b, c, d, e) {",
            "    return a + b + c + d + e;",
            "}",
        ];
        expect(rulesOf(source.join("\n"))).toEqual([]);
    });

    it("flags a block longer than the code under it", () => {
        expect(rulesOf([...block(4), "const x = 1;"].join("\n"))).toEqual([
            "longer-than-code",
        ]);
    });

    it("measures a block against the whole braced body, past blank lines", () => {
        const body = [
            "const o = {",
            "    a: 1,",
            "",
            "    b: 2,",
            "    c: 3,",
            "};",
        ];
        expect(rulesOf([...block(4), ...body].join("\n"))).toEqual([]);
    });

    it("flags history narration", () => {
        expect(
            rulesOf(["// This used to retry.", "retry();"].join("\n"))
        ).toEqual(["narrates-history"]);
    });

    it("flags a pointer to a plan doc but not to a colocated README", () => {
        expect(rulesOf("// See docs/plans/x.md\nf();")).toEqual([
            "references-a-doc",
        ]);
        expect(rulesOf("// See README.md\nf();")).toEqual([]);
    });

    it("flags a multi-line note on a test", () => {
        const source = ["// first", "// second", 'it("works", () => {});'];
        expect(rulesOf(source.join("\n"))).toEqual(["doc-on-test"]);
    });
});

describe("compareToBaseline", () => {
    const finding = (file: string) => ({
        file,
        line: 1,
        rule: "block-too-long",
        detail: "",
    });

    it("reports a file over its baseline as a regression", () => {
        const { regressions, improved } = compareToBaseline(
            [finding("a.ts"), finding("a.ts")],
            { "a.ts": 1 },
            new Set(["a.ts"])
        );
        expect(regressions).toHaveLength(2);
        expect(improved).toEqual([]);
    });

    it("reports a scanned file under its baseline as improved", () => {
        const { regressions, improved } = compareToBaseline(
            [],
            { "a.ts": 1 },
            new Set(["a.ts"])
        );
        expect(regressions).toEqual([]);
        expect(improved).toEqual(["a.ts"]);
    });

    it("ignores baselined files a scoped run did not scan", () => {
        const { improved } = compareToBaseline(
            [],
            { "a.ts": 1 },
            new Set(["b.ts"])
        );
        expect(improved).toEqual([]);
    });
});
