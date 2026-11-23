import { describe, expect, it } from "vitest";
import {
    BODY_LIMIT,
    type CiRun,
    classify,
    demote,
    exitAnswer,
    type Facts,
    isTestPath,
    latestRuns,
    mergeTreeConflicts,
    parseChangeset,
    parseLog,
    parseNumstat,
    prRefs,
    REQUIRED_SECTIONS,
    renderContext,
    summarize,
    TITLE_LIMIT,
    unreleasedSection,
    validateBody,
    validateTitle,
} from "./release-pr";

const SHA = "0282b6329aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const facts = { allowedPrs: [500, 502], knownShas: [SHA] };
const validBody = [
    ...REQUIRED_SECTIONS.flatMap((section) => [section, ""]),
    "- [ ] **Deploy.** #500 and `0282b6329` ship.",
].join("\n");

describe("parseLog", () => {
    it("splits records and fields, trimming the body", () => {
        const raw = `${SHA}\x1f0282b6329\x1ffeat: a (#500)\x1f\nbody\n\x1e\n`;
        expect(parseLog(raw)).toEqual([
            {
                sha: SHA,
                hash: "0282b6329",
                subject: "feat: a (#500)",
                body: "body",
            },
        ]);
    });
});

describe("parseNumstat", () => {
    it("reads binary files as zero lines", () => {
        expect(parseNumstat("3\t1\ta.ts\n-\t-\tlogo.png\n")).toEqual([
            { path: "a.ts", added: 3, deleted: 1 },
            { path: "logo.png", added: 0, deleted: 0 },
        ]);
    });
});

describe("isTestPath", () => {
    it.each([
        "apps/wallet/a.test.ts",
        "sdk/components/tests/setup.ts",
        "services/backend/test/api/x.ts",
        "sdk/android/core/src/test/kotlin/A.kt",
        "sdk/ios/Tests/FrakSDKTests/AStub.swift",
        "sdk/ios/Sources/FrakSDKTests.swift",
    ])("counts %s", (path) => {
        expect(isTestPath(path)).toBe(true);
    });

    it("leaves source alone", () => {
        expect(isTestPath("services/backend/src/latest.ts")).toBe(false);
    });
});

describe("summarize", () => {
    it("reports totals with and without bun.lock, and test lines", () => {
        const stats = summarize(
            [
                { path: "bun.lock", added: 10, deleted: 5 },
                { path: "a.ts", added: 4, deleted: 1 },
                { path: "a.test.ts", added: 6, deleted: 0 },
            ],
            5,
            3
        );
        expect(stats).toEqual({
            files: 3,
            added: 20,
            deleted: 6,
            commits: 5,
            nonMerge: 3,
            lockChanged: true,
            withoutLock: { files: 2, added: 10, deleted: 1 },
            testsAdded: 6,
        });
    });
});

describe("classify", () => {
    const ids = (paths: string[]) => classify(paths).map((hit) => hit.id);

    it("splits the wallet into web assets and native", () => {
        expect(
            ids(["packages/wallet-shared/a.ts", "apps/wallet/src-tauri/lib.rs"])
        ).toEqual(["wallet-web", "wallet-native"]);
    });

    it("separates what `shopify app deploy` ships from the app server", () => {
        expect(
            ids([
                "apps/shopify/app/routes/x.tsx",
                "apps/shopify/extensions/theme-components/a.liquid",
                "apps/shopify/shopify.app.production.toml",
            ])
        ).toEqual(["shopify-app", "shopify-extensions"]);
        expect(
            classify(["apps/shopify/shopify.app.production.toml"])[0]?.files
        ).toHaveLength(1);
    });

    it("keeps prod migrations out of the services surface", () => {
        expect(
            ids([
                "services/bootstrap/drizzle/prod/0042_x.sql",
                "services/bootstrap/drizzle/dev/0042_x.sql",
                "services/backend/src/a.ts",
            ])
        ).toEqual(["services", "migrations"]);
    });

    it("ignores unplugged scaffolding and paths no surface owns", () => {
        expect(ids(["plugins/magento/a.php", "docs/plans/x.md"])).toEqual([]);
    });
});

describe("parseChangeset", () => {
    it("reads every bump and the summary", () => {
        const text =
            "---\n\"@frak-labs/components\": minor\n'@frak-labs/core-sdk': patch\n---\n\nPreact 11.\n";
        expect(parseChangeset(".changeset/a.md", text)).toEqual({
            file: ".changeset/a.md",
            bumps: {
                "@frak-labs/components": "minor",
                "@frak-labs/core-sdk": "patch",
            },
            summary: "Preact 11.",
        });
    });

    it("keeps a file without frontmatter as summary only", () => {
        expect(parseChangeset("x.md", "just text").bumps).toEqual({});
    });
});

describe("unreleasedSection", () => {
    it("returns the section up to the next version", () => {
        const log =
            "# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- a\n\n## [1.0.0] - 2026-09-08\n\n- b\n";
        expect(unreleasedSection(log)).toBe("### Fixed\n\n- a");
    });

    it("is empty when nothing is unreleased", () => {
        expect(unreleasedSection("## [Unreleased]\n\n## [1.0.0]\n")).toBe("");
        expect(unreleasedSection("# Changelog\n")).toBe("");
    });
});

describe("prRefs", () => {
    it("finds PR references, not anchors, entities or URL fragments", () => {
        expect(
            prRefs("fix (#502), #500 and #500; a#1 &#123; owner/repo#7")
        ).toEqual([500, 502]);
    });
});

describe("demote", () => {
    it("nests embedded headings under the quoting entry, capped at h6", () => {
        expect(demote("## Why\ntext #1\n#### Deep")).toBe(
            "##### Why\ntext #1\n###### Deep"
        );
    });
});

describe("validateTitle", () => {
    it("accepts the house format", () => {
        expect(
            validateTitle("release: dev → main (Slack top-ups, preact 11)")
        ).toEqual([]);
    });

    it("rejects another prefix, a missing parenthesis, and length", () => {
        expect(validateTitle("Release dev to main")).toEqual([
            'title: must start with "release: dev → main ("',
            'title: must end with ")"',
        ]);
        expect(
            validateTitle(`release: dev → main (${"a".repeat(TITLE_LIMIT)})`)
        ).toEqual([`title: over ${TITLE_LIMIT} characters`]);
    });
});

describe("validateBody", () => {
    it("accepts a body whose references are all collected", () => {
        expect(validateBody(validBody, facts)).toEqual([]);
    });

    it("names each missing section", () => {
        const body = validBody.replace("## Not tested\n", "");
        expect(validateBody(body, facts)).toEqual([
            'body: missing the "## Not tested" heading',
        ]);
    });

    it("rejects a PR or a commit that is not part of the release", () => {
        const body = `${validBody}\n#999 and \`deadbeef1\``;
        expect(validateBody(body, facts)).toEqual([
            "body: #999 appear nowhere in the collected facts",
            "body: deadbeef1 are not commits of this release",
        ]);
    });

    it("requires a checklist item and enforces GitHub's cap", () => {
        const body = validBody.replace("- [ ] ", "- ");
        expect(validateBody(body, facts)).toEqual([
            "body: the merge checklist has no `- [ ]` item",
        ]);
        expect(
            validateBody(`${validBody}\n${"a".repeat(BODY_LIMIT)}`, facts)
        ).toContain(
            `body: ${validBody.length + 1 + BODY_LIMIT} characters, GitHub takes ${BODY_LIMIT}`
        );
    });
});

describe("renderContext", () => {
    const commit = { sha: SHA, hash: "0282b6329", subject: "s", body: "" };
    const base: Facts = {
        base: "origin/main",
        head: "origin/dev",
        baseSha: SHA,
        headSha: SHA,
        mergeBase: commit,
        stats: summarize([], 0, 0),
        commits: [],
        divergence: { commits: [commit], conflicts: ["bun.lock"] },
        versions: [{ name: "wallet", base: "1.1.20", head: null }],
        changesets: [],
        surfaces: [],
        ota: { tag: null, reason: "Unknown." },
        modules: [],
        ci: null,
        pullRequests: [{ number: 1, title: "t", author: "a", body: "## Why" }],
        previous: null,
        allowedPrs: [],
        knownShas: [],
    };

    it("states conflicts, missing versions and unknown facts plainly", () => {
        const text = renderContext(base);
        expect(text).toContain("conflicts in: `bun.lock`");
        expect(text).toContain("| wallet | 1.1.20 | — |");
        expect(text).toContain("None: no Version Packages PR follows");
        expect(text).toContain("Unknown: `gh` unavailable.");
        expect(text).toContain("##### Why");
        expect(text).not.toContain("Previous release PR");
    });
});

describe("exitAnswer", () => {
    it("returns git's yes/no exit status", () => {
        expect(exitAnswer({ status: 0, stdout: "", stderr: "" }, "git q")).toBe(
            0
        );
        expect(exitAnswer({ status: 1, stdout: "", stderr: "" }, "git q")).toBe(
            1
        );
    });

    it("throws on any other status instead of answering no", () => {
        const bad = { status: 128, stdout: "", stderr: "fatal: bad object\n" };
        expect(() => exitAnswer(bad, "git q")).toThrow(
            "git q failed: fatal: bad object"
        );
        const killed = { status: null, stdout: null, stderr: null };
        expect(() => exitAnswer(killed, "git q")).toThrow("exit null");
    });
});

describe("mergeTreeConflicts", () => {
    const tree = "c4e3a25803c0dfedc0792c08ecad1107faaa52d9";

    it("reads a clean merge as no conflict", () => {
        const clean = { status: 0, stdout: `${tree}\n`, stderr: "" };
        expect(mergeTreeConflicts(clean)).toEqual([]);
    });

    it("lists the conflicted paths after the tree id", () => {
        const stdout = `${tree}\napps/wallet/package.json\nbun.lock\n`;
        expect(mergeTreeConflicts({ status: 1, stdout, stderr: "" })).toEqual([
            "apps/wallet/package.json",
            "bun.lock",
        ]);
    });

    it("throws on an exit 1 with no tree id, as for a bad ref", () => {
        const stderr = "merge-tree: nope - not something we can merge\n";
        expect(() =>
            mergeTreeConflicts({ status: 1, stdout: "", stderr })
        ).toThrow("not something we can merge");
    });

    it("throws on a hard error", () => {
        const fatal = { status: 128, stdout: "", stderr: "fatal: shallow" };
        expect(() => mergeTreeConflicts(fatal)).toThrow("fatal: shallow");
    });
});

describe("latestRuns", () => {
    const run = (workflowName: string, status: string): CiRun => ({
        workflowName,
        status,
        conclusion: "",
        url: `https://ci/${workflowName}/${status}`,
    });

    it("keeps each workflow's newest run", () => {
        const runs = [run("CI", "in_progress"), run("CI", "completed")];
        expect(latestRuns(runs)).toEqual([run("CI", "in_progress")]);
    });

    it("drops the workflow collecting the facts", () => {
        const runs = [
            run("🚢 Release PR (dev → main)", "in_progress"),
            run("Deploy", "completed"),
            run("🚢 Release PR (dev → main)", "completed"),
        ];
        expect(latestRuns(runs, "🚢 Release PR (dev → main)")).toEqual([
            run("Deploy", "completed"),
        ]);
    });
});
