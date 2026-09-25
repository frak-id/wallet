/**
 * Upstream lookups shared by every collector. No repo knowledge lives here —
 * a function in this file either resolves a version or returns null.
 */
import { execFileSync } from "node:child_process";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
const AGENT = "frak-wallet-dependency-inventory";

/** stderr, so stdout stays a clean JSON document. */
export function log(message: string): void {
    console.error(message);
}

export async function fetchText(
    url: string,
    init: RequestInit = {}
): Promise<string | null> {
    try {
        const response = await fetch(url, {
            ...init,
            signal: AbortSignal.timeout(20_000),
            headers: { "user-agent": AGENT, ...(init.headers ?? {}) },
        });
        if (!response.ok) {
            log(`  ! ${response.status} ${response.statusText} — ${url}`);
            return null;
        }
        return await response.text();
    } catch (error) {
        log(`  ! fetch failed — ${url}: ${error}`);
        return null;
    }
}

export async function fetchJson<T>(
    url: string,
    init: RequestInit = {}
): Promise<T | null> {
    const text = await fetchText(url, {
        ...init,
        headers: { accept: "application/json", ...(init.headers ?? {}) },
    });
    if (text === null) return null;
    try {
        return JSON.parse(text) as T;
    } catch {
        log(`  ! unparseable JSON — ${url}`);
        return null;
    }
}

function githubHeaders(): Record<string, string> {
    return {
        accept: "application/vnd.github+json",
        ...(GITHUB_TOKEN ? { authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
    };
}

export function hasGithubToken(): boolean {
    return GITHUB_TOKEN !== "";
}

/** Bounded-concurrency map — registries throttle aggressively. */
export async function mapLimit<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
        (async () => {
            while (cursor < items.length) {
                const index = cursor++;
                results[index] = await fn(items[index] as T);
            }
        })()
    );
    await Promise.all(workers);
    return results;
}

/**
 * Files git actually tracks. `plugins/magento/vendor/` and
 * `plugins/prestashop/.cache/` are gitignored vendored trees that would
 * otherwise flood every collector.
 */
export function trackedFiles(...patterns: string[]): string[] {
    try {
        return execFileSync("git", ["ls-files", "-z", ...patterns], {
            encoding: "utf-8",
            maxBuffer: 32 * 1024 * 1024,
        })
            .split("\0")
            .filter(Boolean);
    } catch (error) {
        log(`  ! git ls-files failed: ${error}`);
        return [];
    }
}

/** 1-based line of the first match, or 0 when absent. */
export function lineOf(lines: string[], needle: string | RegExp): number {
    const test =
        typeof needle === "string"
            ? (line: string) => line.includes(needle)
            : (line: string) => needle.test(line);
    return lines.findIndex(test) + 1;
}

// ─── npm ───────────────────────────────────────────────────────────────────

export type NpmInfo = {
    version: string;
    homepage?: string;
    /** The deprecation message upstream published, when there is one. */
    deprecated?: string;
};

export async function npmLatest(name: string): Promise<NpmInfo | null> {
    const data = await fetchJson<{
        version?: string;
        homepage?: string;
        deprecated?: string;
        repository?: { url?: string } | string;
    }>(`https://registry.npmjs.org/${name.replace("/", "%2f")}/latest`);
    if (!data?.version) return null;
    const repo =
        typeof data.repository === "string"
            ? data.repository
            : data.repository?.url;
    return {
        version: data.version,
        homepage:
            data.homepage ??
            repo?.replace(/^git\+/, "").replace(/\.git$/, "") ??
            undefined,
        deprecated: data.deprecated,
    };
}

// ─── Container registries ──────────────────────────────────────────────────

type DockerHubPage = {
    results?: Array<{ name: string }>;
    next?: string | null;
};

export async function dockerHubTags(path: string): Promise<string[]> {
    const tags: string[] = [];
    let url: string | null =
        `https://hub.docker.com/v2/repositories/${path}/tags?page_size=100&ordering=last_updated`;
    for (let page = 0; page < 3 && url; page++) {
        const data: DockerHubPage | null = await fetchJson<DockerHubPage>(url);
        if (!data) break;
        tags.push(...(data.results ?? []).map((result) => result.name));
        url = data.next ?? null;
    }
    return tags;
}

// ─── GitHub ────────────────────────────────────────────────────────────────

export async function githubLatestRelease(
    slug: string
): Promise<string | null> {
    const release = await fetchJson<{ tag_name?: string }>(
        `https://api.github.com/repos/${slug}/releases/latest`,
        { headers: githubHeaders() }
    );
    return release?.tag_name ?? null;
}

/** The commit a sha-pinned `uses:` must move to. Annotated tags are dereferenced. */
export async function resolveTagSha(
    slug: string,
    tag: string
): Promise<string | null> {
    const ref = await fetchJson<{ object?: { sha: string; type: string } }>(
        `https://api.github.com/repos/${slug}/git/ref/tags/${encodeURIComponent(tag)}`,
        { headers: githubHeaders() }
    );
    if (!ref?.object) return null;
    if (ref.object.type !== "tag") return ref.object.sha;
    const annotated = await fetchJson<{ object?: { sha: string } }>(
        `https://api.github.com/repos/${slug}/git/tags/${ref.object.sha}`,
        { headers: githubHeaders() }
    );
    return annotated?.object?.sha ?? ref.object.sha;
}

// ─── Tag shapes ────────────────────────────────────────────────────────────

export type ParsedTag = { prefix: string; numbers: number[]; suffix: string };

/** Splits `v1.2.3-alpine`. Null for anything not version-shaped. */
export function parseTag(tag: string): ParsedTag | null {
    const match = /^(v?)(\d+(?:\.\d+)*)(?:[-_.]([\w.-]+))?$/.exec(tag);
    if (!match) return null;
    return {
        prefix: match[1] ?? "",
        numbers: (match[2] ?? "").split(".").map(Number),
        suffix: match[3] ?? "",
    };
}

export function compareNumbers(a: number[], b: number[]): number {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

/**
 * Highest tag sharing the current tag's shape — same `v` prefix, same variant
 * suffix, same component count. `1.31.4-alpine` must never be "upgraded" to a
 * glibc `1.32.0`.
 */
export function latestSameShape(
    current: ParsedTag,
    tags: string[],
    pinMajor?: number
): string | null {
    let best: { tag: string; parsed: ParsedTag } | null = null;
    for (const tag of tags) {
        const parsed = parseTag(tag);
        if (!parsed) continue;
        if (parsed.prefix !== current.prefix) continue;
        if (parsed.suffix !== current.suffix) continue;
        if (parsed.numbers.length !== current.numbers.length) continue;
        if (pinMajor !== undefined && parsed.numbers[0] !== pinMajor) continue;
        if (!best || compareNumbers(parsed.numbers, best.parsed.numbers) > 0) {
            best = { tag, parsed };
        }
    }
    return best?.tag ?? null;
}
