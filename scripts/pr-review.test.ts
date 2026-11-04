import { describe, expect, it } from "vitest";
import {
    annotateDiff,
    type Comment,
    type Finding,
    type Github,
    INLINE_MARKER,
    indexDiff,
    MARKER,
    parseAgentReview,
    place,
    postInline,
    REVIEW_MARKER,
    renderInline,
    renderSummary,
    upsertSummary,
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

const BOT = "frak-review[bot]";

const comment = (
    id: number,
    login: string,
    body: string,
    inReplyTo?: number
): Comment => ({
    id,
    body,
    user: { login },
    ...(inReplyTo === undefined ? {} : { in_reply_to_id: inReplyTo }),
});

/** An in-memory PR: the review comments, reviews and conversation comments the script reads and writes. */
function fakePr(state: {
    inline?: Comment[];
    reviews?: Comment[];
    conversation?: Comment[];
    failing?: string;
}) {
    const pr = {
        inline: [...(state.inline ?? [])],
        reviews: [...(state.reviews ?? [])],
        conversation: [...(state.conversation ?? [])],
    };
    let nextId = 1000;
    const replace = (list: Comment[], id: number, body: string) =>
        list.map((c) => (c.id === id ? { ...c, body } : c));
    type Handler = (id: number, body: string) => [number, unknown];
    const routes: [RegExp, Handler][] = [
        [/^GET \/pulls\/1\/comments$/, () => [200, pr.inline]],
        [/^GET \/pulls\/1\/reviews$/, () => [200, pr.reviews]],
        [/^GET \/issues\/1\/comments$/, () => [200, pr.conversation]],
        [
            /^DELETE \/pulls\/comments\/\d+$/,
            (id) => {
                pr.inline = pr.inline.filter((c) => c.id !== id);
                return [204, null];
            },
        ],
        [
            /^PUT \/pulls\/1\/reviews\/\d+$/,
            (id, body) => {
                pr.reviews = replace(pr.reviews, id, body);
                return [200, {}];
            },
        ],
        [
            /^POST \/pulls\/1\/reviews$/,
            (_, body) => {
                pr.reviews.push(comment(nextId++, BOT, body));
                return [200, {}];
            },
        ],
        [
            /^PATCH \/issues\/comments\/\d+$/,
            (id, body) => {
                pr.conversation = replace(pr.conversation, id, body);
                return [200, {}];
            },
        ],
        [
            /^POST \/issues\/1\/comments$/,
            (_, body) => {
                pr.conversation.push(comment(nextId++, BOT, body));
                return [201, {}];
            },
        ],
    ];
    const github: Github = async <T>(path: string, init: RequestInit = {}) => {
        const route = `${init.method ?? "GET"} ${path.split("?")[0]}`;
        const handler = routes.find(([pattern]) => pattern.test(route))?.[1];
        if (!handler) throw new Error(`unexpected ${route}`);
        const body =
            typeof init.body === "string" ? JSON.parse(init.body).body : "";
        const [status, data] =
            route === state.failing
                ? [500, null]
                : handler(Number(route.split("/").pop()), body);
        return { status, data: data as T };
    };
    return { github, pr };
}

describe("postInline", () => {
    const args = {
        pr: "1",
        login: BOT,
        headSha: "bbbbbbbbbb",
        inline: [finding()],
    };

    it("removes the last run's unanswered comments and keeps the answered one and any human's", async () => {
        const { github, pr } = fakePr({
            inline: [
                comment(1, BOT, `${INLINE_MARKER}\nstale`),
                comment(2, BOT, `${INLINE_MARKER}\nanswered`),
                comment(3, "srod", "Agreed, fixing.", 2),
                comment(4, "srod", `${INLINE_MARKER} quoted by a human`),
            ],
        });
        expect(await postInline({ github, ...args })).toBe(true);
        expect(pr.inline.map((c) => c.id)).toEqual([2, 3, 4]);
    });

    it("marks earlier reviews superseded and leaves the new one alone", async () => {
        const { github, pr } = fakePr({
            reviews: [
                comment(10, BOT, `${REVIEW_MARKER}\nreview on aaaaaaa`),
                comment(11, "srod", "LGTM"),
            ],
        });
        await postInline({ github, ...args });
        expect(pr.reviews.map((r) => r.body)).toEqual([
            `${REVIEW_MARKER}\nSuperseded on bbbbbbb. The summary comment holds the current review.`,
            "LGTM",
            `${REVIEW_MARKER}\n🔎 pi review on bbbbbbb: 1 finding on the diff.`,
        ]);
    });

    it("reports a refused review so the caller can fold its findings into the summary", async () => {
        const { github } = fakePr({ failing: "POST /pulls/1/reviews" });
        expect(await postInline({ github, ...args })).toBe(false);
    });

    it("stops before deleting anything when a listing fails", async () => {
        const { github, pr } = fakePr({
            inline: [comment(1, BOT, `${INLINE_MARKER}\nstale`)],
            failing: "GET /pulls/1/reviews",
        });
        await expect(postInline({ github, ...args })).rejects.toThrow(
            "listing /pulls/1/reviews failed"
        );
        expect(pr.inline).toHaveLength(1);
    });
});

describe("upsertSummary", () => {
    it("edits its own summary instead of posting a second one", async () => {
        const { github, pr } = fakePr({
            conversation: [
                comment(5, "srod", `${MARKER} pasted`),
                comment(6, BOT, `${MARKER}\nold`),
            ],
        });
        await upsertSummary({
            github,
            pr: "1",
            login: BOT,
            body: `${MARKER}\nnew`,
        });
        expect(pr.conversation.map((c) => c.body)).toEqual([
            `${MARKER} pasted`,
            `${MARKER}\nnew`,
        ]);
    });

    it("posts the first summary on a fresh PR", async () => {
        const { github, pr } = fakePr({});
        await upsertSummary({
            github,
            pr: "1",
            login: BOT,
            body: `${MARKER}\nfirst`,
        });
        expect(pr.conversation.map((c) => c.body)).toEqual([
            `${MARKER}\nfirst`,
        ]);
    });
});
