/**
 * Every outdated npm dependency. `bun outdated` already resolves the workspace
 * graph and the catalog, so the work left here is locating the edit site and
 * asking the registry about the few items the agent will actually read.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { lineOf, log, mapLimit, npmLatest, trackedFiles } from "./registry";
import { trapFor } from "./traps";
import {
    type InventoryItem,
    type Location,
    semverDelta,
    tierFor,
} from "./types";

const HEADER = ["Package", "Current", "Update", "Latest", "Workspace"];
const ROOT_MANIFEST = "package.json";

export type OutdatedRow = {
    name: string;
    current: string;
    /** Highest version the declared range already reaches. */
    update: string;
    latest: string;
    workspace: string;
    depType?: string;
};

/**
 * Asserts the table shape before reading a row: a Bun release that reshapes it
 * must break the build rather than quietly report nothing outdated.
 */
export function parseOutdated(stdout: string): OutdatedRow[] {
    const [header, ...rows] = stdout
        .split("\n")
        .filter((line) => line.startsWith("|") && !line.startsWith("|-"))
        .map((line) =>
            line
                .split("|")
                .slice(1, -1)
                .map((cell) => cell.trim())
        );

    if (header?.join(" | ") !== HEADER.join(" | ")) {
        const preview = stdout.split("\n").slice(0, 3).join("\n");
        throw new Error(
            `bun outdated table shape changed — expected header [${HEADER.join(", ")}], got ${JSON.stringify(header ?? null)}\n${preview}`
        );
    }

    return rows.map((cells) => {
        const typed = /^(.+) \((dev|peer|optional)\)$/.exec(cells[0] ?? "");
        return {
            name: typed?.[1] ?? cells[0] ?? "",
            current: cells[1] ?? "",
            update: cells[2] ?? "",
            latest: cells[3] ?? "",
            workspace: cells[4] ?? "",
            ...(typed?.[2] ? { depType: typed[2] } : {}),
        };
    });
}

type Manifest = { file: string; lines: string[] };

function manifestsByName(): Map<string, Manifest> {
    const map = new Map<string, Manifest>();
    for (const file of trackedFiles("*package.json")) {
        const raw = readFileSync(file, "utf-8");
        const { name } = JSON.parse(raw) as { name?: string };
        if (name) map.set(name, { file, lines: raw.split("\n") });
    }
    return map;
}

export function isCatalogRow(workspace: string): boolean {
    return workspace === "catalog" || workspace.startsWith("catalog (");
}

/**
 * A catalog entry's edit site is the root manifest's top-level `catalog`, never
 * the consumer that Bun lists alongside it.
 */
export function locate(
    row: OutdatedRow,
    byName: Map<string, Manifest>,
    root: Manifest | null
): Location[] {
    const key = `"${row.name}":`;
    if (isCatalogRow(row.workspace)) {
        if (!root) return [];
        const start = lineOf(root.lines, '"catalog":');
        const within = lineOf(root.lines.slice(start), key);
        return within === 0 ? [] : [{ file: root.file, line: within + start }];
    }
    const manifest = byName.get(row.workspace);
    return manifest
        ? [{ file: manifest.file, line: lineOf(manifest.lines, key) }]
        : [];
}

function buildItem(
    row: OutdatedRow,
    locations: Location[],
    id: string
): InventoryItem {
    const trap = trapFor(row.name);
    const needsUpdate = row.current !== row.latest;
    const delta = semverDelta(row.current, row.latest);
    const inRange = row.update !== row.current;
    const flags = [...trap.flags];
    const note = `\`bun update ${row.name}\` reaches ${row.update} with no manifest edit`;
    return {
        id,
        kind: "npm",
        name: row.name,
        surface: "npm",
        current: row.current,
        latest: row.latest,
        delta,
        needsUpdate,
        tier: tierFor({ surface: "npm", delta, flags, needsUpdate }),
        flags,
        source: `https://www.npmjs.com/package/${row.name}`,
        locations,
        meta: {
            inRange: String(inRange),
            ...(row.depType ? { depType: row.depType } : {}),
            ...(isCatalogRow(row.workspace) ? { catalog: "true" } : {}),
        },
        ...(inRange ? { note } : {}),
        ...(trap.trap ? { trap: trap.trap } : {}),
    };
}

/**
 * Declared package names, no ranges. A deprecated package is usually also
 * up to date, so it never reaches the `bun outdated` table at all.
 */
function declaredNames(): Set<string> {
    const fields = [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
    ];
    const names = new Set<string>();
    for (const file of trackedFiles("*package.json")) {
        const manifest = JSON.parse(readFileSync(file, "utf-8"));
        for (const field of fields) {
            for (const name of Object.keys(manifest[field] ?? {})) {
                names.add(name);
            }
        }
    }
    return names;
}

/**
 * An abandoned package pinned at its final version is the most actionable
 * finding there is, and the only signal for it is the registry's own flag.
 */
async function deprecatedButCurrent(
    covered: Set<string>
): Promise<InventoryItem[]> {
    const names = [...declaredNames()].filter((name) => !covered.has(name));
    log(`  ${names.length} up-to-date package(s) swept for deprecation`);
    const found = await mapLimit(names, 10, async (name) => {
        const info = await npmLatest(name);
        if (!info?.deprecated) return null;
        const trap = trapFor(name);
        const item: InventoryItem = {
            id: `npm:${name}`,
            kind: "npm",
            name,
            surface: "npm",
            current: info.version,
            latest: info.version,
            delta: "none",
            needsUpdate: false,
            tier: "research",
            flags: [...trap.flags, "deprecated"],
            source: `https://www.npmjs.com/package/${name}`,
            locations: [],
            note: info.deprecated,
            meta: { deprecated: info.deprecated },
            ...(info.homepage ? { homepage: info.homepage } : {}),
            ...(trap.trap ? { trap: trap.trap } : {}),
        };
        return item;
    });
    return found.filter((item) => item !== null);
}

/** Only research-tier items cost a request; the appendix tail stays free. */
async function enrich(items: InventoryItem[]): Promise<void> {
    const research = items.filter((item) => item.tier === "research");
    log(`  ${research.length} research-tier lookups`);
    await mapLimit(research, 10, async (item) => {
        const info = await npmLatest(item.name);
        if (!info) return;
        if (info.homepage) item.homepage = info.homepage;
        if (!info.deprecated) return;
        item.flags.push("deprecated");
        item.meta = { ...item.meta, deprecated: info.deprecated };
        item.note = item.note
            ? `${item.note} · ${info.deprecated}`
            : info.deprecated;
    });
}

export async function collectNpm(): Promise<InventoryItem[]> {
    log("→ npm packages (bun outdated)");
    const stdout = execFileSync("bun", ["outdated", "--filter", "*"], {
        encoding: "utf-8",
        maxBuffer: 32 * 1024 * 1024,
        timeout: 180_000,
    });
    const rows = parseOutdated(stdout);

    const byName = manifestsByName();
    const root =
        [...byName.values()].find((entry) => entry.file === ROOT_MANIFEST) ??
        null;

    const groups = new Map<
        string,
        { row: OutdatedRow; locations: Location[] }
    >();
    for (const row of rows) {
        const key = `${row.name}\u0000${row.current}`;
        const group = groups.get(key) ?? { row, locations: [] };
        group.locations.push(...locate(row, byName, root));
        groups.set(key, group);
    }

    const perName = new Map<string, number>();
    for (const { row } of groups.values()) {
        perName.set(row.name, (perName.get(row.name) ?? 0) + 1);
    }

    log(`  ${rows.length} outdated row(s), ${groups.size} pin(s)`);
    const items = [...groups.values()].map(({ row, locations }) =>
        buildItem(
            row,
            locations,
            perName.get(row.name) === 1
                ? `npm:${row.name}`
                : `npm:${row.name}@${row.current}`
        )
    );
    await enrich(items);
    // Workspace packages are unpublished, so the registry only ever 404s on them.
    const swept = await deprecatedButCurrent(
        new Set([...items.map((item) => item.name), ...byName.keys()])
    );
    return [...items, ...swept].sort(
        (a, b) =>
            a.name.localeCompare(b.name) || a.current.localeCompare(b.current)
    );
}
