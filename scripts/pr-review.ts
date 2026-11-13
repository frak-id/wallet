import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

export const MARKER = "<!-- pi-pr-review -->";
export const INLINE_MARKER = "<!-- pi-pr-review:inline -->";
export const REVIEW_MARKER = "<!-- pi-pr-review:review -->";

const SEVERITIES = ["blocker", "major", "minor"] as const;
type Severity = (typeof SEVERITIES)[number];

/** Blocking severities are the only ones that may be posted on the diff and that count toward the verdict. */
const BLOCKS: Record<Severity, boolean> = {
    blocker: true,
    major: true,
    minor: false,
};

export type Finding = {
    severity: Severity;
    path: string;
    line: number;
    startLine?: number;
    body: string;
    suggestion?: string;
};

export type AgentReview = { note?: string; findings: Finding[] };

/** What the next run remembers: the head it reviewed and everything it found there. */
export type ReviewState = { head: string; findings: Finding[] };

/** New-file line numbers added between two heads, per file. */
export type ChangedLines = Map<string, Set<number>>;

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

/** Every hunk line of a file that still exists on the right side, with its path and hunk index. */
function* fileLines(
    diff: string
): Generator<{ path: string; hunk: number; hunkLine: HunkLine }> {
    let path: string | null = null;
    let hunk = -1;
    for (const event of walkDiff(diff)) {
        if (event.kind === "file") path = event.path;
        else if (event.kind === "hunk") hunk = event.index;
        else if (event.kind === "line" && path !== null) {
            yield { path, hunk, hunkLine: event.hunkLine };
        }
    }
}

export function indexDiff(diff: string): DiffIndex {
    const index: DiffIndex = new Map();
    for (const { path, hunk, hunkLine } of fileLines(diff)) {
        if (hunkLine.right === undefined) continue;
        const lines = index.get(path) ?? new Map<number, number>();
        lines.set(hunkLine.right, hunk);
        index.set(path, lines);
    }
    return index;
}

/** The added right-side lines of a diff between two heads, which are the lines the author touched since. */
export function changedLines(delta: string): ChangedLines {
    const changed: ChangedLines = new Map();
    for (const { path, hunkLine } of fileLines(delta)) {
        if (hunkLine.kind !== "add" || hunkLine.right === undefined) continue;
        const lines = changed.get(path) ?? new Set<number>();
        lines.add(hunkLine.right);
        changed.set(path, lines);
    }
    return changed;
}

/** The diff with each right-side line prefixed by its new-file line number, which is what the agent cites. A `*` in place of the space after the number marks an added line that `since` also added. */
export function annotateDiff(diff: string, since?: ChangedLines): string {
    const out: string[] = [];
    let path: string | null = null;
    for (const event of walkDiff(diff)) {
        if (event.kind === "file") {
            path = event.path;
        } else if (event.kind === "line") {
            const { kind, right } = event.hunkLine;
            const fresh =
                kind === "add" &&
                path !== null &&
                right !== undefined &&
                since?.get(path)?.has(right) === true;
            const number = right?.toString() ?? "";
            out.push(`${number.padStart(6)}${fresh ? "*" : " "}${event.text}`);
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

// The agent sometimes cites one line as a range; rejecting it would drop the whole review.
function rangeStart(raw: Record<string, unknown>): unknown {
    return raw.startLine === raw.line
        ? undefined
        : (raw.startLine ?? undefined);
}

function parseFinding(raw: unknown, at: number): Parsed<Finding> {
    const fail = (why: string): Parsed<Finding> => ({
        ok: false,
        error: `findings[${at}]: ${why}`,
    });
    if (!isRecord(raw)) return fail("not an object");
    const { severity, path, line, body } = raw;
    const startLine = rangeStart(raw);
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

function parseJsonValue(text: string): Parsed<unknown> {
    try {
        return { ok: true, value: JSON.parse(text) };
    } catch (error) {
        return { ok: false, error: `invalid JSON: ${String(error)}` };
    }
}

/** Most severe first. */
function parseFindings(items: unknown[]): Parsed<Finding[]> {
    const findings: Finding[] = [];
    for (const [at, item] of items.entries()) {
        const parsed = parseFinding(item, at);
        if (!parsed.ok) return parsed;
        findings.push(parsed.value);
    }
    findings.sort(
        (a, b) =>
            SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity)
    );
    return { ok: true, value: findings };
}

/** Takes the outermost `{…}`, so a fenced or prefaced answer still parses. */
export function parseAgentReview(text: string): Parsed<AgentReview> {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < start) return { ok: false, error: "no JSON object" };
    const raw = parseJsonValue(text.slice(start, end + 1));
    if (!raw.ok) return raw;
    if (!isRecord(raw.value) || !Array.isArray(raw.value.findings)) {
        return { ok: false, error: "no `findings` array" };
    }
    const findings = parseFindings(raw.value.findings);
    if (!findings.ok) return findings;
    const { note: rawNote } = raw.value;
    const note =
        typeof rawNote === "string" && rawNote.trim()
            ? rawNote.trim()
            : undefined;
    return {
        ok: true,
        value: { ...(note ? { note } : {}), findings: findings.value },
    };
}

// ─── State (hidden in the summary comment) ─────────────────────────────────

const STATE_OPEN = "<!-- pi-pr-review:state ";

/** Anchored to the end of the body: a finding's text, which the PR author can steer, can never forge it. */
const STATE_LINE = /<!-- pi-pr-review:state ([A-Za-z0-9+/=]+) -->\s*$/;

/** The head reaches a `git` command line in the workflow. */
const FULL_SHA = /^[0-9a-f]{40}$/;

/** Base64, because a finding's body can contain `-->`. */
export function renderState(state: ReviewState): string {
    return `${STATE_OPEN}${Buffer.from(JSON.stringify(state)).toString("base64")} -->`;
}

/** Anyone with write access can edit the comment, so every field is checked again. */
export function readState(body: string): Parsed<ReviewState> {
    const encoded = STATE_LINE.exec(body)?.[1];
    if (!encoded) return { ok: false, error: "no state line" };
    const raw = parseJsonValue(Buffer.from(encoded, "base64").toString("utf8"));
    if (!raw.ok) return raw;
    const { head, findings: items } = isRecord(raw.value) ? raw.value : {};
    if (typeof head !== "string" || !FULL_SHA.test(head)) {
        return { ok: false, error: "head is not a full commit sha" };
    }
    if (!Array.isArray(items))
        return { ok: false, error: "no `findings` array" };
    const findings = parseFindings(items);
    return findings.ok
        ? { ok: true, value: { head, findings: findings.value } }
        : findings;
}

// ─── Placement and rendering ───────────────────────────────────────────────

export type Placed = {
    inline: Finding[];
    outside: Finding[];
    minor: Finding[];
};

/** A minor goes to the summary. A blocker or major goes inline only when every cited line sits in one hunk: GitHub rejects the whole review otherwise. */
export function place(findings: Finding[], index: DiffIndex): Placed {
    const placed: Placed = { inline: [], outside: [], minor: [] };
    for (const finding of findings) {
        if (!BLOCKS[finding.severity]) {
            placed.minor.push(finding);
            continue;
        }
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

/** An empty suggestion block is how GitHub deletes the lines; a blank line inside would replace them with one. */
function fenced(info: string, code: string): string {
    const longest = Math.max(
        0,
        ...(code.match(/`+/g) ?? []).map((run) => run.length)
    );
    const fence = "`".repeat(Math.max(3, longest + 1));
    const content = code.replace(/\n$/, "");
    return content === ""
        ? `${fence}${info}\n${fence}`
        : `${fence}${info}\n${content}\n${fence}`;
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

function renderVerdict(placed: Placed): string {
    const blocking = placed.inline.length + placed.outside.length;
    if (blocking === 0) return "✅ Nothing blocking: no blocker or major.";
    const where =
        placed.inline.length === 0
            ? "all outside the diff"
            : placed.outside.length === 0
              ? "all posted on the diff"
              : `${placed.inline.length} on the diff, ${placed.outside.length} outside it`;
    return `⛔ ${blocking} blocking (blocker or major): ${where}.`;
}

export function renderSummary(args: {
    review: AgentReview;
    placed: Placed;
    head: string;
    footer: string;
}): string {
    const { review, placed, head, footer } = args;
    const total =
        placed.inline.length + placed.outside.length + placed.minor.length;
    const lines = [MARKER, "### 🔎 pi review", ""];
    if (review.note) lines.push(`_${review.note}_`, "");
    if (total === 0) {
        lines.push("No issues found.");
    } else {
        lines.push(renderVerdict(placed));
    }
    if (placed.outside.length > 0) {
        lines.push("", ...placed.outside.map(renderOutside));
    }
    if (placed.minor.length > 0) {
        lines.push(
            "",
            `<details><summary>${placed.minor.length} minor</summary>`,
            "",
            ...placed.minor.map(renderOutside),
            "",
            "</details>"
        );
    }
    lines.push("", `<sub>${footer}</sub>`, "");
    lines.push(renderState({ head, findings: review.findings }));
    return lines.join("\n");
}

// ─── GitHub ────────────────────────────────────────────────────────────────

export type Comment = {
    id: number;
    body: string | null;
    user: { login: string; type?: string } | null;
    in_reply_to_id?: number;
};

export type Github = <T>(
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
        const { status, data } = await github<T[]>(
            `${path}?per_page=100&page=${page}`
        );
        if (status !== 200 || !data) {
            throw new Error(
                `listing ${path} failed (HTTP ${status}); a partial list would duplicate or orphan comments`
            );
        }
        all.push(...data);
        if (data.length < 100) return all;
    }
}

const SUPERSEDED = "Superseded on";

const ours = (login: string, marker: string) => (comment: Comment) =>
    comment.user?.login === login && (comment.body ?? "").startsWith(marker);

/** Each run converges the PR to this head's review: earlier inline comments go, unless someone replied. */
export async function postInline(args: {
    github: Github;
    pr: string;
    login: string;
    headSha: string;
    inline: Finding[];
}): Promise<boolean> {
    const { github, pr, login, headSha, inline } = args;
    const comments = await listAll<Comment>(github, `/pulls/${pr}/comments`);
    const reviews = await listAll<Comment>(github, `/pulls/${pr}/reviews`);
    const replied = new Set(comments.map((comment) => comment.in_reply_to_id));
    for (const stale of comments.filter(ours(login, INLINE_MARKER))) {
        if (!replied.has(stale.id)) {
            await github(`/pulls/comments/${stale.id}`, { method: "DELETE" });
        }
    }
    const older = reviews.filter(
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

export async function upsertSummary(args: {
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
    if (status >= 300) {
        throw new Error(`could not post the summary comment (HTTP ${status})`);
    }
}

// ─── Memory (what the last round said, and what people answered) ───────────

type Said = { login: string; body: string };

export type History = {
    state: ReviewState;
    /** Our inline comments that a person replied to, with those replies. */
    threads: { finding: string; replies: Said[] }[];
    /** Conversation comments by people, newest last: the only place a summary minor can be answered. */
    conversation: Said[];
};

const MAX_CHARS = 1000;
const MAX_CONVERSATION = 20;

const clip = (text: string) =>
    text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text;

/** `permission` reports `maintain` as `write`. */
const WRITERS = new Set(["admin", "write"]);

/**
 * The commenters, bots and us aside, with write access. The repo is public and the agent's env holds
 * the proxy key. Not `author_association`: it depends on the caller, and our App sees a private org
 * member as `CONTRIBUTOR`.
 */
async function writers(
    github: Github,
    comments: Comment[],
    login: string
): Promise<Set<string>> {
    const logins = new Set(
        comments.flatMap((comment) =>
            comment.user &&
            comment.user.type !== "Bot" &&
            comment.user.login !== login
                ? [comment.user.login]
                : []
        )
    );
    const allowed = new Set<string>();
    for (const who of logins) {
        const { status, data } = await github<{ permission?: string }>(
            `/collaborators/${encodeURIComponent(who)}/permission`
        );
        if (WRITERS.has(data?.permission ?? "")) allowed.add(who);
        else {
            console.error(
                `ignoring comments by ${who}: permission ${data?.permission ?? "unknown"} (HTTP ${status})`
            );
        }
    }
    return allowed;
}

function said(comment: Comment): Said {
    return {
        login: comment.user?.login ?? "unknown",
        body: clip((comment.body ?? "").trim()),
    };
}

/** `undefined` when the PR has no readable state: the run reviews in full. */
export async function loadHistory(args: {
    github: Github;
    pr: string;
    login: string;
}): Promise<History | undefined> {
    const { github, pr, login } = args;
    const conversation = await listAll<Comment>(
        github,
        `/issues/${pr}/comments`
    );
    const summary = conversation.find(ours(login, MARKER));
    if (!summary) {
        console.error("no previous review on this PR");
        return undefined;
    }
    const state = readState(summary.body ?? "");
    if (!state.ok) {
        console.error(`previous review state ignored: ${state.error}`);
        return undefined;
    }
    const inline = await listAll<Comment>(github, `/pulls/${pr}/comments`);
    const allowed = await writers(github, [...conversation, ...inline], login);
    const people = (comment: Comment) =>
        comment.user !== null && allowed.has(comment.user.login);
    const threads = inline
        .filter(ours(login, INLINE_MARKER))
        .map((root) => ({
            finding: clip((root.body ?? "").slice(INLINE_MARKER.length).trim()),
            replies: inline
                .filter((c) => c.in_reply_to_id === root.id && people(c))
                .map(said),
        }))
        .filter((thread) => thread.replies.length > 0);
    return {
        state: state.value,
        threads,
        conversation: conversation
            .filter(people)
            .slice(-MAX_CONVERSATION)
            .map(said),
    };
}

const quote = (text: string) => text.replace(/^/gm, "> ");

/** Quoted, so a comment that looks like a heading or an instruction stays inside its own block. */
function renderSaid(entry: Said): string {
    return `@${entry.login}:\n${quote(entry.body)}`;
}

export function renderHistory(history: History): string {
    const { state, threads, conversation } = history;
    const lines = [
        "## Previous review",
        "",
        `Last reviewed head: \`${state.head}\`. A \`*\` after a line number marks a line added since then.`,
        "",
        "### Previous findings",
        "",
        ...(state.findings.length === 0
            ? ["(none)"]
            : state.findings.map(
                  (f) =>
                      `- **${f.severity}** \`${location(f)}\`: ${f.body.replace(/\n+/g, " ")}`
              )),
    ];
    if (threads.length > 0) {
        lines.push("", "### Answered threads (replies to our inline comments)");
        for (const thread of threads) {
            lines.push(
                "",
                "Our comment:",
                quote(thread.finding),
                ...thread.replies.flatMap((reply) => ["", renderSaid(reply)])
            );
        }
    }
    if (conversation.length > 0) {
        lines.push("", "### Conversation comments");
        for (const entry of conversation) lines.push("", renderSaid(entry));
    }
    return `${lines.join("\n")}\n`;
}

// ─── CLI ───────────────────────────────────────────────────────────────────

function die(message: string): never {
    console.error(`❌ ${message}`);
    process.exit(1);
}

function optionalFlag(argv: string[], name: string): string | undefined {
    const at = argv.indexOf(`--${name}`);
    if (at < 0) return undefined;
    const value = argv[at + 1];
    if (value === undefined || value.startsWith("--")) {
        return die(`--${name} needs a value`);
    }
    return value;
}

function flag(argv: string[], name: string): string {
    return optionalFlag(argv, name) ?? die(`--${name} is required`);
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
        console.log(renderSummary({ review, placed, head: headSha, footer }));
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
    const final: Placed = posted
        ? placed
        : {
              ...placed,
              inline: [],
              outside: [...placed.inline, ...placed.outside],
          };
    const body = renderSummary({
        review,
        placed: final,
        head: headSha,
        footer,
    });
    await upsertSummary({ github, pr, login, body });

    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) appendFileSync(summary, `${body}\n`);
    console.log(
        `${placed.inline.length} inline (${posted ? "posted" : "folded into the summary"}), ${placed.outside.length} outside the diff, ${placed.minor.length} minor`
    );
}

/** Writes the Markdown for the agent to `--out` (empty when there is nothing to remember) and prints the last reviewed head. */
async function history(argv: string[]): Promise<void> {
    const out = flag(argv, "out");
    const loaded = await loadHistory({
        github: githubClient(env("GH_TOKEN"), env("GITHUB_REPOSITORY")),
        pr: env("PR"),
        login: env("BOT_LOGIN"),
    });
    writeFileSync(out, loaded ? renderHistory(loaded) : "");
    if (loaded) console.log(loaded.state.head);
}

async function main(): Promise<void> {
    const [command, ...argv] = process.argv.slice(2);
    if (command === "annotate") {
        const since = optionalFlag(argv, "since");
        process.stdout.write(
            annotateDiff(
                readFileSync(flag(argv, "diff"), "utf8"),
                since === undefined
                    ? undefined
                    : changedLines(readFileSync(since, "utf8"))
            )
        );
    } else if (command === "post") {
        await post(argv);
    } else if (command === "history") {
        await history(argv);
    } else {
        die(
            "usage: pr-review.ts annotate --diff F [--since F] | history --out F | post --diff F --review F [--dry-run]"
        );
    }
}

if (import.meta.main) {
    main().catch((error) => die(String(error)));
}
