/**
 * Rust crates declared by the Tauri app crate and its seven plugins.
 *
 * Versions resolve against the sparse index rather than the crates.io API: a
 * static CDN with no rate limit, ordered by publication and never by version.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import {
    compareNumbers,
    fetchText,
    lineOf,
    log,
    mapLimit,
    parseTag,
    trackedFiles,
} from "./registry";
import { trapFor } from "./traps";
import {
    type Flag,
    type InventoryItem,
    type Location,
    semverDelta,
    stripRange,
    tierFor,
} from "./types";

const LOCK_FILE = "apps/wallet/src-tauri/Cargo.lock";

type CargoDep = { name: string; req: string; path?: string | null };
type CargoPackage = { manifest_path: string; dependencies?: CargoDep[] };

type Declaration = {
    name: string;
    req: string;
    /** Repo-relative crate directory for a first-party dependency. */
    path: string | null;
    location: Location;
};

/** Anchored so `serde` never matches the `serde_json` line. */
export function declRegex(name: string): RegExp {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`^\\s*${escaped}\\s*[=.]`);
}

export function indexPath(name: string): string {
    const lower = name.toLowerCase();
    if (lower.length <= 2) return `${lower.length}/${lower}`;
    if (lower.length === 3) return `3/${lower[0]}/${lower}`;
    return `${lower.slice(0, 2)}/${lower.slice(2, 4)}/${lower}`;
}

/** Caret is Cargo's default, so `^0.14` accepts 0.14.z but never 0.15. */
export function inRange(req: string, version: string): boolean {
    if (req === "*") return true;
    const specified = parseTag(req.replace(/^\^/, ""));
    const actual = parseTag(version);
    if (!req.startsWith("^") || !specified || !actual) return false;
    if (compareNumbers(actual.numbers, specified.numbers) < 0) return false;
    const upper = [...specified.numbers];
    const lead = upper.findIndex((part) => part !== 0);
    const bump = lead === -1 ? upper.length - 1 : lead;
    upper[bump] = (upper[bump] ?? 0) + 1;
    upper.fill(0, bump + 1);
    return compareNumbers(actual.numbers, upper) < 0;
}

export function lockedVersions(source: string): Map<string, string> {
    const blocks = source.matchAll(
        /\[\[package\]\]\s*\nname = "([^"]+)"\s*\nversion = "([^"]+)"/g
    );
    return new Map([...blocks].map((b) => [b[1] as string, b[2] as string]));
}

/** Newline-delimited index entries; the highest non-yanked release wins. */
export function highestStable(body: string): string | null {
    let best: { vers: string; numbers: number[] } | null = null;
    for (const line of body.split("\n")) {
        const vers = /"vers":"([^"]+)"/.exec(line)?.[1];
        if (!vers || /"yanked":\s*true/.test(line)) continue;
        const parsed = parseTag(vers);
        if (!parsed || parsed.suffix) continue;
        if (!best || compareNumbers(parsed.numbers, best.numbers) > 0) {
            best = { vers, numbers: parsed.numbers };
        }
    }
    return best?.vers ?? null;
}

/** Empty rather than fatal: cargo is not installed on every runner. */
function manifestDeps(manifest: string): CargoDep[] {
    const args = ["--format-version", "1", "--no-deps", "--manifest-path"];
    try {
        const json = execFileSync("cargo", ["metadata", ...args, manifest], {
            encoding: "utf-8",
            maxBuffer: 32 * 1024 * 1024,
            stdio: "pipe",
        });
        const meta = JSON.parse(json) as { packages?: CargoPackage[] };
        return (
            meta.packages?.find((pkg) => pkg.manifest_path.endsWith(manifest))
                ?.dependencies ?? []
        );
    } catch (error) {
        log(`  ! cargo metadata failed for ${manifest}: ${error}`);
        return [];
    }
}

function declarationsIn(manifest: string): Declaration[] {
    const lines = readFileSync(manifest, "utf-8").split("\n");
    return manifestDeps(manifest).map((dep) => ({
        name: dep.name,
        req: dep.req,
        path: dep.path ? relative(process.cwd(), dep.path) : null,
        location: { file: manifest, line: lineOf(lines, declRegex(dep.name)) },
    }));
}

function annotate(
    head: Declaration,
    latest: string | null,
    lockedAt: string | undefined,
    others: string[]
): { meta: Record<string, string>; notes: string[]; flags: Flag[] } {
    const meta: Record<string, string> = {};
    const notes: string[] = [];
    const flags: Flag[] = [];

    if (head.path) {
        meta.local = "true";
        notes.push("First-party crate consumed by path, not from crates.io.");
    } else if (!latest) {
        flags.push("lookup-failed");
        notes.push("crates.io sparse index lookup failed.");
    }
    if (others.length > 0) {
        const quoted = others.map((r) => `\`${r}\``).join(", ");
        notes.push(`Also declared as ${quoted} elsewhere; move them together.`);
    }
    if (lockedAt) meta.locked = lockedAt;
    if (latest && inRange(head.req, latest)) {
        meta.inRange = "true";
        if (lockedAt && lockedAt !== latest) {
            notes.push(
                `Cargo.lock holds ${lockedAt}; \`cargo update -p ${head.name}\` reaches ${latest} with no manifest edit.`
            );
        }
    }
    return { meta, notes, flags };
}

function buildItem(
    group: Declaration[],
    latestByName: Map<string, string | null>,
    locked: Map<string, string>,
    reqsByName: Map<string, Set<string>>
): InventoryItem {
    const head = group[0] as Declaration;
    const { name, req, path } = head;
    const others = [...(reqsByName.get(name) ?? [])].filter((r) => r !== req);
    const hit = trapFor(name);
    const latest = path ? null : (latestByName.get(name) ?? null);
    const { meta, notes, flags } = annotate(
        head,
        latest,
        locked.get(name),
        others
    );

    const base = {
        id: others.length > 0 ? `cargo:${name}@${req}` : `cargo:${name}`,
        kind: "cargo" as const,
        name,
        surface: "cargo" as const,
        current: path ? "path" : req,
        latest,
        delta: latest ? semverDelta(req, latest) : ("unknown" as const),
        needsUpdate: latest !== null && stripRange(req) !== latest,
        flags: [...hit.flags, ...flags],
        source: path ?? `https://crates.io/crates/${name}`,
        locations: group.map((entry) => entry.location),
        ...(Object.keys(meta).length > 0 ? { meta } : {}),
        ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
        ...(hit.trap ? { trap: hit.trap } : {}),
    };
    return { ...base, tier: tierFor(base) };
}

export async function collectCargo(): Promise<InventoryItem[]> {
    log("→ cargo crates (Tauri app and plugins)");
    const manifests = trackedFiles("*Cargo.toml");
    const declarations = manifests.flatMap(declarationsIn);

    const groups = new Map<string, Declaration[]>();
    const reqsByName = new Map<string, Set<string>>();
    for (const declaration of declarations) {
        const key = `${declaration.name}\t${declaration.req}`;
        groups.set(key, [...(groups.get(key) ?? []), declaration]);
        const seen = reqsByName.get(declaration.name) ?? new Set<string>();
        reqsByName.set(declaration.name, seen.add(declaration.req));
    }

    const names = [
        ...new Set(declarations.filter((d) => !d.path).map((d) => d.name)),
    ];
    log(
        `  ${manifests.length} manifest(s), ${names.length} crate(s), ${groups.size} declaration group(s)`
    );
    const latestByName = new Map(
        await mapLimit(names, 10, async (name) => {
            const url = `https://index.crates.io/${indexPath(name)}`;
            const body = await fetchText(url);
            return [name, body ? highestStable(body) : null] as const;
        })
    );

    const locked = lockedVersions(
        existsSync(LOCK_FILE) ? readFileSync(LOCK_FILE, "utf-8") : ""
    );
    return [...groups.values()].map((group) =>
        buildItem(group, latestByName, locked, reqsByName)
    );
}
