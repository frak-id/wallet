import { appendFileSync, readFileSync } from "node:fs";

export const MARKER = "<!-- pi-pr-review -->";
export const INLINE_MARKER = "<!-- pi-pr-review:inline -->";
export const REVIEW_MARKER = "<!-- pi-pr-review:review -->";

const SEVERITIES = ["blocker", "major", "minor"] as const;
type Severity = (typeof SEVERITIES)[number];

export type Finding = {
    severity: Severity;
    path: string;
    line: number;
    startLine?: number;
    body: string;
    suggestion?: string;
};

export type AgentReview = { note?: string; findings: Finding[] };

/** Right-side line number → hunk index, per file: the only lines GitHub accepts a review comment on. */
export type DiffIndex = Map<string, Map<number, number>>;

type HunkLine = { kind: "add" | "context" | "remove"; right?: number };

type DiffEvent =
    | { kind: "file"; path: string | null }
    | { kind: "hunk"; index: number }
    | { kind: "line"; text: string; hunkLine: HunkLine }
    | { kind: "other"; text: string };

const HUNK_HEADER = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

type Cursor = { oldLeft: number; newLeft: number; right: number; hunk: number };

const HUNK_MARKS: Record<
    string,
    { kind: HunkLine["kind"]; old: number; new: number }
> = {
    "+": { kind: "add", old: 0, new: 1 },
    "-": { kind: "remove", old: 1, new: 0 },
    " ": { kind: "context", old: 1, new: 1 },
};

/** Hunk bodies are consumed by their header counts, so an added `++ x` line is never read as a `+++` header. */
function hunkEvent(text: string, cursor: Cursor): DiffEvent | undefined {
    if (cursor.oldLeft <= 0 && cursor.newLeft <= 0) return undefined;
    if (text.startsWith("\\")) return { kind: "other", text };
    const mark = HUNK_MARKS[text === "" ? " " : text.charAt(0)];
    if (!mark) {
        cursor.oldLeft = 0;
        cursor.newLeft = 0;
        return undefined;
    }
    cursor.oldLeft -= mark.old;
    cursor.newLeft -= mark.new;
    const right = mark.new ? cursor.right++ : undefined;
    return { kind: "line", text, hunkLine: { kind: mark.kind, right } };
}

function headerEvents(text: string, cursor: Cursor): DiffEvent[] {
    const events: DiffEvent[] = [];
    if (text.startsWith("diff --git ")) {
        cursor.hunk = -1;
        events.push({ kind: "file", path: null });
    } else if (text.startsWith("+++ ")) {
        const target = text.slice(4);
        events.push({
            kind: "file",
            path: target.startsWith("b/") ? target.slice(2) : null,
        });
    }
    const header = HUNK_HEADER.exec(text);
    if (header) {
        cursor.oldLeft = Number(header[1] ?? 1);
        cursor.right = Number(header[2]);
        cursor.newLeft = Number(header[3] ?? 1);
        cursor.hunk++;
        events.push({ kind: "hunk", index: cursor.hunk });
    }
    events.push({ kind: "other", text });
    return events;
}

function* walkDiff(diff: string): Generator<DiffEvent> {
    const cursor: Cursor = { oldLeft: 0, newLeft: 0, right: 0, hunk: -1 };
    for (const text of diff.split("\n")) {
        yield* [hunkEvent(text, cursor) ?? headerEvents(text, cursor)].flat();
    }
}

export function indexDiff(diff: string): DiffIndex {
    const index: DiffIndex = new Map();
    let lines: Map<number, number> | undefined;
    let hunk = -1;
    for (const event of walkDiff(diff)) {
        if (event.kind === "file") {
            lines = undefined;
            if (event.path) {
                lines = index.get(event.path) ?? new Map();
                index.set(event.path, lines);
            }
        } else if (event.kind === "hunk") {
            hunk = event.index;
        } else if (
            event.kind === "line" &&
            event.hunkLine.right !== undefined
        ) {
            lines?.set(event.hunkLine.right, hunk);
        }
    }
    return index;
}

/** The diff with each right-side line prefixed by its new-file line number, which is what the agent cites. */
export function annotateDiff(diff: string): string {
    const out: string[] = [];
    for (const event of walkDiff(diff)) {
        if (event.kind === "line") {
            const number = event.hunkLine.right?.toString() ?? "";
            out.push(`${number.padStart(6)} ${event.text}`);
        } else if (event.kind === "other") {
            out.push(event.text);
        }
    }
    return out.join("\n");
}

// ─── Agent output (the boundary) ───────────────────────────────────────────

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSeverity(value: unknown): value is Severity {
    return SEVERITIES.some((severity) => severity === value);
}

function isLine(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function parseFinding(raw: unknown, at: number): Parsed<Finding> {
    const fail = (why: string): Parsed<Finding> => ({
        ok: false,
        error: `findings[${at}]: ${why}`,
    });
    if (!isRecord(raw)) return fail("not an object");
    const { severity, path, line, body } = raw;
    const startLine = raw.startLine ?? undefined;
    const suggestion = raw.suggestion ?? undefined;
    if (!isSeverity(severity))
        return fail(`severity ${JSON.stringify(severity)}`);
    if (typeof path !== "string" || path === "") return fail("path missing");
    if (!isLine(line)) return fail(`line ${JSON.stringify(line)}`);
    if (startLine !== undefined && !(isLine(startLine) && startLine < line)) {
        return fail(
            `startLine ${JSON.stringify(startLine)} is not before line ${line}`
        );
    }
    if (typeof body !== "string" || body.trim() === "")
        return fail("body missing");
    if (suggestion !== undefined && typeof suggestion !== "string") {
        return fail("suggestion is not a string");
    }
    return {
        ok: true,
        value: {
            severity,
            path: path.replace(/^\.\//, ""),
            line,
            ...(startLine === undefined ? {} : { startLine }),
            body: body.trim(),
            ...(suggestion === undefined ? {} : { suggestion }),
        },
    };
}

/** Takes the outermost `{…}`, so a fenced or prefaced answer still parses. */
export function parseAgentReview(text: string): Parsed<AgentReview> {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < start) return { ok: false, error: "no JSON object" };
    let raw: unknown;
    try {
        raw = JSON.parse(text.slice(start, end + 1));
    } catch (error) {
        return { ok: false, error: `invalid JSON: ${String(error)}` };
    }
    if (!isRecord(raw) || !Array.isArray(raw.findings)) {
        return { ok: false, error: "no `findings` array" };
    }
    const findings: Finding[] = [];
    for (const [at, item] of raw.findings.entries()) {
        const parsed = parseFinding(item, at);
        if (!parsed.ok) return parsed;
        findings.push(parsed.value);
    }
    findings.sort(
        (a, b) =>
            SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity)
    );
    const note =
        typeof raw.note === "string" && raw.note.trim()
            ? raw.note.trim()
            : undefined;
    return { ok: true, value: { ...(note ? { note } : {}), findings } };
}

// ─── Placement and rendering ───────────────────────────────────────────────

export type Placed = { inline: Finding[]; outside: Finding[] };

/** Inline only when every cited line sits in one hunk: GitHub rejects the whole review otherwise. */
export function place(findings: Finding[], index: DiffIndex): Placed {
    const placed: Placed = { inline: [], outside: [] };
    for (const finding of findings) {
        const lines = index.get(finding.path);
        const hunk = lines?.get(finding.line);
        const start =
            finding.startLine === undefined
                ? hunk
                : lines?.get(finding.startLine);
        if (hunk !== undefined && start === hunk) placed.inline.push(finding);
        else placed.outside.push(finding);
    }
    return placed;
}

function location(finding: Finding): string {
    const range = finding.startLine
        ? `${finding.startLine}-${finding.line}`
        : `${finding.line}`;
    return `${finding.path}:${range}`;
}

function fenced(info: string, code: string): string {
    const fence = code.includes("```") ? "````" : "```";
    return `${fence}${info}\n${code.replace(/\n$/, "")}\n${fence}`;
}

export function renderInline(finding: Finding): string {
    const parts = [INLINE_MARKER, `**${finding.severity}**: ${finding.body}`];
    if (finding.suggestion !== undefined)
        parts.push(fenced("suggestion", finding.suggestion));
    return parts.join("\n\n");
}

function renderOutside(finding: Finding): string {
    const line = `- **${finding.severity}** \`${location(finding)}\`: ${finding.body}`;
    if (finding.suggestion === undefined) return line;
    return `${line}\n\n${fenced("", finding.suggestion).replace(/^/gm, "  ")}`;
}

function plural(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function renderSummary(args: {
    review: AgentReview;
    placed: Placed;
    footer: string;
}): string {
    const { review, placed, footer } = args;
    const total = placed.inline.length + placed.outside.length;
    const lines = [MARKER, "### 🔎 pi review", ""];
    if (review.note) lines.push(`_${review.note}_`, "");
    if (total === 0) {
        lines.push("No issues found.");
    } else if (placed.outside.length === 0) {
        lines.push(`**${plural(total, "finding")}**, posted on the diff.`);
    } else {
        const where =
            placed.inline.length === 0
                ? "all outside the diff"
                : `${placed.inline.length} on the diff, ${placed.outside.length} outside it`;
        lines.push(`**${plural(total, "finding")}**: ${where}.`, "");
        lines.push(...placed.outside.map(renderOutside));
    }
    lines.push("", `<sub>${footer}</sub>`);
    return lines.join("\n");
}

// ─── GitHub ────────────────────────────────────────────────────────────────

type Comment = {
    id: number;
    body: string | null;
    user: { login: string } | null;
    in_reply_to_id?: number;
};

type Github = <T>(
    path: string,
    init?: RequestInit
) => Promise<{ status: number; data: T | null }>;

function githubClient(token: string, repository: string): Github {
    const api = `https://api.github.com/repos/${repository}`;
    return async <T>(path: string, init: RequestInit = {}) => {
        const response = await fetch(`${api}${path}`, {
            ...init,
            headers: {
                accept: "application/vnd.github+json",
                authorization: `Bearer ${token}`,
                "content-type": "application/json",
                "user-agent": "frak-wallet-pr-review",
            },
        });
        const text = await response.text();
        if (!response.ok) {
            console.error(
                `GitHub ${init.method ?? "GET"} ${path} → ${response.status}`
            );
            console.error(text.slice(0, 500));
        }
        return {
            status: response.status,
            data: response.ok ? parseJson<T>(text) : null,
        };
    };
}

/** An error page from a proxy in front of the API is HTML, not JSON. */
function parseJson<T>(text: string): T | null {
    try {
        return text ? (JSON.parse(text) as T) : null;
    } catch {
        return null;
    }
}

async function listAll<T>(github: Github, path: string): Promise<T[]> {
    const all: T[] = [];
    for (let page = 1; ; page++) {
        const { data } = await github<T[]>(`${path}?per_page=100&page=${page}`);
        all.push(...(data ?? []));
        if (!data || data.length < 100) return all;
    }
}

const SUPERSEDED = "Superseded on";

const ours = (login: string, marker: string) => (comment: Comment) =>
    comment.user?.login === login && (comment.body ?? "").startsWith(marker);

/** Each run converges the PR to this head's review: earlier inline comments go, unless someone replied. */
async function postInline(args: {
    github: Github;
    pr: string;
    login: string;
    headSha: string;
    inline: Finding[];
}): Promise<boolean> {
    const { github, pr, login, headSha, inline } = args;
    const comments = await listAll<Comment>(github, `/pulls/${pr}/comments`);
    const replied = new Set(comments.map((comment) => comment.in_reply_to_id));
    for (const stale of comments.filter(ours(login, INLINE_MARKER))) {
        if (!replied.has(stale.id)) {
            await github(`/pulls/comments/${stale.id}`, { method: "DELETE" });
        }
    }
    const older = (
        await listAll<Comment>(github, `/pulls/${pr}/reviews`)
    ).filter(
        (review) =>
            ours(login, REVIEW_MARKER)(review) &&
            !review.body?.includes(SUPERSEDED)
    );
    const posted =
        inline.length === 0 ||
        (await postReview({ github, pr, headSha, inline }));
    for (const old of older) {
        await github(`/pulls/${pr}/reviews/${old.id}`, {
            method: "PUT",
            body: JSON.stringify({
                body: `${REVIEW_MARKER}\n${SUPERSEDED} ${headSha.slice(0, 7)}. The summary comment holds the current review.`,
            }),
        });
    }
    return posted;
}

async function postReview(args: {
    github: Github;
    pr: string;
    headSha: string;
    inline: Finding[];
}): Promise<boolean> {
    const { github, pr, headSha, inline } = args;
    const { status } = await github(`/pulls/${pr}/reviews`, {
        method: "POST",
        body: JSON.stringify({
            commit_id: headSha,
            event: "COMMENT",
            body: `${REVIEW_MARKER}\n🔎 pi review on ${headSha.slice(0, 7)}: ${plural(inline.length, "finding")} on the diff.`,
            comments: inline.map((finding) => ({
                path: finding.path,
                line: finding.line,
                side: "RIGHT",
                ...(finding.startLine
                    ? { start_line: finding.startLine, start_side: "RIGHT" }
                    : {}),
                body: renderInline(finding),
            })),
        }),
    });
    return status === 200;
}

async function upsertSummary(args: {
    github: Github;
    pr: string;
    login: string;
    body: string;
}): Promise<void> {
    const { github, pr, login, body } = args;
    const comments = await listAll<Comment>(github, `/issues/${pr}/comments`);
    const existing = comments.find(ours(login, MARKER));
    const { status } = existing
        ? await github(`/issues/comments/${existing.id}`, {
              method: "PATCH",
              body: JSON.stringify({ body }),
          })
        : await github(`/issues/${pr}/comments`, {
              method: "POST",
              body: JSON.stringify({ body }),
          });
    if (status >= 300)
        die(`could not post the summary comment (HTTP ${status})`);
}

// ─── CLI ───────────────────────────────────────────────────────────────────

function die(message: string): never {
    console.error(`❌ ${message}`);
    process.exit(1);
}

function flag(argv: string[], name: string): string {
    const value = argv[argv.indexOf(`--${name}`) + 1];
    if (
        !argv.includes(`--${name}`) ||
        value === undefined ||
        value.startsWith("--")
    ) {
        return die(`--${name} is required`);
    }
    return value;
}

function env(name: string): string {
    return process.env[name] || die(`${name} is required`);
}

async function post(argv: string[]): Promise<void> {
    const parsed = parseAgentReview(readFileSync(flag(argv, "review"), "utf8"));
    if (!parsed.ok) die(`the agent's review is unusable: ${parsed.error}`);
    const review = parsed.value;
    const placed = place(
        review.findings,
        indexDiff(readFileSync(flag(argv, "diff"), "utf8"))
    );
    const headSha = env("HEAD_SHA");
    const footer = `${env("MODEL")} on ${headSha.slice(0, 7)} · [run](${env("RUN_URL")}) · updated on each push`;

    if (argv.includes("--dry-run")) {
        console.log(renderSummary({ review, placed, footer }));
        for (const finding of placed.inline) {
            console.log(
                `\n--- inline ${location(finding)}\n${renderInline(finding)}`
            );
        }
        return;
    }

    const github = githubClient(env("GH_TOKEN"), env("GITHUB_REPOSITORY"));
    const pr = env("PR");
    const login = env("BOT_LOGIN");
    const posted = await postInline({
        github,
        pr,
        login,
        headSha,
        inline: placed.inline,
    });
    const final = posted
        ? placed
        : { inline: [], outside: [...placed.inline, ...placed.outside] };
    const body = renderSummary({ review, placed: final, footer });
    await upsertSummary({ github, pr, login, body });

    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) appendFileSync(summary, `${body}\n`);
    console.log(
        `${placed.inline.length} inline (${posted ? "posted" : "folded into the summary"}), ${placed.outside.length} outside the diff`
    );
}

async function main(): Promise<void> {
    const [command, ...argv] = process.argv.slice(2);
    if (command === "annotate") {
        process.stdout.write(
            annotateDiff(readFileSync(flag(argv, "diff"), "utf8"))
        );
    } else if (command === "post") {
        await post(argv);
    } else {
        die(
            "usage: pr-review.ts annotate --diff F | post --diff F --review F [--dry-run]"
        );
    }
}

if (import.meta.main) {
    main().catch((error) => die(String(error)));
}
