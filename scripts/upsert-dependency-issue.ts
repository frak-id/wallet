#!/usr/bin/env bun
/**
 * Creates or updates the one open dependency-report issue. The routine npm bumps
 * are appended here, from the inventory, because the report agent never sees them.
 */
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import type { Delta, Inventory, InventoryItem } from "./dependency/types";

export const REPORT_MARKER = "<!-- frak-dependency-report -->";

/** Stamped into the body so a later run can tell whether anything moved. */
export const FINGERPRINT_PREFIX = "<!-- frak-dependency-fingerprint:";

/** GitHub rejects an issue body longer than this. */
export const ISSUE_BODY_LIMIT = 65_536;

const BODY_SEPARATOR = "\n\n";

const APPENDIX_HEADING = "### 🧾 Routine bumps (no research)";

// ─── Appendix ──────────────────────────────────────────────────────────────

const DELTA_RANK: Record<Delta, number> = {
    major: 0,
    unknown: 1,
    minor: 2,
    patch: 3,
    none: 4,
};

/** The bumps the agent never reads: outdated, and tiered out of research. */
export function appendixItems(inventory: Inventory): InventoryItem[] {
    return inventory.items
        .filter((item) => item.needsUpdate && item.tier === "appendix")
        .sort(
            (a, b) =>
                DELTA_RANK[a.delta] - DELTA_RANK[b.delta] ||
                a.name.localeCompare(b.name)
        );
}

/** A `||` in an npm range would otherwise end the table cell. */
function cell(value: string): string {
    return `\`${value.replace(/\|/g, "\\|")}\``;
}

/** Which workspace owns the edit, or that no single one does. */
export function projectCell(item: InventoryItem): string {
    const projects = item.projects ?? [];
    if (projects.length === 0) return "—";
    if (projects.length === 1) return cell(projects[0] as string);
    return `cross-project (${projects.length})`;
}

function plural(count: number): string {
    return count === 1 ? "" : "s";
}

function renderRow(item: InventoryItem): string {
    const inRange = item.meta?.inRange === "true" ? "↻" : "";
    return `| ${cell(item.name)} | ${projectCell(item)} | ${cell(item.current)} | ${cell(item.latest ?? "?")} | ${item.delta} | ${inRange} |`;
}

function head(total: number): string {
    return [
        APPENDIX_HEADING,
        "",
        "Rendered mechanically from `dependency-inventory.json` — deliberately not researched. ↻ marks a bump already inside the declared range, which `bun install` picks up with no file edit.",
        "",
        "<details>",
        `<summary>${total} routine bump${plural(total)} (minor and patch)</summary>`,
        "",
        "| Package | Project | Current | Latest | Delta | |",
        "|---|---|---|---|---|---|",
    ].join("\n");
}

function assemble(total: number, shown: string[], omitted: number): string {
    const parts = [head(total), ...shown];
    if (omitted > 0) {
        parts.push(
            "",
            `_+${omitted} more routine bump${plural(omitted)} omitted — run \`bun run deps:inventory\` locally for the full list._`
        );
    }
    parts.push("", "</details>");
    return parts.join("\n");
}

/** Degraded form for a budget too small to hold even one table row. */
function countOnly(total: number, budget: number): string {
    const block = [
        APPENDIX_HEADING,
        "",
        `_${total} routine bump${plural(total)} (minor and patch) omitted for space — run \`bun run deps:inventory\` locally for the full list._`,
    ].join("\n");
    return block.length <= budget ? block : "";
}

/**
 * The routine-bump table, within `budget` characters. Truncation drops the
 * lowest-value rows — the sort puts minor before patch — and always closes the
 * `<details>` it opened.
 */
export function renderAppendix(inventory: Inventory, budget: number): string {
    const items = appendixItems(inventory);
    if (items.length === 0) return "";

    const rows = items.map(renderRow);
    const full = assemble(items.length, rows, 0);
    if (full.length <= budget) return full;

    // Length is monotonic in the row count once an omission line is present,
    // so the largest fitting prefix is a binary search.
    let low = 0;
    let high = rows.length - 1;
    let best = 0;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = assemble(
            items.length,
            rows.slice(0, mid),
            rows.length - mid
        );
        if (candidate.length <= budget) {
            best = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    return best > 0
        ? assemble(items.length, rows.slice(0, best), rows.length - best)
        : countOnly(items.length, budget);
}

// ─── Body ──────────────────────────────────────────────────────────────────

/**
 * Everything the report would read differently if it moved. `generatedAt` is
 * excluded on purpose: a run resolving the same versions an hour later must
 * hash the same, or a push-triggered run could never be skipped.
 */
export function fingerprint(inventory: Inventory): string {
    const projection = inventory.items
        .map((item) =>
            [
                item.id,
                item.current,
                item.latest ?? "",
                item.delta,
                item.tier,
                [...item.flags].sort().join(","),
                [...(item.projects ?? [])].sort().join(","),
                item.locations
                    .map((l) => `${l.file}:${l.line}`)
                    .sort()
                    .join(","),
            ].join("\u0000")
        )
        .sort();
    return createHash("sha256")
        .update(projection.join("\n"))
        .digest("hex")
        .slice(0, 16);
}

export function stampOf(inventory: Inventory): string {
    return `${FINGERPRINT_PREFIX} ${fingerprint(inventory)} -->`;
}

/** Null when the body predates the stamp, which counts as moved. */
export function readFingerprint(
    body: string | null | undefined
): string | null {
    const escaped = FINGERPRINT_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`${escaped}\\s*([0-9a-f]+)\\s*-->`).exec(
        body ?? ""
    );
    return match?.[1] ?? null;
}

export type Composed =
    | { ok: true; body: string; appendix: string }
    | { ok: false; error: string };

/** The agent's report with the appendix appended last, so truncation is safe. */
export function composeBody(agentBody: string, inventory: Inventory): Composed {
    const body = agentBody.trim();
    if (!body.includes(REPORT_MARKER)) {
        return {
            ok: false,
            error: `missing the ${REPORT_MARKER} marker — the agent run probably failed or was truncated`,
        };
    }
    const stamp = BODY_SEPARATOR + stampOf(inventory);
    if (body.length + stamp.length > ISSUE_BODY_LIMIT) {
        return {
            ok: false,
            error: `the report alone is ${body.length} chars, over GitHub's ${ISSUE_BODY_LIMIT}-char issue-body limit`,
        };
    }

    const appendix = renderAppendix(
        inventory,
        ISSUE_BODY_LIMIT - body.length - stamp.length - BODY_SEPARATOR.length
    );
    const composed =
        (appendix ? body + BODY_SEPARATOR + appendix : body) + stamp;
    if (composed.length > ISSUE_BODY_LIMIT) {
        return {
            ok: false,
            error: `composed body is ${composed.length} chars after truncation, over the ${ISSUE_BODY_LIMIT}-char limit`,
        };
    }
    return { ok: true, body: composed, appendix };
}

/** One line of history per run; the body above is always the current state. */
export function refreshComment(inventory: Inventory, today: string): string {
    const routine = appendixItems(inventory).length;
    const outdated = inventory.items.filter((item) => item.needsUpdate).length;
    return `♻️ **Refreshed ${today}** — ${outdated} of ${inventory.items.length} tracked dependencies are behind (${outdated - routine} researched, ${routine} routine). The description above holds the full report.`;
}

// ─── Args ──────────────────────────────────────────────────────────────────

export type Args = {
    bodyFile: string;
    inventoryFile: string;
    label: string;
    title: string;
    dryRun: boolean;
    /** Resolve whether the report needs regenerating, then exit without posting. */
    checkChanged: boolean;
    /** Answer the check `true` without asking GitHub. */
    force: boolean;
};

export function parseArgs(argv: string[], today: string): Args {
    // A value starting with `--` means the flag was passed without one.
    const flag = (name: string, fallback: string): string => {
        const index = argv.indexOf(`--${name}`);
        const value = index >= 0 ? argv[index + 1] : undefined;
        return value === undefined || value.startsWith("--") ? fallback : value;
    };
    return {
        bodyFile: flag("body", "dependency-report.md"),
        inventoryFile: flag("inventory", "dependency-inventory.json"),
        label: flag("label", "dependencies"),
        title: flag("title", `📦 Dependency report — week of ${today}`),
        dryRun: argv.includes("--dry-run"),
        checkChanged: argv.includes("--check-changed"),
        force: argv.includes("--force"),
    };
}

// ─── CLI ───────────────────────────────────────────────────────────────────

function die(message: string): never {
    console.error(`❌ ${message}`);
    process.exit(1);
}

function read(file: string, why: string): string {
    try {
        return readFileSync(file, "utf8");
    } catch {
        return die(`${file} is unreadable — ${why}`);
    }
}

function loadInventory(file: string): Inventory {
    const raw = read(file, "the collector step did not run.");
    let parsed: Inventory;
    try {
        parsed = JSON.parse(raw) as Inventory;
    } catch (error) {
        return die(
            `${file} is not valid JSON (${error instanceof Error ? error.message : String(error)}) — the collector wrote a truncated document.`
        );
    }
    if (!Array.isArray(parsed.items)) {
        return die(`${file} has no \`items\` array — it is not an inventory.`);
    }
    return parsed;
}

type GithubIssue = { number: number; body: string | null; html_url: string };

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
                "user-agent": "frak-wallet-dependency-report",
                ...(init.headers ?? {}),
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
            data: text ? (JSON.parse(text) as T) : null,
        };
    };
}

/**
 * The marker, not just the label, so a human-opened issue is never overwritten
 * — `/issues` also returns pull requests.
 */
async function findReportIssue(
    github: Github,
    label: string
): Promise<GithubIssue | undefined> {
    const { data: open } = await github<GithubIssue[]>(
        `/issues?state=open&labels=${encodeURIComponent(label)}&per_page=10`
    );
    return open?.find((issue) => issue.body?.includes(REPORT_MARKER));
}

/** A step output when running under Actions, a readable line either way. */
function emitOutput(name: string, value: string): void {
    console.log(`${name}=${value}`);
    const file = process.env.GITHUB_OUTPUT;
    if (file) appendFileSync(file, `${name}=${value}\n`);
}

async function main(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const {
        bodyFile,
        inventoryFile,
        label,
        title,
        dryRun,
        checkChanged,
        force,
    } = parseArgs(process.argv.slice(2), today);

    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
    const repository = process.env.GITHUB_REPOSITORY ?? "";
    if (!(dryRun || (checkChanged && force)) && (!token || !repository)) {
        die("GITHUB_TOKEN and GITHUB_REPOSITORY are required.");
    }

    const inventory = loadInventory(inventoryFile);

    if (checkChanged) {
        const current = fingerprint(inventory);
        if (force) {
            console.log(`fingerprint ${current} (forced)`);
            emitOutput("changed", "true");
            return;
        }
        const issue = await findReportIssue(
            githubClient(token, repository),
            label
        );
        const posted = readFingerprint(issue?.body);
        console.log(`fingerprint ${current}, issue holds ${posted ?? "none"}`);
        emitOutput("changed", String(posted !== current));
        return;
    }

    const composed = composeBody(
        read(bodyFile, "the report agent wrote nothing."),
        inventory
    );
    if (!composed.ok) {
        die(`${bodyFile}: ${composed.error}; refusing to post.`);
    }
    const { body, appendix } = composed;

    if (dryRun) {
        console.log(`[dry-run] title: ${title}`);
        console.log(`[dry-run] label: ${label}`);
        console.log(
            `[dry-run] body: ${body.length} chars (${appendix.length} appendix)`
        );
        console.log(`[dry-run] ${refreshComment(inventory, today)}`);
        return;
    }

    const github = githubClient(token, repository);

    const existingLabel = await github(`/labels/${encodeURIComponent(label)}`);
    if (existingLabel.status !== 200) {
        await github("/labels", {
            method: "POST",
            body: JSON.stringify({
                name: label,
                color: "0e8a16",
                description: "Automated weekly dependency report",
            }),
        });
    }

    const existing = await findReportIssue(github, label);

    if (!existing) {
        const { data } = await github<GithubIssue>("/issues", {
            method: "POST",
            body: JSON.stringify({ title, body, labels: [label] }),
        });
        console.log(`Opened ${data?.html_url ?? "(unknown url)"}`);
        return;
    }

    await github(`/issues/${existing.number}`, {
        method: "PATCH",
        body: JSON.stringify({ title, body }),
    });
    await github(`/issues/${existing.number}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: refreshComment(inventory, today) }),
    });
    console.log(`Updated ${existing.html_url}`);
}

if (import.meta.main) {
    main().catch((error) => {
        die(`${error}`);
    });
}
