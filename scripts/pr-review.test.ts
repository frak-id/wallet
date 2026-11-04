import { describe, expect, it } from "vitest";
import {
    annotateDiff,
    type Finding,
    INLINE_MARKER,
    indexDiff,
    parseAgentReview,
    place,
    renderInline,
    renderSummary,
} from "./pr-review";

const diff = [
    "diff --git a/src/a.ts b/src/a.ts",
    "index 1111111..2222222 100644",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -10,3 +10,4 @@ export function a() {",
    " const x = 1;",
    "-const y = 2;",
    "+const y = 3;",
    "+++counter;",
    " return x;",
    "@@ -40,2 +41,2 @@",
    "-old();",
    "+fresh();",
    " done();",
    "diff --git a/src/gone.ts b/src/gone.ts",
    "deleted file mode 100644",
    "--- a/src/gone.ts",
    "+++ /dev/null",
    "@@ -1 +0,0 @@",
    "-bye();",
    "diff --git a/old/name.ts b/new/name.ts",
    "similarity index 90%",
    "rename from old/name.ts",
    "rename to new/name.ts",
    "--- a/old/name.ts",
    "+++ b/new/name.ts",
    "@@ -1 +1 @@",
    "-a",
    "+b",
    "",
].join("\n");

const finding = (overrides: Partial<Finding> = {}): Finding => ({
    severity: "minor",
    path: "src/a.ts",
    line: 11,
    body: "Wrong value.",
    ...overrides,
});

describe("indexDiff", () => {
    const index = indexDiff(diff);

    it("accepts added and context lines on the right side, not removed ones", () => {
        expect([...(index.get("src/a.ts")?.keys() ?? [])]).toEqual([
            10, 11, 12, 13, 41, 42,
        ]);
    });

    it("reads an added line starting with ++ as code, not a file header", () => {
        expect(index.get("src/a.ts")?.get(12)).toBe(0);
        expect(index.has("+counter;")).toBe(false);
    });

    it("puts each hunk in its own group", () => {
        expect(index.get("src/a.ts")?.get(13)).toBe(0);
        expect(index.get("src/a.ts")?.get(41)).toBe(1);
    });

    it("skips deleted files and keys renames by their new path", () => {
        expect(index.has("src/gone.ts")).toBe(false);
        expect(index.get("new/name.ts")?.get(1)).toBe(0);
        expect(index.has("old/name.ts")).toBe(false);
    });
});

describe("annotateDiff", () => {
    it("prefixes right-side lines with their new-file number and leaves removed lines blank", () => {
        const lines = annotateDiff(diff).split("\n");
        expect(lines).toContain("    11 +const y = 3;");
        expect(lines).toContain("       -const y = 2;");
        expect(lines).toContain("+++ b/src/a.ts");
    });
});

describe("parseAgentReview", () => {
    it("reads a fenced answer and sorts findings by severity", () => {
        const parsed = parseAgentReview(
            '```json\n{"findings":[{"severity":"minor","path":"./a.ts","line":3,"body":"m"},{"severity":"blocker","path":"b.ts","line":1,"body":"b"}]}\n```'
        );
        expect(parsed).toEqual({
            ok: true,
            value: {
                findings: [
                    { severity: "blocker", path: "b.ts", line: 1, body: "b" },
                    { severity: "minor", path: "a.ts", line: 3, body: "m" },
                ],
            },
        });
    });

    it("keeps a note and accepts an empty review", () => {
        expect(
            parseAgentReview('{"note":"Covered src/ only.","findings":[]}')
        ).toEqual({
            ok: true,
            value: { note: "Covered src/ only.", findings: [] },
        });
    });

    it("reads a null optional field as absent", () => {
        expect(
            parseAgentReview(
                '{"findings":[{"severity":"minor","path":"a.ts","line":2,"startLine":null,"body":"x","suggestion":null}]}'
            )
        ).toEqual({
            ok: true,
            value: {
                findings: [
                    { severity: "minor", path: "a.ts", line: 2, body: "x" },
                ],
            },
        });
    });

    it("names the finding that breaks the contract", () => {
        expect(
            parseAgentReview(
                '{"findings":[{"severity":"nit","path":"a.ts","line":1,"body":"x"}]}'
            )
        ).toEqual({ ok: false, error: 'findings[0]: severity "nit"' });
        expect(
            parseAgentReview(
                '{"findings":[{"severity":"minor","path":"a.ts","line":4,"startLine":4,"body":"x"}]}'
            )
        ).toEqual({
            ok: false,
            error: "findings[0]: startLine 4 is not before line 4",
        });
    });

    it("rejects an answer with no JSON object", () => {
        expect(parseAgentReview("No issues found.")).toEqual({
            ok: false,
            error: "no JSON object",
        });
    });
});

describe("place", () => {
    const index = indexDiff(diff);

    it("posts a finding inline when its lines are in one hunk", () => {
        const inRange = finding({ startLine: 10, line: 13 });
        expect(place([finding(), inRange], index)).toEqual({
            inline: [finding(), inRange],
            outside: [],
        });
    });

    it("keeps a finding outside the diff when GitHub would reject its line", () => {
        const removedLine = finding({ line: 20 });
        const acrossHunks = finding({ startLine: 13, line: 41 });
        const untouched = finding({ path: "src/other.ts" });
        expect(place([removedLine, acrossHunks, untouched], index)).toEqual({
            inline: [],
            outside: [removedLine, acrossHunks, untouched],
        });
    });
});

describe("renderInline", () => {
    it("marks the comment and renders a suggestion GitHub can apply", () => {
        expect(renderInline(finding({ suggestion: "const y = 2;\n" }))).toBe(
            `${INLINE_MARKER}\n\n**minor**: Wrong value.\n\n\`\`\`suggestion\nconst y = 2;\n\`\`\``
        );
    });

    it("widens the fence when the suggestion holds one", () => {
        expect(renderInline(finding({ suggestion: "```" }))).toContain(
            "````suggestion\n```\n````"
        );
    });
});

describe("renderSummary", () => {
    const footer = "model on abc1234";

    it("says so when there is nothing to raise", () => {
        expect(
            renderSummary({
                review: { findings: [] },
                placed: { inline: [], outside: [] },
                footer,
            })
        ).toContain("No issues found.");
    });

    it("lists only the findings that could not go on the diff", () => {
        const onDiff = finding();
        const offDiff = finding({
            severity: "major",
            path: "src/other.ts",
            line: 7,
            body: "Off.",
        });
        const body = renderSummary({
            review: { findings: [offDiff, onDiff] },
            placed: { inline: [onDiff], outside: [offDiff] },
            footer,
        });
        expect(body).toContain("**2 findings**: 1 on the diff, 1 outside it.");
        expect(body).toContain("- **major** `src/other.ts:7`: Off.");
        expect(body).not.toContain("Wrong value.");
    });
});
