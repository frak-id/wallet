#!/usr/bin/env bun
/**
 * The mobile wallet's store "What's new" text: one `whatsnew-<locale>` file per
 * listing locale, read by r0adkll for Google Play and by `app-store-draft.ts`.
 * `collect` hands the release agent what changed since the live store release;
 * `check` gates the files both stores will receive.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

export const NOTES_DIR = "apps/wallet/store/whatsnew";
export const NOTE_LOCALES = ["en-US", "fr-FR"] as const;
export type NoteLocale = (typeof NOTE_LOCALES)[number];
export type Notes = Record<NoteLocale, string>;

// Counted on the raw file: r0adkll uploads it untrimmed, trailing newline included.
export const PLAY_NOTES_LIMIT = 500;

// What the binary embeds. Backend and SDK changes reach users on their own deploys.
export const APP_PATHS = [
    "apps/wallet",
    "packages/wallet-shared",
    "packages/design-system",
    "packages/app-essentials",
];

const SKIPPED_TYPES = new Set([
    "build",
    "chore",
    "ci",
    "docs",
    "refactor",
    "style",
    "test",
]);
const MARKDOWN = /^#{1,6}\s|\*\*|\]\(/m;
const BODY_LIMIT = 1500;

export type Commit = { hash: string; subject: string; body: string };

export function noteFile(locale: NoteLocale): string {
    return `whatsnew-${locale}`;
}

/** Every `whatsnew-*` file in `dir`, keyed by file name: r0adkll uploads each one. */
export function readNoteFiles(dir: string): Record<string, string> {
    if (!existsSync(dir)) return {};
    const files: Record<string, string> = {};
    for (const name of readdirSync(dir)) {
        if (name.startsWith("whatsnew-")) {
            files[name] = readFileSync(join(dir, name), "utf8");
        }
    }
    return files;
}

export function validateNotes(files: Record<string, string>): string[] {
    const expected = new Set<string>(NOTE_LOCALES.map(noteFile));
    const errors = Object.keys(files)
        .filter((name) => !expected.has(name))
        .map((name) => `${name}: not a listing locale, Play would reject it`);
    for (const locale of NOTE_LOCALES) {
        const name = noteFile(locale);
        const text = files[name];
        if (text === undefined) {
            errors.push(`${name}: missing`);
            continue;
        }
        const length = [...text].length;
        if (text.trim() === "") errors.push(`${name}: empty`);
        if (length > PLAY_NOTES_LIMIT) {
            errors.push(
                `${name}: ${length} characters, Google Play takes ${PLAY_NOTES_LIMIT}`
            );
        }
        if (MARKDOWN.test(text)) {
            errors.push(`${name}: markdown, both stores show plain text`);
        }
    }
    return errors;
}

export function readNotes(dir: string): Notes {
    const files = readNoteFiles(dir);
    const errors = validateNotes(files);
    if (errors.length > 0) {
        throw new Error(
            `Invalid store notes in ${dir}:\n  ${errors.join("\n  ")}`
        );
    }
    return Object.fromEntries(
        NOTE_LOCALES.map((locale) => [locale, files[noteFile(locale)]?.trim()])
    ) as Notes;
}

/** Conventional types that never change what a user sees; a breaking `!` always does. */
export function isUserFacing(subject: string): boolean {
    const match = /^(\w+)(?:\([^)]*\))?(!?):/.exec(subject);
    if (!match) return true;
    return match[2] === "!" || !SKIPPED_TYPES.has(match[1] ?? "");
}

export function parseLog(raw: string): Commit[] {
    return raw
        .split("\x1e")
        .map((record) => record.trim())
        .filter(Boolean)
        .map((record) => {
            const [hash = "", subject = "", body = ""] = record.split("\x1f");
            return { hash, subject, body: body.trim() };
        });
}

function clip(text: string): string {
    return text.length > BODY_LIMIT ? `${text.slice(0, BODY_LIMIT)} […]` : text;
}

export function renderContext(input: {
    version: string;
    base: string;
    commits: Commit[];
    releases: string[];
    previous: Record<string, string>;
}): string {
    const kept = input.commits.filter((c) => isUserFacing(c.subject));
    const lines = [
        `# Frak Wallet ${input.version}: changes since ${input.base}`,
        "",
        `\`${input.base}\` is the release live on both stores. ${kept.length} commits below touched the app; ${input.commits.length - kept.length} build, chore, ci, docs, refactor, style and test commits were left out.`,
        "",
        "## Release PR titles merged since",
        "",
        ...(input.releases.length > 0
            ? input.releases.map((title) => `- ${title}`)
            : ["_none_"]),
        "",
        "## Commits",
        "",
    ];
    for (const commit of kept) {
        lines.push(`### ${commit.hash} ${commit.subject}`, "");
        if (commit.body) lines.push(clip(commit.body), "");
    }
    if (kept.length === 0) lines.push("_none_", "");
    lines.push(
        "## Notes from the previous release PR",
        "",
        "Tone and length reference only. They may describe a release that never went live.",
        ""
    );
    for (const [name, text] of Object.entries(input.previous)) {
        lines.push(`### ${name}`, "", text.trim(), "");
    }
    return `${lines.join("\n").trimEnd()}\n`;
}

function git(args: string[]): string {
    return execFileSync("git", args, {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
    });
}

function collect(options: {
    base: string;
    head: string;
    version: string;
    out: string;
    dir: string;
}): void {
    const range = `${options.base}..${options.head}`;
    const commits = parseLog(
        git([
            "log",
            "--no-merges",
            "--format=%h%x1f%s%x1f%b%x1e",
            range,
            "--",
            ...APP_PATHS,
        ])
    );
    const releases = git([
        "log",
        "--first-parent",
        "--merges",
        "--format=%s",
        range,
    ])
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "" && isUserFacing(line));
    const context = renderContext({
        version: options.version,
        base: options.base,
        commits,
        releases,
        previous: readNoteFiles(options.dir),
    });
    writeFileSync(options.out, context);
    console.log(`✅ ${commits.length} commits in ${range} → ${options.out}`);
}

function die(message: string): never {
    console.error(`❌ ${message}`);
    process.exit(1);
}

if (import.meta.main) {
    const { positionals, values } = parseArgs({
        args: process.argv.slice(2),
        allowPositionals: true,
        options: {
            dir: { type: "string", default: NOTES_DIR },
            base: { type: "string" },
            head: { type: "string", default: "HEAD" },
            version: { type: "string" },
            out: { type: "string" },
        },
    });
    const [command] = positionals;
    if (command === "check") {
        const errors = validateNotes(readNoteFiles(values.dir));
        if (errors.length > 0) die(`${values.dir}:\n  ${errors.join("\n  ")}`);
        console.log(
            `✅ ${values.dir} holds valid ${NOTE_LOCALES.join(" + ")} notes`
        );
    } else if (command === "collect") {
        const { base, version, out } = values;
        if (!base || !version || !out) {
            die("collect needs --base <tag> --version <x.y.z> --out <file>");
        }
        collect({ base, head: values.head, version, out, dir: values.dir });
    } else {
        die(
            "usage: store-notes.ts check [--dir] | collect --base --version --out"
        );
    }
}
