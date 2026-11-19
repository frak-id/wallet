/**
 * Upstream lookups shared by every collector. No repo knowledge lives here —
 * a function in this file either resolves a version or returns null.
 */
import { execFileSync } from "node:child_process";
import { inflateRawSync } from "node:zlib";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
const AGENT = "frak-wallet-dependency-inventory";

/** stderr, so stdout stays a clean JSON document. */
export function log(message: string): void {
    console.error(message);
}

/** `quiet404` is for lookups where a 404 is an answer, not a failure. */
async function request<T>(
    url: string,
    init: RequestInit,
    read: (response: Response) => Promise<T>,
    quiet404 = false
): Promise<T | null> {
    try {
        const response = await fetch(url, {
            ...init,
            signal: AbortSignal.timeout(20_000),
            headers: { "user-agent": AGENT, ...(init.headers ?? {}) },
        });
        if (!response.ok) {
            if (!(quiet404 && response.status === 404)) {
                log(`  ! ${response.status} ${response.statusText} — ${url}`);
            }
            return null;
        }
        return await read(response);
    } catch (error) {
        log(`  ! fetch failed — ${url}: ${error}`);
        return null;
    }
}

export function fetchText(
    url: string,
    init: RequestInit = {}
): Promise<string | null> {
    return request(url, init, (response) => response.text());
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

// ─── Maven and Gradle ──────────────────────────────────────────────────────

export type MavenRepo = "google" | "central" | "plugin-portal";

/** Lookup order: a group that exists on Google Maven is never answered by a mirror. */
export const MAVEN_REPOS: Record<MavenRepo, string> = {
    google: "https://dl.google.com/android/maven2/",
    central: "https://repo1.maven.org/maven2/",
    "plugin-portal": "https://plugins.gradle.org/m2/",
};

/** A 404 is an answer here, not a failure, so it is not logged. */
export function fetchBytes(url: string): Promise<Uint8Array | null> {
    const read = async (response: Response) =>
        new Uint8Array(await response.arrayBuffer());
    return request(url, {}, read, true);
}

function artifactDir(group: string, artifact: string): string {
    return `${group.replaceAll(".", "/")}/${artifact}`;
}

export function parseMavenVersions(xml: string): string[] {
    return [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map(
        (match) => match[1] as string
    );
}

/** Every published version from the first repository that knows the module. */
export async function mavenVersions(
    group: string,
    artifact: string
): Promise<{ repo: MavenRepo; versions: string[] } | null> {
    for (const [repo, base] of Object.entries(MAVEN_REPOS)) {
        const url = `${base}${artifactDir(group, artifact)}/maven-metadata.xml`;
        const xml = await request(url, {}, (r) => r.text(), true);
        if (!xml) continue;
        const versions = parseMavenVersions(xml);
        if (versions.length > 0) return { repo: repo as MavenRepo, versions };
    }
    return null;
}

export async function gradleCurrent(): Promise<string | null> {
    const data = await fetchJson<{ version?: string }>(
        "https://services.gradle.org/versions/current"
    );
    return data?.version ?? null;
}

/** One file out of a zip, found through the central directory. Stored or deflated only. */
export function readZipEntry(zip: Uint8Array, name: string): Buffer | null {
    const buf = Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength);
    let end = buf.length - 22;
    while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
    if (end < 0) return null;
    let at = buf.readUInt32LE(end + 16);
    for (let n = buf.readUInt16LE(end + 10); n > 0; n--) {
        if (buf.readUInt32LE(at) !== 0x02014b50) return null;
        const method = buf.readUInt16LE(at + 10);
        const size = buf.readUInt32LE(at + 20);
        const nameLength = buf.readUInt16LE(at + 28);
        const skip =
            nameLength + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
        const local = buf.readUInt32LE(at + 42);
        if (buf.toString("utf-8", at + 46, at + 46 + nameLength) === name) {
            const start =
                local +
                30 +
                buf.readUInt16LE(local + 26) +
                buf.readUInt16LE(local + 28);
            const data = buf.subarray(start, start + size);
            return method === 0 ? data : inflateRawSync(data);
        }
        at += 46 + skip;
    }
    return null;
}

export function parseProperties(text: string): Record<string, string> {
    const pairs = text
        .split(/\r?\n/)
        .map((line) => /^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/.exec(line))
        .filter((match) => match !== null);
    return Object.fromEntries(pairs.map((m) => [m[1], m[2]]));
}

/** `aar-metadata.properties` of an AAR: `{}` when it has none, null when the zip is unreadable. */
export function aarProperties(
    aar: Uint8Array,
    label: string
): Record<string, string> | null {
    const path = "META-INF/com/android/build/gradle/aar-metadata.properties";
    try {
        const entry = readZipEntry(aar, path);
        return entry ? parseProperties(entry.toString("utf-8")) : {};
    } catch (error) {
        log(`  ! unreadable AAR — ${label}: ${error}`);
        return null;
    }
}

/** Null for a jar module or an unreadable download. */
export async function aarMetadata(
    group: string,
    artifact: string,
    version: string
): Promise<Record<string, string> | null> {
    const file = `${artifactDir(group, artifact)}/${version}/${artifact}-${version}.aar`;
    const aar = await fetchBytes(`${MAVEN_REPOS.google}${file}`);
    return aar ? aarProperties(aar, file) : null;
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
