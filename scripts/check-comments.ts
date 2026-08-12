#!/usr/bin/env bun
/**
 * Enforces the comment budget from the root AGENTS.md on Kotlin/Swift, which biome cannot parse.
 * Run: `bun run lint:comments`, or pass explicit paths to scope it to a diff.
 */
import {
    existsSync,
    readdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";

const DEFAULT_ROOTS = [
    "sdk/android/frak-sdk/src",
    "sdk/android/frak-sdk-ui/src",
    "sdk/ios/Sources",
    "sdk/ios/Tests",
    "example/native-android/app/src",
    "example/native-ios/Sources",
];

/** Comment text lines allowed per block; opening and closing delimiters do not count. */
const MAX_CONTENT_LINES = 5;

/** Phrases that turn a comment into a changelog. Word-bounded: "refused to" is not "used to". */
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

/** Where the prose stops and the allowed `@param`/`@return` tail starts. */
const DOC_TAG =
    /^(-\s*(parameters?|returns?|throws?)\b|@(param|returns?|throws))/i;

type Finding = {
    file: string;
    line: number;
    rule: string;
    detail: string;
};

/** TS/TSX are checkable too, but only when a path asks for them — biome already owns that tree. */
const isSource = (f: string) =>
    [".kt", ".swift", ".ts", ".tsx"].some((ext) => f.endsWith(ext));

function walk(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch {
        return out;
    }
    for (const entry of entries) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            if (entry === "build" || entry === ".build") continue;
            walk(full, out);
        } else if (isSource(full)) {
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
        s.startsWith("@Test(")
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

function checkFile(file: string): Finding[] {
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

        for (const phrase of HISTORY_PHRASES) {
            const hit = joined.match(phrase);
            if (hit) {
                findings.push({
                    file,
                    line: at,
                    rule: "narrates-history",
                    detail: `contains "${hit[0]}" — put it in the commit message or docs/plans/**`,
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

const args = process.argv.slice(2);
const roots = args.filter((a) => !a.startsWith("--"));
const files = (roots.length > 0 ? roots : DEFAULT_ROOTS).flatMap((r) =>
    statSync(r, { throwIfNoEntry: false })?.isDirectory() ? walk(r) : [r]
);

const findings = files.flatMap(checkFile);

// Debt that predates the gate, counted per file. A file may only ever get better: touch one and
// its budget is whatever the baseline says, so the number ratchets down and never up.
const baselinePath = "scripts/comment-budget-baseline.json";
const baseline: Record<string, number> = existsSync(baselinePath)
    ? JSON.parse(readFileSync(baselinePath, "utf8"))
    : {};

const counts = new Map<string, number>();
for (const f of findings) counts.set(f.file, (counts.get(f.file) ?? 0) + 1);

if (args.includes("--update-baseline")) {
    const next = Object.fromEntries([...counts].sort());
    writeFileSync(baselinePath, `${JSON.stringify(next, null, 4)}\n`);
    console.log(
        `baseline written: ${counts.size} file(s), ${findings.length} finding(s)`
    );
    process.exit(0);
}

const regressions = findings.filter(
    (f) => (counts.get(f.file) ?? 0) > (baseline[f.file] ?? 0)
);
// Only files this run actually scanned; a scoped run must not report the rest as fixed.
const scanned = new Set(files);
const improved = Object.keys(baseline).filter(
    (f) => scanned.has(f) && (counts.get(f) ?? 0) < baseline[f]
);

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
            (debt > 0 ? ` (${debt} baselined finding(s) left to pay down)` : "")
    );
    process.exit(0);
}

const byRule = new Map<string, number>();
for (const f of regressions) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1);

console.log(
    `\n❌ ${regressions.length} new finding(s): ${[...byRule]
        .map(([r, n]) => `${r}=${n}`)
        .join(", ")}`
);
console.log("Budget lives in AGENTS.md → 'Comments were cut back on purpose'.");
process.exit(1);
