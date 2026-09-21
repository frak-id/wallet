/**
 * What the deployment runs on: the Pulumi/SST pins, plus the two container
 * images. SST never bumps its provider plugins from package.json, so
 * `sst.config.ts` has to be read separately.
 */
import { readFileSync } from "node:fs";
import {
    dockerHubTags,
    latestSameShape,
    lineOf,
    log,
    mapLimit,
    npmLatest,
    parseTag,
    trackedFiles,
} from "./registry";
import { trapFor } from "./traps";
import {
    type InventoryItem,
    type Kind,
    type Location,
    semverDelta,
    stripRange,
    tierFor,
} from "./types";

type Pin = {
    id: string;
    kind: Kind;
    /** The npm package the version is resolved against. */
    name: string;
    current: string;
    location: Location;
};

export type ProviderPin = { name: string; version: string; line: number };

function braceDelta(line: string): number {
    return (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
}

/** Body line range of the `providers` block, excluding its own braces. */
function providersBody(lines: string[]): [number, number] | null {
    const start = lines.findIndex((line) => /\bproviders\s*:\s*\{/.test(line));
    if (start < 0) return null;

    let depth = 0;
    for (let i = start; i < lines.length; i++) {
        depth += braceDelta(lines[i] ?? "");
        if (depth === 0) return [start + 1, i];
    }
    return [start + 1, lines.length];
}

function readInlinePin(line: string, lineNumber: number): ProviderPin | null {
    const match = /^\s*"?([a-z][\w-]*)"?\s*:\s*"([^"]+)"\s*,?\s*$/.exec(line);
    if (!match?.[1] || !match[2]) return null;
    return { name: match[1], version: match[2], line: lineNumber };
}

/**
 * Only direct children of `providers` are pins — `gcp: { project, region }` has
 * keys shaped exactly like the inline form but they are provider options.
 */
export function parseProviders(source: string): ProviderPin[] {
    const lines = source.split("\n");
    const body = providersBody(lines);
    if (!body) return [];

    const found: ProviderPin[] = [];
    let depth = 0;
    let nested: string | null = null;

    for (let i = body[0]; i < body[1]; i++) {
        const line = lines[i] ?? "";
        const atTop = depth === 0;
        depth += braceDelta(line);

        if (!atTop) {
            if (!nested) continue;
            const version = /^\s*version\s*:\s*"([^"]+)"/.exec(line)?.[1];
            if (version) {
                found.push({ name: nested, version, line: i + 1 });
                nested = null;
            }
            continue;
        }

        const inline = readInlinePin(line, i + 1);
        if (inline) found.push(inline);
        nested = inline
            ? null
            : (/^\s*"?([a-z][\w-]*)"?\s*:\s*\{\s*$/.exec(line)?.[1] ?? null);
    }

    return found;
}

function rootPins(): Pin[] {
    const source = readFileSync("package.json", "utf-8");
    const lines = source.split("\n");
    const manifest = JSON.parse(source) as {
        devDependencies?: Record<string, string>;
        catalog?: Record<string, string>;
        workspaces?: { catalog?: Record<string, string> };
    };

    const pins: Pin[] = [];
    for (const name of ["@pulumi/kubernetes", "@pulumi/pulumi"]) {
        const range = manifest.devDependencies?.[name];
        if (!range) continue;
        pins.push({
            id: `pulumi-dep:${name}`,
            kind: "pulumi-provider",
            name,
            current: range,
            location: {
                file: "package.json",
                line: lineOf(lines, `"${name}"`),
            },
        });
    }

    // Bun accepts the catalog at either spelling; this repo uses the top-level one.
    const sst = manifest.catalog?.sst ?? manifest.workspaces?.catalog?.sst;
    if (sst) {
        pins.push({
            id: "npm:sst",
            kind: "npm",
            name: "sst",
            current: sst,
            location: {
                file: "package.json",
                line: lineOf(lines, /^\s*"sst":\s*"\d/),
            },
        });
    }
    return pins;
}

function providerPins(): Pin[] {
    const file = "sst.config.ts";
    const source = readFileSync(file, "utf-8");
    return parseProviders(source).map((provider) => ({
        id: `pulumi-provider:${provider.name}`,
        kind: "pulumi-provider" as const,
        name: `@pulumi/${provider.name}`,
        current: provider.version,
        location: { file, line: provider.line },
    }));
}

async function resolvePin(pin: Pin): Promise<InventoryItem> {
    const { trap, flags } = trapFor(pin.name);
    const item: InventoryItem = {
        id: pin.id,
        kind: pin.kind,
        name: pin.name,
        surface: "infra",
        current: pin.current,
        latest: null,
        delta: "none",
        needsUpdate: false,
        tier: "appendix",
        flags: [...flags],
        source: `https://www.npmjs.com/package/${pin.name}`,
        locations: [pin.location],
        ...(trap ? { trap } : {}),
    };

    const latest = await npmLatest(pin.name);
    if (!latest) {
        item.flags.push("lookup-failed");
        item.note = "npm registry lookup failed";
        item.tier = tierFor(item);
        return item;
    }

    item.latest = latest.version;
    if (latest.homepage) item.homepage = latest.homepage;
    if (latest.deprecated) {
        item.flags.push("deprecated");
        item.note = latest.deprecated;
    }
    item.needsUpdate = stripRange(pin.current) !== latest.version;
    item.delta = semverDelta(pin.current, latest.version);
    item.tier = tierFor(item);
    return item;
}

export async function collectInfra(): Promise<InventoryItem[]> {
    log("→ Pulumi and SST pins (package.json, sst.config.ts)");
    const pins = [...rootPins(), ...providerPins()];
    log(`  ${pins.length} pin(s)`);
    const [providers, images] = await Promise.all([
        mapLimit(pins, 4, resolvePin),
        collectImages(),
    ]);
    return [...providers, ...images];
}

// ─── Container images ────────────────────────────────────────────────────

/** `oven/bun` reads its version from `packageManager`, which is what CI resolves too. */
const IMAGES = [
    {
        id: "image:oven/bun",
        repository: "oven/bun",
        site: /"packageManager":\s*"bun@([0-9.]+)"/,
        file: "package.json",
    },
    {
        id: "image:nginx",
        repository: "library/nginx",
        site: /^FROM nginx:(\S+)$/m,
        file: null,
    },
] as const;

/** Every `ARG BUN_VERSION` and `FROM nginx:` line, so a bump names the files it has to touch. */
function imageLocations(pattern: RegExp): Location[] {
    const locations: Location[] = [];
    for (const file of trackedFiles("*Dockerfile")) {
        const lines = readFileSync(file, "utf-8").split("\n");
        lines.forEach((line, index) => {
            if (pattern.test(line)) locations.push({ file, line: index + 1 });
        });
    }
    return locations;
}

async function resolveImage(
    id: string,
    repository: string,
    current: string,
    locations: Location[],
    trap: string
): Promise<InventoryItem> {
    const item: InventoryItem = {
        id,
        kind: "image",
        name: repository,
        surface: "infra",
        current,
        latest: null,
        delta: "unknown",
        needsUpdate: false,
        tier: "research",
        flags: [],
        source: `https://hub.docker.com/r/${repository}`,
        locations,
        trap,
    };

    const parsed = parseTag(current);
    const tags = parsed ? await dockerHubTags(repository) : [];
    // Shape-matched: a `1.31.4-alpine` pin must never be offered a glibc tag.
    const latest = parsed ? latestSameShape(parsed, tags) : null;
    if (!latest) {
        item.flags.push("lookup-failed");
        item.note = `no comparable \`${current}\`-shaped tag found on Docker Hub`;
        item.tier = tierFor(item);
        return item;
    }

    item.latest = latest;
    item.needsUpdate = latest !== current;
    item.delta = semverDelta(current, latest);
    item.tier = tierFor(item);
    return item;
}

async function collectImages(): Promise<InventoryItem[]> {
    log("→ container images (packageManager, Dockerfiles)");
    const root = readFileSync("package.json", "utf-8");

    const bunVersion = IMAGES[0].site.exec(root)?.[1];
    const nginxRef = trackedFiles("*Dockerfile")
        .map((file) => IMAGES[1].site.exec(readFileSync(file, "utf-8"))?.[1])
        .find(Boolean);

    const items: Promise<InventoryItem>[] = [];
    if (bunVersion) {
        items.push(
            resolveImage(
                IMAGES[0].id,
                IMAGES[0].repository,
                bunVersion,
                [
                    {
                        file: "package.json",
                        line: lineOf(root.split("\n"), "packageManager"),
                    },
                    ...imageLocations(/^ARG BUN_VERSION=/),
                ],
                "`bun run check:bun-version` already holds packageManager and the seven Dockerfile ARG sites in step, so drift is not the finding here — only the upstream delta is."
            )
        );
    }
    if (nginxRef) {
        items.push(
            resolveImage(
                IMAGES[1].id,
                IMAGES[1].repository,
                nginxRef,
                imageLocations(/^FROM nginx:/),
                "Serves the wallet and business SPAs; the `-alpine` variant suffix is part of the pin and must survive the bump."
            )
        );
    }
    return Promise.all(items);
}
