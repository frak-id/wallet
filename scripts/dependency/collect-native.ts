/**
 * Gradle and SwiftPM pins: every tracked `*.gradle.kts`, version catalog, Gradle wrapper and
 * `Package.swift`. A pin with no literal version (BOM-managed, path, first-party) is skipped.
 */
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import {
    aarMetadata,
    compareNumbers,
    githubLatestRelease,
    gradleCurrent,
    log,
    MAVEN_REPOS,
    type MavenRepo,
    mapLimit,
    mavenVersions,
    parseTag,
    trackedFiles,
} from "./registry";
import { pathTrapFor, trapFor } from "./traps";
import {
    type Delta,
    type Flag,
    type InventoryItem,
    type Location,
    semverDelta,
    tierFor,
} from "./types";

export type NativePin =
    | {
          kind: "maven";
          group: string;
          artifact: string;
          version: string;
          location: Location;
      }
    | { kind: "gradle-plugin"; id: string; version: string; location: Location }
    | { kind: "gradle-wrapper"; version: string; location: Location }
    | { kind: "swiftpm"; slug: string; version: string; location: Location };

/** Upstream versions for one pin, plus where they came from. */
type Candidates = { versions: string[]; source: string; repo?: MavenRepo };

type Lookup = { name: string; candidates: () => Promise<Candidates | null> };
type PinOf<K extends NativePin["kind"]> = Extract<NativePin, { kind: K }>;

const FIRST_PARTY_GROUP = "id.frak.sdk";
const GRADLE_SOURCE = "https://services.gradle.org/versions/current";

async function mavenCandidates(
    group: string,
    artifact: string
): Promise<Candidates | null> {
    const found = await mavenVersions(group, artifact);
    return found
        ? {
              versions: found.versions,
              repo: found.repo,
              source: MAVEN_REPOS[found.repo],
          }
        : null;
}

/** One entry per pin kind, so adding a kind is a type error until it is described here. */
const LOOKUPS: { [K in NativePin["kind"]]: (pin: PinOf<K>) => Lookup } = {
    maven: (pin) => ({
        name: `${pin.group}:${pin.artifact}`,
        candidates: () => mavenCandidates(pin.group, pin.artifact),
    }),
    "gradle-plugin": (pin) => ({
        name: pin.id,
        candidates: () => mavenCandidates(pin.id, `${pin.id}.gradle.plugin`),
    }),
    "gradle-wrapper": () => ({
        name: "gradle",
        candidates: async () => {
            const version = await gradleCurrent();
            return version
                ? { versions: [version], source: GRADLE_SOURCE }
                : null;
        },
    }),
    swiftpm: (pin) => ({
        name: pin.slug,
        candidates: async () => {
            const tag = await githubLatestRelease(pin.slug);
            const source = `https://github.com/${pin.slug}`;
            return tag ? { versions: [tag.replace(/^v/, "")], source } : null;
        },
    }),
};

function lookupOf(pin: NativePin): Lookup {
    const describe = LOOKUPS[pin.kind] as (pin: NativePin) => Lookup;
    return describe(pin);
}

// ─── Parsers ───────────────────────────────────────────────────────────────

const DEPENDENCY_CALL =
    /\b(?:\w*[iI]mplementation|api|compileOnly|runtimeOnly|classpath|kapt|ksp|annotationProcessor)\(\s*(?:(?:enforcedPlatform|platform)\(\s*)?"([^":\s]+):([^":\s]+):(\d[^":\s$]*)"/g;
const PLUGIN_DECLARATION = /\bid\(\s*"([^"]+)"\s*\)\s*version\s*"(\d[^"$]*)"/g;
const SWIFT_REMOTE =
    /^[ \t]*\.package\(\s*url:\s*"https:\/\/github\.com\/([^"/]+\/[^"/]+?)(?:\.git)?"\s*,\s*(?:from|exact):\s*"([^"]+)"/gm;

function maven(
    group: string,
    artifact: string,
    version: string,
    location: Location
): NativePin[] {
    if (group === FIRST_PARTY_GROUP) return [];
    return [{ kind: "maven", group, artifact, version, location }];
}

export function parseKts(file: string, source: string): NativePin[] {
    return source.split("\n").flatMap((text, index) => {
        if (/^\s*\/\//.test(text)) return [];
        const location = { file, line: index + 1 };
        const libraries = [...text.matchAll(DEPENDENCY_CALL)].flatMap((m) =>
            maven(m[1] as string, m[2] as string, m[3] as string, location)
        );
        const plugins = [...text.matchAll(PLUGIN_DECLARATION)].map(
            (m): NativePin => ({
                kind: "gradle-plugin",
                id: m[1] as string,
                version: m[2] as string,
                location,
            })
        );
        return [...libraries, ...plugins];
    });
}

/** A `key = "value"` field of an inline table; `ref` also reads `version.ref`. */
function field(body: string, name: string): string | undefined {
    const pattern = new RegExp(`(?:^|[{,.\\s])${name}\\s*=\\s*"([^"]*)"`);
    return pattern.exec(body)?.[1];
}

type CatalogEntry = {
    section: string;
    key: string;
    body: string;
    line: number;
};

export function parseCatalog(file: string, source: string): NativePin[] {
    let section = "";
    const entries: CatalogEntry[] = [];
    source.split("\n").forEach((text, index) => {
        const header = /^\[(\w+)\]/.exec(text);
        if (header) section = header[1] as string;
        const entry = /^([\w.-]+)\s*=\s*(.+)$/.exec(text);
        if (entry) {
            const [key, body] = [entry[1] as string, entry[2] as string];
            entries.push({ section, key, body, line: index + 1 });
        }
    });

    const versions = new Map<string, CatalogEntry>();
    for (const entry of entries.filter((e) => e.section === "versions")) {
        versions.set(entry.key, entry);
    }
    /** The `[versions]` line a `version.ref` points to is the line someone edits. */
    const versionOf = (entry: CatalogEntry) => {
        const ref = field(entry.body, "ref");
        const literal = ref ? undefined : field(entry.body, "version");
        const target = ref ? versions.get(ref) : undefined;
        const version = literal ?? /^"([^"]*)"/.exec(target?.body ?? "")?.[1];
        return version ? { version, line: target?.line ?? entry.line } : null;
    };

    return entries.flatMap((entry): NativePin[] => {
        const found = versionOf(entry);
        if (!found) return [];
        const location = { file, line: found.line };
        if (entry.section === "plugins") {
            const id = field(entry.body, "id");
            return id
                ? [
                      {
                          kind: "gradle-plugin",
                          id,
                          version: found.version,
                          location,
                      },
                  ]
                : [];
        }
        if (entry.section !== "libraries") return [];
        const group = field(entry.body, "group");
        const name = field(entry.body, "name");
        const module =
            field(entry.body, "module") ??
            (group && name ? `${group}:${name}` : "");
        const [g, a] = module.split(":");
        return g && a ? maven(g, a, found.version, location) : [];
    });
}

export function parseWrapper(file: string, source: string): NativePin[] {
    const lines = source.split("\n");
    const index = lines.findIndex((line) =>
        line.startsWith("distributionUrl=")
    );
    const version = /gradle-(\d[\w.-]*?)-(?:bin|all)\.zip/.exec(
        lines[index] ?? ""
    )?.[1];
    return version
        ? [
              {
                  kind: "gradle-wrapper",
                  version,
                  location: { file, line: index + 1 },
              },
          ]
        : [];
}

export function parseSwiftPackage(file: string, source: string): NativePin[] {
    return [...source.matchAll(SWIFT_REMOTE)].map(
        (m): NativePin => ({
            kind: "swiftpm",
            slug: m[1] as string,
            version: m[2] as string,
            location: {
                file,
                line: source.slice(0, m.index).split("\n").length,
            },
        })
    );
}

// ─── Versions ──────────────────────────────────────────────────────────────

/** Highest version carrying the current one's suffix, so `-rc01` never beats a stable pin. */
export function highestSameShape(
    current: string,
    versions: string[]
): string | null {
    const shape = parseTag(current);
    let best: { version: string; numbers: number[] } | null = null;
    for (const version of versions) {
        const parsed = parseTag(version);
        if (!parsed || !shape || parsed.suffix !== shape.suffix) continue;
        if (!best || compareNumbers(parsed.numbers, best.numbers) > 0) {
            best = { version, numbers: parsed.numbers };
        }
    }
    return best?.version ?? null;
}

function isNewer(latest: string, current: string): boolean {
    const a = parseTag(latest);
    const b = parseTag(current);
    return a && b
        ? compareNumbers(a.numbers, b.numbers) > 0
        : latest !== current;
}

/** A date stamp such as `20260719` is no semver, so its distance is not a major. */
function deltaOf(
    current: string,
    latest: string | null,
    outdated: boolean
): Delta {
    if (latest === null || (outdated && /^\d{8}$/.test(current)))
        return "unknown";
    return outdated ? semverDelta(current, latest) : "none";
}

// ─── compileSdk ────────────────────────────────────────────────────────────

type CompileSdk = { sdk: number; scope: string };

function sdkIn(source: string | undefined): number | null {
    const value = /^\s*compileSdk\s*=\s*(\d+)/m.exec(source ?? "")?.[1];
    return value ? Number(value) : null;
}

/**
 * The module's own `compileSdk`, else the lowest under its Gradle root (the directory holding
 * `settings.gradle[.kts]`). `scope` names that root for the note.
 */
export function compileSdkFor(
    file: string,
    sources: Map<string, string>,
    roots: string[]
): CompileSdk | null {
    const root = roots
        .filter((candidate) => file.startsWith(`${candidate}/`))
        .sort((a, b) => b.length - a.length)[0];
    const scope = root ?? dirname(file);
    const own = sdkIn(sources.get(file));
    if (own !== null) return { sdk: own, scope };
    if (!root) return null;
    const inside = [...sources]
        .filter(([path]) => path.startsWith(`${root}/`))
        .map(([, text]) => sdkIn(text))
        .filter((sdk) => sdk !== null);
    return inside.length > 0 ? { sdk: Math.min(...inside), scope } : null;
}

// ─── Items ─────────────────────────────────────────────────────────────────

type Group = { name: string; version: string; pins: NativePin[] };

/** Everything known about one group once upstream has answered. */
export type Facts = {
    group: Group;
    candidates: Candidates | null;
    latest: string | null;
    /** The other versions this name is pinned at. */
    others: string[];
    /** `aar-metadata.properties` of `latest`, when it is an outdated Google Maven AAR. */
    aar: Record<string, string> | null;
    lowestSdk: CompileSdk | null;
};

function annotate(facts: Facts) {
    const { group, candidates, latest, others, aar, lowestSdk } = facts;
    const meta: Record<string, string> = {};
    const notes: string[] = [];
    const flags: Flag[] = [];
    if (candidates?.repo) meta.repo = candidates.repo;
    if (!latest) {
        flags.push("lookup-failed");
        notes.push(
            candidates
                ? `No upstream release shares the shape of ${group.version}.`
                : "Upstream version lookup failed."
        );
    }
    if (parseTag(group.version)?.suffix) {
        notes.push(
            `${group.version} carries a suffix; only versions with the same suffix are compared, so a later stable release is not reported.`
        );
    }
    if (others.length > 0) {
        const quoted = others.map((v) => `\`${v}\``).join(", ");
        notes.push(`Also declared as ${quoted} elsewhere; move them together.`);
    }
    if (lowestSdk) meta.compileSdk = String(lowestSdk.sdk);
    if (aar?.minCompileSdk) meta.minCompileSdk = aar.minCompileSdk;
    if (aar?.minAndroidGradlePluginVersion) {
        meta.minAgp = aar.minAndroidGradlePluginVersion;
    }
    if (aar && !aar.minCompileSdk) {
        notes.push(
            `Latest ${latest}'s AAR declares no minCompileSdk; any floor comes from its dependencies and is unchecked.`
        );
    }
    const needs = Number(aar?.minCompileSdk);
    if (lowestSdk && needs > lowestSdk.sdk) {
        flags.push("floor-coupled");
        notes.push(
            `Latest ${latest} needs compileSdk ${needs}; ${lowestSdk.scope} compiles against ${lowestSdk.sdk}.`
        );
    }
    return { meta, notes, flags };
}

export function buildItem(facts: Facts): InventoryItem {
    const { group, candidates, latest, others } = facts;
    const { meta, notes, flags } = annotate(facts);
    const hit = trapFor(group.name);
    const locations = group.pins.map((pin) => pin.location);
    const traps = [hit.trap, ...locations.map((l) => pathTrapFor(l.file))];
    const trap = [...new Set(traps.filter(Boolean))].join(" ");
    const needsUpdate = latest !== null && isNewer(latest, group.version);

    const base = {
        id:
            others.length > 0
                ? `native:${group.name}@${group.version}`
                : `native:${group.name}`,
        kind: (group.pins[0] as NativePin).kind,
        name: group.name,
        surface: "native" as const,
        current: group.version,
        latest,
        delta: deltaOf(group.version, latest, needsUpdate),
        needsUpdate,
        flags: [...hit.flags, ...flags],
        source: candidates?.source ?? "unresolved",
        locations,
        ...(Object.keys(meta).length > 0 ? { meta } : {}),
        ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
        ...(trap ? { trap } : {}),
    };
    return { ...base, tier: tierFor(base) };
}

function readTracked(pattern: string): [string, string][] {
    return trackedFiles(pattern).map((file) => [
        file,
        readFileSync(file, "utf-8"),
    ]);
}

export async function collectNative(): Promise<InventoryItem[]> {
    log("→ native dependencies (Gradle and SwiftPM)");
    const kts = new Map(readTracked("*.gradle.kts"));
    const pins = [
        ...[...kts].flatMap(([file, text]) => parseKts(file, text)),
        ...readTracked("*libs.versions.toml").flatMap(([f, t]) =>
            parseCatalog(f, t)
        ),
        ...readTracked("*gradle-wrapper.properties").flatMap(([f, t]) =>
            parseWrapper(f, t)
        ),
        ...readTracked("*Package.swift").flatMap(([f, t]) =>
            parseSwiftPackage(f, t)
        ),
    ];
    const roots = trackedFiles("*settings.gradle", "*settings.gradle.kts").map(
        dirname
    );

    const groups = new Map<string, Group>();
    const lookups = new Map<string, Lookup>();
    const versionsByName = new Map<string, Set<string>>();
    for (const pin of pins) {
        const lookup = lookupOf(pin);
        const key = `${lookup.name}\t${pin.version}`;
        const group = groups.get(key) ?? {
            name: lookup.name,
            version: pin.version,
            pins: [],
        };
        groups.set(key, { ...group, pins: [...group.pins, pin] });
        lookups.set(lookup.name, lookups.get(lookup.name) ?? lookup);
        const seen = versionsByName.get(lookup.name) ?? new Set<string>();
        versionsByName.set(lookup.name, seen.add(pin.version));
    }
    log(
        `  ${pins.length} pin(s), ${lookups.size} name(s), ${groups.size} group(s)`
    );

    const candidatesByName = new Map(
        await mapLimit([...lookups], 10, async ([name, lookup]) => {
            return [name, await lookup.candidates()] as const;
        })
    );

    const facts = await mapLimit([...groups.values()], 10, async (group) => {
        const head = group.pins[0] as NativePin;
        const candidates = candidatesByName.get(group.name) ?? null;
        const latest = candidates
            ? highestSameShape(group.version, candidates.versions)
            : null;
        const outdated = latest !== null && isNewer(latest, group.version);
        const aar =
            head.kind === "maven" && candidates?.repo === "google" && outdated
                ? await aarMetadata(head.group, head.artifact, latest)
                : null;
        const sdks = group.pins.flatMap((pin) =>
            head.kind === "maven"
                ? [compileSdkFor(pin.location.file, kts, roots)]
                : []
        );
        const lowestSdk = sdks.reduce<CompileSdk | null>(
            (low, sdk) => (sdk && (!low || sdk.sdk < low.sdk) ? sdk : low),
            null
        );
        const others = [...(versionsByName.get(group.name) ?? [])].filter(
            (version) => version !== group.version
        );
        return { group, candidates, latest, others, aar, lowestSdk };
    });
    return facts.map(buildItem);
}
