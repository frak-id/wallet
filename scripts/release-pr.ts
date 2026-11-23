#!/usr/bin/env bun
/**
 * The dev → main release PR. `collect` gathers every fact the release agent may state
 * (range, stats, divergence, versions, changesets, surfaces, OTA safety, CI, PR bodies)
 * into a context file and a facts JSON; `check` gates the title and body it wrote.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { APP_PATHS } from "./store-notes";

export const TITLE_PREFIX = "release: dev → main (";
export const TITLE_LIMIT = 256;
// GitHub refuses a PR body past 65 536 characters.
export const BODY_LIMIT = 65_536;
export const REQUIRED_SECTIONS = [
    "## Summary",
    "## Divergence from `main`",
    "## ⚠️ Merge checklist",
    "## Changes",
    "## Not tested",
];

const COMMIT_BODY_LIMIT = 1500;
const PR_BODY_LIMIT = 4000;
const PREVIOUS_BODY_LIMIT = 16_000;
const FILES_PER_SURFACE = 25;

export type Commit = {
    sha: string;
    hash: string;
    subject: string;
    body: string;
};
export type FileStat = { path: string; added: number; deleted: number };
export type DiffTotals = { files: number; added: number; deleted: number };
export type RangeStats = DiffTotals & {
    commits: number;
    nonMerge: number;
    lockChanged: boolean;
    withoutLock: DiffTotals;
    testsAdded: number;
};
export type SurfaceHit = {
    id: string;
    label: string;
    follow: string;
    files: string[];
};
export type Changeset = {
    file: string;
    bumps: Record<string, string>;
    summary: string;
};
export type VersionRow = {
    name: string;
    base: string | null;
    head: string | null;
};
export type ModuleRelease = {
    label: string;
    workflow: string;
    latestTag: string | null;
    changedInRange: boolean;
    unreleased: string;
};
export type OtaReport =
    | {
          tag: string;
          nativeFiles: string[];
          guestBumps: string[];
          webChanged: boolean;
      }
    | { tag: string | null; reason: string };
export type CiRun = {
    workflowName: string;
    status: string;
    conclusion: string;
    url: string;
};
export type PullRequest = {
    number: number;
    title: string;
    author: string;
    body: string;
};
export type Facts = {
    base: string;
    head: string;
    baseSha: string;
    headSha: string;
    mergeBase: Commit;
    stats: RangeStats;
    commits: Commit[];
    divergence: { commits: Commit[]; conflicts: string[] };
    versions: VersionRow[];
    changesets: Changeset[];
    surfaces: SurfaceHit[];
    ota: OtaReport;
    modules: ModuleRelease[];
    ci: CiRun[] | null;
    pullRequests: PullRequest[];
    previous: PullRequest | null;
    allowedPrs: number[];
    knownShas: string[];
};

type SurfaceRule = Omit<SurfaceHit, "files"> & {
    match: (path: string) => boolean;
};

const WALLET_WEB = APP_PATHS.map((path) => `${path}/`);
const JS_SDK = /^(sdk\/(core|react|components|legacy)|packages\/rpc)\//;
const SHOPIFY_DEPLOYED =
    /^apps\/shopify\/(extensions\/|shopify\.app\.[^/]+\.toml$)/;

export const SURFACES: SurfaceRule[] = [
    {
        id: "services",
        label: "Backend services",
        follow: "Ships with the gcp-production deploy.",
        match: (p) =>
            p.startsWith("services/") && !p.startsWith("services/bootstrap/"),
    },
    {
        id: "migrations",
        label: "Backend DB migrations (prod)",
        follow: "The migration job runs before the backend pods roll; the old pods must survive the new schema.",
        match: (p) =>
            p.startsWith("services/bootstrap/drizzle/prod/") &&
            p.endsWith(".sql"),
    },
    {
        id: "infra",
        label: "Infra",
        follow: "Applied by the production deploy: new env vars and secrets must exist on gcp-production first.",
        match: (p) => p.startsWith("infra/") || p === "sst.config.ts",
    },
    {
        id: "wallet-web",
        label: "Wallet web assets",
        follow: "Web wallet at the deploy; installed apps only through an OTA or a store release.",
        match: (p) =>
            WALLET_WEB.some((prefix) => p.startsWith(prefix)) &&
            !p.startsWith("apps/wallet/src-tauri/"),
    },
    {
        id: "wallet-native",
        label: "Wallet native (src-tauri)",
        follow: "Installed apps only through a store release.",
        match: (p) => p.startsWith("apps/wallet/src-tauri/"),
    },
    {
        id: "listener",
        label: "Listener",
        follow: "Ships with the deploy.",
        match: (p) => p.startsWith("apps/listener/"),
    },
    {
        id: "business",
        label: "Business dashboard",
        follow: "Ships with the deploy.",
        match: (p) => p.startsWith("apps/business/"),
    },
    {
        id: "shopify-app",
        label: "Shopify app server",
        follow: "Ships with the deploy.",
        match: (p) =>
            p.startsWith("apps/shopify/") && !SHOPIFY_DEPLOYED.test(p),
    },
    {
        id: "shopify-extensions",
        label: "Shopify extensions / app TOML",
        follow: "Reaches shops only with `shopify app deploy` (`bun run --cwd apps/shopify shopify:deploy:prod`).",
        match: (p) => SHOPIFY_DEPLOYED.test(p),
    },
    {
        id: "sdk-js",
        label: "JS SDK (npm + CDN)",
        follow: "Reaches merchants only through the Version Packages PR.",
        match: (p) => JS_SDK.test(p),
    },
    {
        id: "sdk-android",
        label: "Android SDK",
        follow: "Maven Central only through Release Android SDK (`android-v*` tag).",
        match: (p) => p.startsWith("sdk/android/"),
    },
    {
        id: "sdk-ios",
        label: "iOS SDK",
        follow: "SwiftPM mirror only through Release iOS SDK (`ios-v*` tag).",
        match: (p) => p.startsWith("sdk/ios/"),
    },
    {
        id: "plugins",
        label: "PHP plugins",
        follow: "Merchants only through Release PHP Plugins.",
        match: (p) => /^plugins\/(wordpress|prestashop)\//.test(p),
    },
    {
        id: "examples",
        label: "Examples",
        follow: "The `example` stage deploy; native harnesses through Release Native Example Apps.",
        match: (p) => p.startsWith("example/"),
    },
    {
        id: "ci",
        label: "CI workflows",
        follow: "Takes effect on `main` at the merge.",
        match: (p) => p.startsWith(".github/"),
    },
];

const VERSIONED: [string, string][] = [
    ["wallet", "apps/wallet/package.json"],
    ["@frak-labs/core-sdk", "sdk/core/package.json"],
    ["@frak-labs/react-sdk", "sdk/react/package.json"],
    ["@frak-labs/components", "sdk/components/package.json"],
    ["@frak-labs/frame-connector", "packages/rpc/package.json"],
    ["@frak-labs/nexus-sdk", "sdk/legacy/package.json"],
];

const MODULES = [
    {
        label: "Android SDK",
        workflow: "release-android-sdk.yml",
        dir: "sdk/android/",
        tagPrefix: "android-v",
    },
    {
        label: "iOS SDK",
        workflow: "release-ios-sdk.yml",
        dir: "sdk/ios/",
        tagPrefix: "ios-v",
    },
    {
        label: "WordPress plugin",
        workflow: "release-php-plugins.yml",
        dir: "plugins/wordpress/",
        tagPrefix: "wordpress-",
    },
    {
        label: "PrestaShop module",
        workflow: "release-php-plugins.yml",
        dir: "plugins/prestashop/",
        tagPrefix: "prestashop-",
    },
];

// The JS half of a Tauri plugin is versioned with its native half.
const GUEST_BUMP = /^[-+][^-+].*(@tauri-apps\/|@crabnebula\/|tauri-plugin-)/;

export function parseLog(raw: string): Commit[] {
    return raw
        .split("\x1e")
        .map((record) => record.trim())
        .filter(Boolean)
        .map((record) => {
            const [sha = "", hash = "", subject = "", body = ""] =
                record.split("\x1f");
            return { sha, hash, subject, body: body.trim() };
        });
}

export function parseNumstat(raw: string): FileStat[] {
    return raw
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => {
            const [added = "0", deleted = "0", ...rest] = line.split("\t");
            return {
                path: rest.join("\t"),
                added: Number.parseInt(added, 10) || 0,
                deleted: Number.parseInt(deleted, 10) || 0,
            };
        });
}

export function isTestPath(path: string): boolean {
    return (
        /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) ||
        /(^|\/)(__tests__|tests?|Tests|androidTest)\//.test(path) ||
        /Tests?\.(kt|swift)$/.test(path)
    );
}

function totals(stats: FileStat[]): DiffTotals {
    return {
        files: stats.length,
        added: stats.reduce((sum, s) => sum + s.added, 0),
        deleted: stats.reduce((sum, s) => sum + s.deleted, 0),
    };
}

export function summarize(
    stats: FileStat[],
    commits: number,
    nonMerge: number
): RangeStats {
    const withoutLock = stats.filter((s) => s.path !== "bun.lock");
    return {
        ...totals(stats),
        commits,
        nonMerge,
        lockChanged: withoutLock.length !== stats.length,
        withoutLock: totals(withoutLock),
        testsAdded: stats
            .filter((s) => isTestPath(s.path))
            .reduce((sum, s) => sum + s.added, 0),
    };
}

export function classify(paths: string[]): SurfaceHit[] {
    return SURFACES.map(({ match, ...rule }) => ({
        ...rule,
        files: paths.filter(match),
    })).filter((hit) => hit.files.length > 0);
}

export function parseChangeset(file: string, text: string): Changeset {
    const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(
        text.replace(/\r\n/g, "\n")
    );
    if (!match) return { file, bumps: {}, summary: text.trim() };
    const bumps: Record<string, string> = {};
    for (const line of (match[1] ?? "").split("\n")) {
        const entry =
            /^\s*["']?([^"':]+)["']?\s*:\s*(major|minor|patch)\s*$/.exec(line);
        if (entry?.[1] && entry[2]) bumps[entry[1]] = entry[2];
    }
    return { file, bumps, summary: (match[2] ?? "").trim() };
}

export function unreleasedSection(changelog: string): string {
    const lines = changelog.split("\n");
    const start = lines.findIndex((line) => /^## \[Unreleased\]/i.test(line));
    if (start === -1) return "";
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((line) => line.startsWith("## "));
    return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
}

export function prRefs(text: string): number[] {
    const refs = new Set<number>();
    for (const match of text.matchAll(/(?<![\w&/])#(\d{1,6})\b/g)) {
        refs.add(Number(match[1]));
    }
    return [...refs].sort((a, b) => a - b);
}

export function validateTitle(title: string): string[] {
    const errors: string[] = [];
    if (title.includes("\n")) errors.push("title: must be a single line");
    if (!title.startsWith(TITLE_PREFIX)) {
        errors.push(`title: must start with "${TITLE_PREFIX}"`);
    }
    if (!title.endsWith(")")) errors.push('title: must end with ")"');
    if ([...title].length > TITLE_LIMIT) {
        errors.push(`title: over ${TITLE_LIMIT} characters`);
    }
    return errors;
}

export function validateBody(
    body: string,
    facts: Pick<Facts, "allowedPrs" | "knownShas">
): string[] {
    const errors = REQUIRED_SECTIONS.filter(
        (section) => !body.split("\n").some((line) => line.trim() === section)
    ).map((section) => `body: missing the "${section}" heading`);
    if (body.length > BODY_LIMIT) {
        errors.push(
            `body: ${body.length} characters, GitHub takes ${BODY_LIMIT}`
        );
    }
    if (!/^- \[[ x]\] /m.test(body)) {
        errors.push("body: the merge checklist has no `- [ ]` item");
    }
    const allowed = new Set(facts.allowedPrs);
    const unknownPrs = prRefs(body).filter((n) => !allowed.has(n));
    if (unknownPrs.length > 0) {
        errors.push(
            `body: ${unknownPrs.map((n) => `#${n}`).join(", ")} appear nowhere in the collected facts`
        );
    }
    const unknownShas = [...body.matchAll(/`([0-9a-f]{7,40})`/g)]
        .map((m) => m[1] ?? "")
        .filter((hash) => !facts.knownShas.some((sha) => sha.startsWith(hash)));
    if (unknownShas.length > 0) {
        errors.push(
            `body: ${[...new Set(unknownShas)].join(", ")} are not commits of this release`
        );
    }
    return errors;
}

function clip(text: string, limit: number): string {
    return text.length > limit ? `${text.slice(0, limit)} […]` : text;
}

/** Pushes embedded markdown headings under the `###` entry that quotes them. */
export function demote(text: string): string {
    return text.replace(
        /^(#{1,6}) /gm,
        (_, hashes: string) => `${"#".repeat(Math.min(6, hashes.length + 3))} `
    );
}

function embed(text: string, limit: number): string {
    return demote(clip(text, limit));
}

function fmt(n: number): string {
    return n.toLocaleString("en-US");
}

function renderStats(facts: Facts): string[] {
    const { stats, mergeBase } = facts;
    return [
        "## Range",
        "",
        `- \`${facts.base}\` at \`${facts.baseSha.slice(0, 9)}\`, \`${facts.head}\` at \`${facts.headSha.slice(0, 9)}\``,
        `- Merge base (the "since"): \`${mergeBase.hash}\` ${mergeBase.subject}`,
        `- ${fmt(stats.commits)} commits (${fmt(stats.nonMerge)} non-merge), ${fmt(stats.files)} files, +${fmt(stats.added)} / −${fmt(stats.deleted)}`,
        stats.lockChanged
            ? `- Without \`bun.lock\`: ${fmt(stats.withoutLock.files)} files, +${fmt(stats.withoutLock.added)} / −${fmt(stats.withoutLock.deleted)}`
            : "- `bun.lock` is unchanged",
        `- Test files account for +${fmt(stats.testsAdded)} of the added lines`,
        "",
    ];
}

function renderDivergence(facts: Facts): string[] {
    const { commits, conflicts } = facts.divergence;
    if (commits.length === 0) {
        return [
            "## Divergence",
            "",
            "None: `main` is an ancestor of `dev`.",
            "",
        ];
    }
    return [
        "## Divergence",
        "",
        `\`main\` has ${commits.length} commits \`dev\` lacks:`,
        "",
        ...commits.map((c) => `- \`${c.hash}\` ${c.subject}`),
        "",
        conflicts.length === 0
            ? "A trial merge of `dev` into `main` is clean."
            : `A trial merge of \`dev\` into \`main\` conflicts in: ${conflicts.map((f) => `\`${f}\``).join(", ")}. The PR cannot merge until \`main\` is merged into \`dev\`.`,
        "",
    ];
}

function renderVersions(facts: Facts): string[] {
    return [
        "## Versions",
        "",
        "| package | main | dev |",
        "|---|---|---|",
        ...facts.versions.map(
            (v) => `| ${v.name} | ${v.base ?? "—"} | ${v.head ?? "—"} |`
        ),
        "",
        "## Pending changesets",
        "",
        ...(facts.changesets.length === 0
            ? ["None: no Version Packages PR follows this merge.", ""]
            : facts.changesets.flatMap((c) => [
                  `### ${c.file}: ${Object.entries(c.bumps)
                      .map(([name, bump]) => `${name} ${bump}`)
                      .join(", ")}`,
                  "",
                  embed(c.summary, COMMIT_BODY_LIMIT),
                  "",
              ])),
    ];
}

function renderSurfaces(facts: Facts): string[] {
    const lines = ["## Surfaces touched (merge base → dev)", ""];
    if (facts.surfaces.length === 0) lines.push("_none_", "");
    for (const hit of facts.surfaces) {
        const shown = hit.files.slice(0, FILES_PER_SURFACE);
        lines.push(
            `### ${hit.label} (${hit.files.length} files)`,
            "",
            `Follow-up: ${hit.follow}`,
            "",
            ...shown.map((f) => `- \`${f}\``),
            ...(hit.files.length > shown.length
                ? [`- … and ${hit.files.length - shown.length} more`]
                : []),
            ""
        );
    }
    return lines;
}

function renderOta(ota: OtaReport): string[] {
    const lines = ["## Wallet OTA (`Ship Wallet OTA` guard, simulated)", ""];
    if ("reason" in ota) return [...lines, ota.reason, ""];
    const verdict =
        ota.nativeFiles.length === 0 && ota.guestBumps.length === 0
            ? "OTA-safe: no native change since the live store release."
            : "Not OTA-safe without `allow_native_diff`: native changes since the live store release.";
    return [
        ...lines,
        `Live store release: \`${ota.tag}\`. ${ota.webChanged ? verdict : "Nothing to ship: web assets are identical to the store release."}`,
        "",
        ...ota.nativeFiles.map((f) => `- native: \`${f}\``),
        ...ota.guestBumps.map((line) => `- plugin package: \`${line}\``),
        "",
    ];
}

function renderModules(facts: Facts): string[] {
    return [
        "## Modules released outside the deploy",
        "",
        ...facts.modules.flatMap((m) => [
            `### ${m.label} (latest tag ${m.latestTag ? `\`${m.latestTag}\`` : "unknown"}, workflow \`${m.workflow}\`)`,
            "",
            `Changed in this range: ${m.changedInRange ? "yes" : "no"}. \`[Unreleased]\` ${m.unreleased ? "holds:" : "is empty."}`,
            "",
            ...(m.unreleased ? [embed(m.unreleased, PR_BODY_LIMIT), ""] : []),
        ]),
    ];
}

function renderCi(facts: Facts): string[] {
    if (facts.ci === null) {
        return ["## CI on the dev head", "", "Unknown: `gh` unavailable.", ""];
    }
    return [
        "## CI on the dev head",
        "",
        ...(facts.ci.length === 0
            ? ["No workflow run for this commit."]
            : facts.ci.map(
                  (r) =>
                      `- ${r.workflowName}: ${r.status}${r.conclusion ? ` / ${r.conclusion}` : ""} (${r.url})`
              )),
        "",
    ];
}

function renderHistory(facts: Facts): string[] {
    const lines = ["## Commits (non-merge, oldest first)", ""];
    for (const c of facts.commits) {
        lines.push(`### ${c.hash} ${c.subject}`, "");
        if (c.body) lines.push(embed(c.body, COMMIT_BODY_LIMIT), "");
    }
    lines.push("## Pull requests merged into dev in this range", "");
    if (facts.pullRequests.length === 0) lines.push("_none_", "");
    for (const pr of facts.pullRequests) {
        lines.push(
            `### #${pr.number} ${pr.title} (@${pr.author})`,
            "",
            embed(pr.body, PR_BODY_LIMIT) || "_no body_",
            ""
        );
    }
    return lines;
}

function renderPrevious(previous: PullRequest | null): string[] {
    if (!previous) return [];
    return [
        "## Previous release PR (structure and tone reference ONLY)",
        "",
        "Never carry a fact, a number, a PR or a checklist item over from it.",
        "",
        `### ${previous.title}`,
        "",
        embed(previous.body, PREVIOUS_BODY_LIMIT),
        "",
    ];
}

export function renderContext(facts: Facts): string {
    return `${[
        "# Release dev → main: collected facts",
        "",
        "Collected by `scripts/release-pr.ts collect`. Every number here is exact: copy it, never recompute it.",
        "",
        ...renderStats(facts),
        ...renderDivergence(facts),
        ...renderVersions(facts),
        ...renderSurfaces(facts),
        ...renderOta(facts.ota),
        ...renderModules(facts),
        ...renderCi(facts),
        ...renderHistory(facts),
        ...renderPrevious(facts.previous),
    ]
        .join("\n")
        .trimEnd()}\n`;
}

function git(args: string[]): string {
    return execFileSync("git", args, {
        encoding: "utf8",
        maxBuffer: 256 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
    });
}

function lines(raw: string): string[] {
    return raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
}

type Spawned = {
    status: number | null;
    stdout: string | null;
    stderr: string | null;
};

function failed(command: string, result: Spawned): Error {
    const detail = result.stderr?.trim() || `exit ${result.status}`;
    return new Error(`${command} failed: ${detail}`);
}

// Git answers a yes/no query with exit 0 or 1: any other status is an error, never a "no".
export function exitAnswer(result: Spawned, command: string): 0 | 1 {
    if (result.status === 0 || result.status === 1) return result.status;
    throw failed(command, result);
}

// `git merge-tree` also exits 1 on a bad ref: only a tree id on line 1 proves the merge ran.
export function mergeTreeConflicts(result: Spawned): string[] {
    const [tree = "", ...paths] = lines(result.stdout ?? "");
    const status = exitAnswer(result, "git merge-tree");
    if (!/^[0-9a-f]{40,64}$/.test(tree)) throw failed("git merge-tree", result);
    return status === 1 ? paths : [];
}

// Newest first: each workflow's latest run, minus the workflow collecting these facts.
export function latestRuns(runs: CiRun[], running?: string): CiRun[] {
    const latest = new Map<string, CiRun>();
    for (const run of runs) {
        if (run.workflowName === running || latest.has(run.workflowName)) {
            continue;
        }
        latest.set(run.workflowName, run);
    }
    return [...latest.values()];
}

function gitAnswer(args: string[]): 0 | 1 {
    const result = spawnSync("git", args, { encoding: "utf8" });
    return exitAnswer(result, `git ${args.join(" ")}`);
}

// One line for the context file; `execFileSync` errors carry the command's stderr.
function failure(error: unknown): string {
    const stderr =
        error instanceof Error && "stderr" in error
            ? String(error.stderr ?? "")
            : "";
    const text =
        stderr.trim() ||
        (error instanceof Error ? error.message : String(error));
    return text.replace(/\s+/g, " ").slice(0, 500);
}

// `gh` missing or unauthenticated degrades a fact to "unknown", never the run.
function gh<T>(args: string[]): T | null {
    try {
        const out = execFileSync("gh", args, {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
        return JSON.parse(out || "null") as T;
    } catch {
        return null;
    }
}

function showFile(ref: string, path: string): string | null {
    const result = spawnSync("git", ["show", `${ref}:${path}`], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
    });
    return result.status === 0 ? result.stdout : null;
}

function versionAt(ref: string, path: string): string | null {
    const text = showFile(ref, path);
    if (text === null) return null;
    const version = (JSON.parse(text) as { version?: unknown }).version;
    return typeof version === "string" ? version : null;
}

function log(range: string[]): Commit[] {
    return parseLog(
        git(["log", "--format=%H%x1f%h%x1f%s%x1f%b%x1e", ...range])
    );
}

function isAncestor(ancestor: string, descendant: string): boolean {
    return (
        gitAnswer(["merge-base", "--is-ancestor", ancestor, descendant]) === 0
    );
}

function trialMergeConflicts(base: string, head: string): string[] {
    return mergeTreeConflicts(
        spawnSync(
            "git",
            [
                "merge-tree",
                "--write-tree",
                "--name-only",
                "--no-messages",
                base,
                head,
            ],
            { encoding: "utf8" }
        )
    );
}

function liveStoreTag(): string | null {
    const releases = gh<{ tagName: string }[]>([
        "release",
        "list",
        "--exclude-pre-releases",
        "--exclude-drafts",
        "--limit",
        "100",
        "--json",
        "tagName",
    ]);
    return releases?.find((r) => r.tagName.startsWith("app-"))?.tagName ?? null;
}

function simulateOta(tag: string, head: string): OtaReport {
    const dir = mkdtempSync(join(tmpdir(), "release-pr-ota-"));
    try {
        git(["worktree", "add", "--detach", "--quiet", dir, head]);
        execFileSync(
            "bash",
            [
                join(dir, "apps/wallet/scripts/pin-native-version.sh"),
                tag.slice(4),
            ],
            {
                env: {
                    ...process.env,
                    WALLET_DIR: join(dir, "apps/wallet"),
                    REPO_DIR: dir,
                },
                stdio: "pipe",
            }
        );
        const nativeFiles = lines(
            git([
                "-C",
                dir,
                "diff",
                "--name-only",
                tag,
                "--",
                "apps/wallet/src-tauri",
            ])
        );
        const guestBumps = git([
            "diff",
            tag,
            head,
            "--",
            "bun.lock",
            "apps/wallet/package.json",
        ])
            .split("\n")
            .filter((line) => GUEST_BUMP.test(line));
        const webChanged =
            gitAnswer([
                "-C",
                dir,
                "diff",
                "--quiet",
                tag,
                "--",
                "apps/wallet",
                "packages",
                "sdk",
                "package.json",
                "bun.lock",
            ]) === 1;
        return { tag, nativeFiles, guestBumps, webChanged };
    } finally {
        spawnSync("git", ["worktree", "remove", "--force", dir]);
        rmSync(dir, { recursive: true, force: true });
    }
}

function otaReport(head: string): OtaReport {
    const tag = liveStoreTag();
    if (!tag) {
        return {
            tag: null,
            reason: "Unknown: no production `app-*` GitHub release found (or `gh` unavailable).",
        };
    }
    try {
        const ref = `refs/tags/${tag}`;
        if (gitAnswer(["rev-parse", "-q", "--verify", ref]) === 1) {
            return {
                tag,
                reason: `Unknown: tag \`${tag}\` is not fetched locally.`,
            };
        }
        if (!isAncestor(tag, head)) {
            return {
                tag,
                reason: `\`${head}\` does not descend from \`${tag}\`: the OTA guard would refuse to run.`,
            };
        }
        return simulateOta(tag, head);
    } catch (error) {
        return {
            tag,
            reason: `Unknown: simulating the guard failed. A \`pin-native-version\` error here fails the real guard too. Error: ${failure(error)}`,
        };
    }
}

function latestTag(prefix: string): string | null {
    // Without the suffix rule, `1.0.0-beta.3` sorts above `1.0.0`.
    const tags = git([
        "-c",
        "versionsort.suffix=-",
        "tag",
        "--list",
        `${prefix}*`,
        "--sort=-v:refname",
    ]);
    return lines(tags)[0] ?? null;
}

function moduleReleases(head: string, paths: string[]): ModuleRelease[] {
    return MODULES.map((m) => ({
        label: m.label,
        workflow: m.workflow,
        latestTag: latestTag(m.tagPrefix),
        changedInRange: paths.some((p) => p.startsWith(m.dir)),
        unreleased: unreleasedSection(
            showFile(head, `${m.dir}CHANGELOG.md`) ?? ""
        ),
    }));
}

function pendingChangesets(head: string): Changeset[] {
    return lines(git(["ls-tree", "--name-only", head, ".changeset/"]))
        .filter((path) => path.endsWith(".md") && !path.endsWith("README.md"))
        .map((path) => parseChangeset(path, showFile(head, path) ?? ""));
}

function ciRuns(sha: string): CiRun[] | null {
    const runs = gh<CiRun[]>([
        "run",
        "list",
        "--commit",
        sha,
        "--limit",
        "50",
        "--json",
        "workflowName,status,conclusion,url",
    ]);
    return runs === null ? null : latestRuns(runs, process.env.GITHUB_WORKFLOW);
}

type GhPr = {
    number: number;
    title: string;
    body: string;
    author: { login: string } | null;
    baseRefName?: string;
};

function toPullRequest(pr: GhPr): PullRequest {
    return {
        number: pr.number,
        title: pr.title,
        author: pr.author?.login ?? "unknown",
        body: pr.body.trim(),
    };
}

function pullRequests(numbers: number[], base: string): PullRequest[] {
    const target = base.replace(/^origin\//, "");
    return numbers
        .map((n) =>
            gh<GhPr>([
                "pr",
                "view",
                String(n),
                "--json",
                "number,title,body,author,baseRefName",
            ])
        )
        .filter((pr): pr is GhPr => pr !== null && pr.baseRefName !== target)
        .map(toPullRequest);
}

function previousRelease(base: string, head: string): PullRequest | null {
    const prs = gh<GhPr[]>([
        "pr",
        "list",
        "--base",
        base.replace(/^origin\//, ""),
        "--head",
        head.replace(/^origin\//, ""),
        "--state",
        "merged",
        "--limit",
        "1",
        "--json",
        "number,title,body,author",
    ]);
    return prs?.[0] ? toPullRequest(prs[0]) : null;
}

export function collectFacts(base: string, head: string): Facts {
    const mergeBaseSha = git(["merge-base", base, head]).trim();
    const [mergeBase] = log(["-1", mergeBaseSha]);
    if (!mergeBase)
        throw new Error(`No merge base between ${base} and ${head}`);
    const all = log([`${base}..${head}`]);
    const commits = log(["--no-merges", "--reverse", `${base}..${head}`]);
    const stats = parseNumstat(
        git(["diff", "--numstat", "--no-renames", mergeBaseSha, head])
    );
    const paths = stats.map((s) => s.path);
    const divergence = log([`${head}..${base}`]);
    const prNumbers = prRefs(all.map((c) => c.subject).join("\n"));
    const prs = pullRequests(prNumbers, base);
    const corpus = [...all, ...divergence, mergeBase]
        .map((c) => `${c.subject}\n${c.body}`)
        .concat(prs.map((pr) => pr.body));
    const headSha = git(["rev-parse", head]).trim();
    return {
        base,
        head,
        baseSha: git(["rev-parse", base]).trim(),
        headSha,
        mergeBase,
        stats: summarize(stats, all.length, commits.length),
        commits,
        divergence: {
            commits: divergence,
            conflicts:
                divergence.length > 0 ? trialMergeConflicts(base, head) : [],
        },
        versions: VERSIONED.map(([name, path]) => ({
            name,
            base: versionAt(base, path),
            head: versionAt(head, path),
        })),
        changesets: pendingChangesets(head),
        surfaces: classify(paths),
        ota: otaReport(head),
        modules: moduleReleases(head, paths),
        ci: ciRuns(headSha),
        pullRequests: prs,
        previous: previousRelease(base, head),
        allowedPrs: prRefs(corpus.join("\n")),
        knownShas: [...all, ...divergence, mergeBase].map((c) => c.sha),
    };
}

function die(message: string): never {
    console.error(`❌ ${message}`);
    process.exit(1);
}

function runCheck(
    factsPath: string,
    titlePath: string,
    bodyPath: string
): void {
    const facts = JSON.parse(readFileSync(factsPath, "utf8")) as Facts;
    const title = readFileSync(titlePath, "utf8").trim();
    const body = readFileSync(bodyPath, "utf8");
    const errors = [...validateTitle(title), ...validateBody(body, facts)];
    if (errors.length > 0)
        die(`release PR draft rejected:\n  ${errors.join("\n  ")}`);
    console.log(
        `✅ release PR draft passes (${title.length} char title, ${body.length} char body)`
    );
}

if (import.meta.main) {
    const { positionals, values } = parseArgs({
        args: process.argv.slice(2),
        allowPositionals: true,
        options: {
            base: { type: "string", default: "origin/main" },
            head: { type: "string", default: "origin/dev" },
            out: { type: "string" },
            facts: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
        },
    });
    const [command] = positionals;
    if (command === "collect") {
        if (!values.out || !values.facts)
            die("collect needs --out <md> --facts <json>");
        const facts = collectFacts(values.base, values.head);
        writeFileSync(values.facts, `${JSON.stringify(facts, null, 2)}\n`);
        writeFileSync(values.out, renderContext(facts));
        console.log(
            `✅ ${facts.stats.commits} commits in ${values.base}..${values.head} → ${values.out}, ${values.facts}`
        );
    } else if (command === "check") {
        if (!values.facts || !values.title || !values.body) {
            die("check needs --facts <json> --title <txt> --body <md>");
        }
        runCheck(values.facts, values.title, values.body);
    } else {
        die(
            "usage: release-pr.ts collect --out --facts [--base --head] | check --facts --title --body"
        );
    }
}
