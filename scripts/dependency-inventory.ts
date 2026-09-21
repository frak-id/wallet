#!/usr/bin/env bun
/**
 * One deterministic pass over every version pinned in this repo, resolved against its upstream
 * registry. Emits JSON — no prose, no judgement. Run: `bun run deps:inventory`.
 *
 * This output is the only version source the report agent may quote, so a collector that misses a
 * package silently removes it from the report. stdout stays a clean JSON document; progress is
 * logged through `log()` on stderr.
 */
import * as fs from "node:fs";
import { collectCargo } from "./dependency/collect-cargo";
import { collectCi } from "./dependency/collect-ci";
import { collectInfra } from "./dependency/collect-infra";
import { collectNpm } from "./dependency/collect-npm";
import { log } from "./dependency/registry";
import { FLOORS } from "./dependency/traps";
import type { Inventory, InventoryItem, Surface } from "./dependency/types";
import { tierFor } from "./dependency/types";

const SURFACES: Surface[] = ["infra", "ci", "cargo", "npm"];

const COLLECTORS: [string, () => Promise<InventoryItem[]>][] = [
    ["infra", collectInfra],
    ["ci", collectCi],
    ["cargo", collectCargo],
    ["npm", collectNpm],
];

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outFile = outIndex >= 0 ? args[outIndex + 1] : null;
const skipped = new Set(
    args.flatMap((arg, index) => (args[index - 1] === "--skip" ? [arg] : []))
);
const only = new Set(
    args.flatMap((arg, index) => (args[index - 1] === "--only" ? [arg] : []))
);

/**
 * Re-derived here rather than trusted from the collectors: tiering is the one decision the report
 * depends on to stay bounded, and a collector that forgets to call `tierFor` must not silently
 * promote hundreds of npm patches into the agent's reading list.
 */
function normalize(item: InventoryItem): InventoryItem {
    const flags = [...new Set(item.flags)];
    return { ...item, flags, tier: tierFor({ ...item, flags }) };
}

/**
 * Two collectors can legitimately reach the same pin from different directions — `sst` and
 * `@pulumi/kubernetes` are npm dependencies and infra pins at once. Earlier collectors win the
 * surface and trap; later ones only contribute locations.
 */
function merge(items: InventoryItem[]): InventoryItem[] {
    const byName = new Map<string, InventoryItem>();
    const sameLocation = (a: InventoryItem, b: InventoryItem): boolean =>
        a.locations.some((left) =>
            b.locations.some(
                (right) => left.file === right.file && left.line === right.line
            )
        );

    const kept: InventoryItem[] = [];
    for (const item of items) {
        const seen = byName.get(item.name);
        if (seen && sameLocation(seen, item)) {
            const known = new Set(
                seen.locations.map((l) => `${l.file}:${l.line}`)
            );
            seen.locations.push(
                ...item.locations.filter(
                    (l) => !known.has(`${l.file}:${l.line}`)
                )
            );
            const projects = new Set([
                ...(seen.projects ?? []),
                ...(item.projects ?? []),
            ]);
            if (projects.size > 0) seen.projects = [...projects].sort();
            log(`  merged duplicate \`${item.name}\` (${item.id})`);
            continue;
        }
        if (!seen) byName.set(item.name, item);
        kept.push(item);
    }

    const ids = new Set<string>();
    for (const item of kept) {
        if (ids.has(item.id)) {
            throw new Error(
                `duplicate item id \`${item.id}\` survived merging — two collectors claim the same pin at different locations`
            );
        }
        ids.add(item.id);
    }
    return kept;
}

/**
 * A collector that silently yields nothing produces a cheerful report saying
 * everything is current, and nobody notices for months. These are floors well
 * under the real counts, so only a break trips them.
 */
const FLOORS_BY_SURFACE: Record<Surface, number> = {
    npm: 20,
    cargo: 10,
    infra: 5,
    ci: 15,
};

function assertPlausible(items: InventoryItem[]): void {
    const ran = new Set(
        COLLECTORS.map(([name]) => name).filter(
            (name) => !skipped.has(name) && (only.size === 0 || only.has(name))
        )
    );
    const thin = SURFACES.filter((surface) => ran.has(surface)).filter(
        (surface) =>
            items.filter((item) => item.surface === surface).length <
            FLOORS_BY_SURFACE[surface]
    );
    if (thin.length === 0) return;
    const detail = thin
        .map(
            (surface) =>
                `${surface} yielded ${items.filter((i) => i.surface === surface).length}, expected at least ${FLOORS_BY_SURFACE[surface]}`
        )
        .join("; ");
    throw new Error(
        `implausibly thin inventory (${detail}) — treat this as a broken collector, not as good news`
    );
}

async function main(): Promise<void> {
    const items: InventoryItem[] = [];
    for (const [name, collect] of COLLECTORS) {
        if (skipped.has(name) || (only.size > 0 && !only.has(name))) {
            log(`→ ${name} (skipped)`);
            continue;
        }
        try {
            items.push(...(await collect()).map(normalize));
        } catch (error) {
            log(`  ! collector \`${name}\` crashed: ${error}`);
        }
    }

    const merged = merge(items);
    assertPlausible(merged);
    merged.sort(
        (a, b) =>
            SURFACES.indexOf(a.surface) - SURFACES.indexOf(b.surface) ||
            a.kind.localeCompare(b.kind) ||
            a.name.localeCompare(b.name)
    );

    const count = (predicate: (item: InventoryItem) => boolean): number =>
        merged.filter(predicate).length;

    const inventory: Inventory = {
        generatedAt: new Date().toISOString(),
        repo: process.env.GITHUB_REPOSITORY ?? "frak-id/frak-wallet",
        floors: FLOORS,
        counts: {
            total: merged.length,
            outdated: count((item) => item.needsUpdate),
            research: count((item) => item.tier === "research"),
            appendix: count(
                (item) => item.needsUpdate && item.tier === "appendix"
            ),
            flagged: count((item) => item.flags.length > 0),
            errors: count((item) => item.flags.includes("lookup-failed")),
            bySurface: Object.fromEntries(
                SURFACES.map((surface) => [
                    surface,
                    count((item) => item.surface === surface),
                ])
            ) as Record<Surface, number>,
        },
        items: merged,
    };

    const json = `${JSON.stringify(inventory, null, 2)}\n`;
    if (outFile) {
        fs.writeFileSync(outFile, json);
        log(`\nWrote ${outFile}`);
    } else {
        process.stdout.write(json);
    }

    const { total, outdated, research, appendix, flagged, errors } =
        inventory.counts;
    log(
        `\nSummary: ${total} tracked, ${outdated} outdated ` +
            `(${research} to research, ${appendix} routine), ` +
            `${flagged} flagged, ${errors} unresolved`
    );
}

main().catch((error) => {
    console.error("Fatal:", error);
    process.exit(1);
});
