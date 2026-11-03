import { describe, expect, it } from "vitest";
import {
    isUserFacing,
    PLAY_NOTES_LIMIT,
    parseLog,
    renderContext,
    validateNotes,
} from "./store-notes";

const valid = {
    "whatsnew-en-US": "• Faster sign-in.\n",
    "whatsnew-fr-FR": "• Connexion plus rapide.\n",
};

describe("validateNotes", () => {
    it("accepts one plain-text file per listing locale", () => {
        expect(validateNotes(valid)).toEqual([]);
    });

    it("names a missing locale", () => {
        expect(validateNotes({ "whatsnew-en-US": "x" })).toEqual([
            "whatsnew-fr-FR: missing",
        ]);
    });

    it("rejects a locale the listing does not carry", () => {
        expect(validateNotes({ ...valid, "whatsnew-de-DE": "x" })).toEqual([
            "whatsnew-de-DE: not a listing locale, Play would reject it",
        ]);
    });

    it("counts the raw file, trailing newline included, against the Play cap", () => {
        const atCap = `${"a".repeat(PLAY_NOTES_LIMIT - 1)}\n`;
        expect(validateNotes({ ...valid, "whatsnew-en-US": atCap })).toEqual(
            []
        );
        expect(
            validateNotes({ ...valid, "whatsnew-en-US": `${atCap}a` })
        ).toEqual([
            `whatsnew-en-US: ${PLAY_NOTES_LIMIT + 1} characters, Google Play takes ${PLAY_NOTES_LIMIT}`,
        ]);
    });

    it("counts an accented letter once", () => {
        const text = "é".repeat(PLAY_NOTES_LIMIT);
        expect(validateNotes({ ...valid, "whatsnew-fr-FR": text })).toEqual([]);
    });

    it("rejects whitespace-only and markdown notes", () => {
        expect(
            validateNotes({
                "whatsnew-en-US": " \n",
                "whatsnew-fr-FR": "## Nouveautés\n**Rapide**",
            })
        ).toEqual([
            "whatsnew-en-US: empty",
            "whatsnew-fr-FR: markdown, both stores show plain text",
        ]);
    });
});

describe("isUserFacing", () => {
    it.each([
        ["feat(wallet): game page hero", true],
        ["fix: keep the share sheet working", true],
        ["perf(wallet): lighter home", true],
        ["release: dev → main (OTA reload prompt) (#362)", true],
        ["Merge the hotfix", true],
        ["refactor!: drop the legacy session", true],
        ["chore(mobile): release 1.1.13 (prod) (#363)", false],
        ["build(deps): bump tauri to 2.12.5", false],
        ["docs(wallet): layout rules", false],
        ["ci(wallet): ship OTA from main", false],
    ])("%s → %s", (subject, expected) => {
        expect(isUserFacing(subject)).toBe(expected);
    });
});

describe("parseLog", () => {
    it("splits git's record and field separators, keeping multi-line bodies", () => {
        const raw =
            "abc123\x1ffeat: one\x1fline 1\nline 2\n\x1e\ndef456\x1ffix: two\x1f\x1e\n";
        expect(parseLog(raw)).toEqual([
            { hash: "abc123", subject: "feat: one", body: "line 1\nline 2" },
            { hash: "def456", subject: "fix: two", body: "" },
        ]);
    });
});

describe("renderContext", () => {
    it("drops non-user-facing commits and says how many it dropped", () => {
        const context = renderContext({
            version: "1.1.14",
            base: "app-1.1.12",
            commits: [
                {
                    hash: "a1",
                    subject: "feat(wallet): reload prompt",
                    body: "Why.",
                },
                {
                    hash: "b2",
                    subject: "chore(mobile): release 1.1.13",
                    body: "",
                },
            ],
            releases: ["release: dev → main (reload prompt) (#362)"],
            previous: { "whatsnew-en-US": "• Old notes.\n" },
        });

        expect(context).toContain("### a1 feat(wallet): reload prompt\n\nWhy.");
        expect(context).not.toContain("b2");
        expect(context).toContain("1 build, chore, ci, docs");
        expect(context).toContain(
            "- release: dev → main (reload prompt) (#362)"
        );
        expect(context).toContain("### whatsnew-en-US\n\n• Old notes.");
    });
});
