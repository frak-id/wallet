#!/usr/bin/env bun
/**
 * Enforces the comment budget from the root AGENTS.md across Kotlin, Swift and TS/TSX.
 * Run: `bun run lint:comments`, or pass explicit paths to scope it to a diff.
 */
import { execFileSync } from "node:child_process";
import {
    existsSync,
    readdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";

/** Trees that are installed, emitted or vendored — never authored, so never budgeted. */
const IGNORED_DIRS = new Set([
    "node_modules",
    "build",
    ".build",
    "dist",
    "coverage",
    ".sst",
    ".pulumi",
    ".react-router",
    ".vite",
    ".turbo",
    "drizzle",
]);

/** Emitted TS: route trees, i18n resources and every ambient declaration file. */
const isGenerated = (f: string) => f.endsWith(".gen.ts") || f.endsWith(".d.ts");

/** Comment text lines allowed per block; opening and closing delimiters do not count. */
const MAX_CONTENT_LINES = 5;

/** Phrases that turn a comment into a changelog. Word-bounded, so "refused to" does not match. */
const HISTORY_PHRASES = [
    "used to",
    "no longer",
    "previously",
    "we tried",
    "rejected alternatives?",
    "record of what was checked",
    "not overlooked",
    "papered over",
    "the old",
    "originally",
    "formerly",
    "investigated and rejected",
].map((p) => new RegExp(`\\b${p}\\b`, "i"));

/**
 * A pointer to a document is a dangling reference waiting to happen: the doc moves, the comment
 * does not. A sibling doc shipped alongside the code may be named; a path or a plan document
 * may not — restate the constraint here instead.
 */
const DOC_REFERENCE = /[\w.\-/]*\.md\b/gi;
const COLOCATED_DOC = /^(readme|agents|privacy|changelog|license)\.md$/i;

/** Where the prose stops and the allowed `@param`/`@return` tail starts. */
const DOC_TAG =
    /^(-\s*(parameters?|returns?|throws?)\b|@(param|returns?|throws))/i;

type Finding = {
    file: string;
    line: number;
    rule: string;
    detail: string;
};

const SOURCE_EXTS = [".kt", ".swift", ".ts", ".tsx"];

const isBudgeted = (f: string) =>
    SOURCE_EXTS.some((ext) => f.endsWith(ext)) &&
    !isGenerated(f) &&
    !f.split("/").some((part) => IGNORED_DIRS.has(part));

/** Every tracked or new, non-ignored source file, so a new directory is budgeted by default. */
function repoFiles(): string[] {
    return execFileSync(
        "git",
        [
            "ls-files",
            "-z",
            "-co",
            "--exclude-standard",
            "--",
            ...SOURCE_EXTS.map((ext) => `*${ext}`),
        ],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    )
        .split("\0")
        .filter((f) => f !== "" && isBudgeted(f) && existsSync(f));
}

function walk(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch {
        return out;
    }
    for (const entry of entries) {
        if (IGNORED_DIRS.has(entry)) continue;
        const full = join(dir, entry);
        // A dangling symlink (common under node_modules) throws rather than reporting a
        // type, and an unguarded throw here would abort the whole run.
        const stat = statSync(full, { throwIfNoEntry: false });
        if (!stat) continue;
        if (stat.isDirectory()) {
            walk(full, out);
        } else if (isBudgeted(full)) {
            out.push(full);
        }
    }
    return out;
}

const isCommentLine = (l: string) => {
    const s = l.trim();
    return (
        s.startsWith("//") ||
        s.startsWith("/*") ||
        s.startsWith("*") ||
        s === "*/"
    );
};

/** Strips comment markers so the budget counts prose, not delimiters. */
const commentText = (l: string) =>
    l
        .trim()
        .replace(/^\/\*+/, "")
        .replace(/\*+\/$/, "")
        .replace(/^\/\/+/, "")
        .replace(/^\*+/, "")
        .trim();

const braceDelta = (line: string) =>
    line.split("{").length - line.split("}").length;

/** Lines of code a block sits on: the full braced body when it opens one, else to the next blank. */
function measureCode(lines: string[], start: number): number {
    let end = start;
    while (end < lines.length && lines[end].trim() !== "") end++;

    let depth = 0;
    for (let n = start; n < end; n++) depth += braceDelta(lines[n]);
    if (depth <= 0) return end - start;

    for (let n = end; n < lines.length; n++) {
        depth += braceDelta(lines[n]);
        if (depth <= 0) return n - start + 1;
    }
    return end - start;
}

const isTestDeclaration = (l: string) => {
    const s = l.trim();
    return (
        s.startsWith("@Test") ||
        s.startsWith("@ParameterizedTest") ||
        /^\s*(public\s+)?func test/.test(s) ||
        // Vitest: `it("…"`, `test("…"`, `describe("…"`, plus their `.each`/`.skip` variants.
        /^(it|test|describe)\b[\w.]*\s*[(<]/.test(s)
    );
};

/** The two size rules. A short note over a one-line property is fine; an essay on one is not. */
function budgetFindings(
    file: string,
    line: number,
    prose: number,
    codeLines: number
): Finding[] {
    const out: Finding[] = [];
    if (prose > MAX_CONTENT_LINES) {
        out.push({
            file,
            line,
            rule: "block-too-long",
            detail: `${prose} comment lines (max ${MAX_CONTENT_LINES})`,
        });
    }
    if (codeLines > 0 && prose >= 4 && prose > codeLines) {
        out.push({
            file,
            line,
            rule: "longer-than-code",
            detail: `${prose} comment lines over ${codeLines} lines of code`,
        });
    }
    return out;
}

function docReferenceFindings(
    file: string,
    at: number,
    content: string[]
): Finding[] {
    return (
        content
            .join(" ")
            .match(DOC_REFERENCE)
            ?.filter((ref) => !COLOCATED_DOC.test(ref))
            .map((ref) => ({
                file,
                line: at,
                rule: "references-a-doc",
                detail: `points at "${ref}" — state the constraint here instead`,
            })) ?? []
    );
}

export function checkFile(file: string): Finding[] {
    const lines = readFileSync(file, "utf8").split("\n");
    const findings: Finding[] = [];
    let i = 0;

    while (i < lines.length) {
        if (!isCommentLine(lines[i])) {
            i++;
            continue;
        }
        const start = i;
        while (i < lines.length && isCommentLine(lines[i])) i++;
        const block = lines.slice(start, i);

        // A trailing `//` on a code line is not a block; only own-line comments are budgeted.
        const allContent = block.map(commentText).filter((t) => t.length > 0);

        // `@param`/`- Parameters:` tags are explicitly allowed by the budget, so only the prose
        // ahead of the first tag is counted.
        const firstTag = allContent.findIndex((t) => DOC_TAG.test(t));
        const content =
            firstTag === -1 ? allContent : allContent.slice(0, firstTag);

        // The code the block documents: the whole braced body when it opens one, so a doc on a
        // type is measured against the type, not against its first two fields.
        const codeLines = measureCode(lines, i);

        const at = start + 1;
        const joined = content.join(" ").toLowerCase();

        findings.push(...budgetFindings(file, at, content.length, codeLines));

        findings.push(...docReferenceFindings(file, at, content));

        for (const phrase of HISTORY_PHRASES) {
            const hit = joined.match(phrase);
            if (hit) {
                findings.push({
                    file,
                    line: at,
                    rule: "narrates-history",
                    detail: `contains "${hit[0]}" — put it in the commit message or the plan, not here`,
                });
            }
        }

        if (
            codeLines > 0 &&
            isTestDeclaration(lines[i]) &&
            content.length > 1
        ) {
            findings.push({
                file,
                line: at,
                rule: "doc-on-test",
                detail: "the test name is the documentation",
            });
        }
    }

    return findings;
}

/** A file may only ever get better: more findings than its baseline fail; fewer only ask for a baseline update. */
export function compareToBaseline(
    findings: Finding[],
    baseline: Record<string, number>,
    scanned: Set<string>
) {
    const counts = new Map<string, number>();
    for (const f of findings) counts.set(f.file, (counts.get(f.file) ?? 0) + 1);
    const regressions = findings.filter(
        (f) => (counts.get(f.file) ?? 0) > (baseline[f.file] ?? 0)
    );
    // Only files this run actually scanned; a scoped run must not report the rest as fixed.
    const improved = Object.keys(baseline).filter(
        (f) => scanned.has(f) && (counts.get(f) ?? 0) < baseline[f]
    );
    return { counts, regressions, improved };
}

if (import.meta.main) {
    const args = process.argv.slice(2);
    const roots = args.filter((a) => !a.startsWith("--"));
    const files =
        roots.length > 0
            ? roots.flatMap((r) =>
                  statSync(r, { throwIfNoEntry: false })?.isDirectory()
                      ? walk(r)
                      : [r]
              )
            : repoFiles();

    const findings = files.flatMap(checkFile);

    const baselinePath = "scripts/comment-budget-baseline.json";
    const baseline: Record<string, number> = existsSync(baselinePath)
        ? JSON.parse(readFileSync(baselinePath, "utf8"))
        : {};

    const { counts, regressions, improved } = compareToBaseline(
        findings,
        baseline,
        new Set(files)
    );

    if (args.includes("--update-baseline")) {
        const next = Object.fromEntries([...counts].sort());
        writeFileSync(baselinePath, `${JSON.stringify(next, null, 4)}\n`);
        console.log(
            `baseline written: ${counts.size} file(s), ${findings.length} finding(s)`
        );
        process.exit(0);
    }

    for (const f of regressions.sort(
        (a, b) => a.file.localeCompare(b.file) || a.line - b.line
    )) {
        console.log(`${f.file}:${f.line}  ${f.rule}: ${f.detail}`);
    }
    if (improved.length > 0) {
        console.log(
            `\n${improved.length} file(s) improved past the baseline — run \`bun run lint:comments -- --update-baseline\` to lock it in.`
        );
    }

    if (regressions.length === 0) {
        const debt = findings.length;
        console.log(
            `✅ comment budget clean across ${files.length} files` +
                (debt > 0
                    ? ` (${debt} baselined finding(s) left to pay down)`
                    : "")
        );
        process.exit(0);
    }

    const byRule = new Map<string, number>();
    for (const f of regressions)
        byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1);
    console.log(
        `\n❌ ${regressions.length} new finding(s): ${[...byRule]
            .map(([r, n]) => `${r}=${n}`)
            .join(", ")}`
    );
    console.log("Budget lives in AGENTS.md → 'Comments are on a budget'.");
    process.exit(1);
}
