import { describe, expect, it } from "vitest";
import type { Inventory, InventoryItem } from "./dependency/types";
import {
    appendixItems,
    composeBody,
    fingerprint,
    ISSUE_BODY_LIMIT,
    parseArgs,
    projectCell,
    REPORT_MARKER,
    readFingerprint,
    refreshComment,
    renderAppendix,
    stampOf,
} from "./upsert-dependency-issue";

const item = (
    over: Partial<InventoryItem> & { name: string }
): InventoryItem => ({
    id: `npm:${over.name}`,
    kind: "npm",
    surface: "npm",
    current: "^1.0.0",
    latest: "1.1.0",
    delta: "minor",
    needsUpdate: true,
    tier: "appendix",
    flags: [],
    source: `https://www.npmjs.com/package/${over.name}`,
    locations: [{ file: "package.json", line: 1 }],
    ...over,
});

const inventory = (items: InventoryItem[]): Inventory => ({
    generatedAt: "2026-09-21T00:00:00.000Z",
    repo: "frak-id/frak-wallet",
    floors: [],
    counts: {
        total: items.length,
        outdated: items.filter((i) => i.needsUpdate).length,
        research: 0,
        appendix: 0,
        flagged: 0,
        errors: 0,
        bySurface: { npm: 0, cargo: 0, infra: 0, ci: 0 },
    },
    items,
});

const many = (count: number): InventoryItem[] =>
    Array.from({ length: count }, (_, index) =>
        item({
            name: `@scope/package-with-a-fairly-long-name-${String(index).padStart(4, "0")}`,
            current: "^12.34.56",
            latest: "12.35.0",
        })
    );

describe("appendixItems", () => {
    it("keeps only outdated appendix-tier items", () => {
        const names = appendixItems(
            inventory([
                item({ name: "kept" }),
                item({ name: "researched", tier: "research" }),
                item({ name: "current", needsUpdate: false }),
            ])
        ).map((i) => i.name);
        expect(names).toEqual(["kept"]);
    });

    it("orders minor before patch, then by name", () => {
        const names = appendixItems(
            inventory([
                item({ name: "zulu", delta: "minor" }),
                item({ name: "bravo", delta: "patch" }),
                item({ name: "alpha", delta: "patch" }),
                item({ name: "charlie", delta: "minor" }),
            ])
        ).map((i) => i.name);
        expect(names).toEqual(["charlie", "zulu", "alpha", "bravo"]);
    });
});

describe("renderAppendix", () => {
    it("renders nothing when no routine bump is outstanding", () => {
        expect(renderAppendix(inventory([]), 10_000)).toBe("");
        expect(
            renderAppendix(
                inventory([item({ name: "a", needsUpdate: false })]),
                10_000
            )
        ).toBe("");
    });

    it("wraps the table in a collapsed details naming the count", () => {
        const out = renderAppendix(
            inventory([item({ name: "viem" }), item({ name: "zustand" })]),
            10_000
        );
        expect(out).toContain("### 🧾 Routine bumps (no research)");
        expect(out).toContain(
            "<summary>2 routine bumps (minor and patch)</summary>"
        );
        expect(out).toContain(
            "| Package | Project | Current | Latest | Delta | |"
        );
        expect(out.startsWith("### ")).toBe(true);
        expect(out.endsWith("</details>")).toBe(true);
        expect(out.split("<details>")).toHaveLength(2);
        expect(out.split("</details>")).toHaveLength(2);
    });

    it("singularises the summary for one bump", () => {
        expect(
            renderAppendix(inventory([item({ name: "a" })]), 10_000)
        ).toContain("<summary>1 routine bump (minor and patch)</summary>");
    });

    it("marks an in-range bump and leaves the cell empty otherwise", () => {
        const out = renderAppendix(
            inventory([
                item({ name: "in-range", meta: { inRange: "true" } }),
                item({ name: "pinned", meta: { inRange: "false" } }),
            ]),
            10_000
        );
        expect(out).toContain(
            "| `in-range` | — | `^1.0.0` | `1.1.0` | minor | ↻ |"
        );
        expect(out).toContain(
            "| `pinned` | — | `^1.0.0` | `1.1.0` | minor |  |"
        );
    });

    it("never renders locations", () => {
        const out = renderAppendix(inventory([item({ name: "a" })]), 10_000);
        expect(out).not.toContain("package.json");
    });

    it("names the owning workspace, or says no single one owns it", () => {
        const out = renderAppendix(
            inventory([
                item({ name: "owned", projects: ["apps/shopify"] }),
                item({
                    name: "shared",
                    projects: ["apps/wallet", "packages/design-system"],
                }),
            ]),
            10_000
        );
        expect(out).toContain("| `owned` | `apps/shopify` |");
        expect(out).toContain("| `shared` | cross-project (2) |");
    });

    it("escapes a pipe in an npm range so the table survives", () => {
        const out = renderAppendix(
            inventory([item({ name: "a", current: "^1.0.0 || ^2.0.0" })]),
            10_000
        );
        expect(out).toContain("`^1.0.0 \\|\\| ^2.0.0`");
    });

    it("truncates to the budget, closes the details, and says how many were dropped", () => {
        const items = many(400);
        const budget = 4_000;
        const out = renderAppendix(inventory(items), budget);

        expect(out.length).toBeLessThanOrEqual(budget);
        expect(out.endsWith("</details>")).toBe(true);
        expect(out).toContain("<summary>400 routine bumps (minor and patch)");

        const omitted = Number(
            /_\+(\d+) more routine bumps omitted/.exec(out)?.[1]
        );
        const shown = out.split("\n").filter((l) => l.startsWith("| `")).length;
        expect(shown).toBeGreaterThan(0);
        expect(shown + omitted).toBe(400);
    });

    it("keeps the highest-value rows when truncating", () => {
        const mixed = [
            ...many(20).map((i) => ({ ...i, delta: "patch" as const })),
            ...many(20).map((i) => ({
                ...i,
                name: `${i.name}-m`,
                delta: "minor" as const,
            })),
        ];
        const sorted = appendixItems(inventory(mixed)).map((i) => i.name);

        for (const budget of [1_000, 2_000, 3_000]) {
            const rows = renderAppendix(inventory(mixed), budget)
                .split("\n")
                .filter((line) => line.startsWith("| `"))
                .map((line) => line.split("`")[1]);
            expect(rows.length).toBeGreaterThan(0);
            expect(rows.length).toBeLessThan(mixed.length);
            expect(rows).toEqual(sorted.slice(0, rows.length));
            expect(rows[0]?.endsWith("-m")).toBe(true);
        }
    });

    it("falls back to a bare count when not even one row fits", () => {
        const out = renderAppendix(inventory(many(50)), 400);
        expect(out.length).toBeLessThanOrEqual(400);
        expect(out).toContain("### 🧾 Routine bumps (no research)");
        expect(out).toContain("50 routine bumps (minor and patch) omitted");
        expect(out).not.toContain("<details>");
    });

    it("renders nothing rather than broken markdown on an impossible budget", () => {
        expect(renderAppendix(inventory(many(50)), 20)).toBe("");
        expect(renderAppendix(inventory(many(50)), 0)).toBe("");
    });

    it("stays within budget across a wide range of budgets", () => {
        const fixture = inventory(many(300));
        for (const budget of [0, 50, 200, 500, 1_500, 5_000, 20_000, 60_000]) {
            const out = renderAppendix(fixture, budget);
            expect(out.length).toBeLessThanOrEqual(budget);
            if (out.includes("<details>")) {
                expect(out.endsWith("</details>")).toBe(true);
            }
        }
    });
});

describe("composeBody", () => {
    const report = `${REPORT_MARKER}\n## 📦 Dependency report`;

    it("refuses a body missing the marker", () => {
        const result = composeBody("## some other issue", inventory([]));
        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error).toContain(REPORT_MARKER);
    });

    it("appends the appendix after the agent body", () => {
        const result = composeBody(report, inventory([item({ name: "viem" })]));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.body.indexOf(REPORT_MARKER)).toBeLessThan(
            result.body.indexOf("### 🧾 Routine bumps")
        );
        expect(result.body.startsWith(REPORT_MARKER)).toBe(true);
    });

    it("leaves the body untouched when there is no routine bump", () => {
        const empty = inventory([]);
        const result = composeBody(report, empty);
        expect(result.ok && result.body).toBe(`${report}\n\n${stampOf(empty)}`);
        expect(result.ok && result.appendix).toBe("");
    });

    it("stamps a fingerprint a later run can read back", () => {
        const fixture = inventory([item({ name: "viem" })]);
        const result = composeBody(report, fixture);
        expect(result.ok).toBe(true);
        expect(result.ok && readFingerprint(result.body)).toBe(
            fingerprint(fixture)
        );
    });

    it("refuses a report already over the issue limit", () => {
        const result = composeBody(
            `${REPORT_MARKER}\n${"x".repeat(ISSUE_BODY_LIMIT)}`,
            inventory([])
        );
        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error).toContain("over GitHub's");
    });

    it("keeps the composed body inside the limit against a huge inventory", () => {
        for (const reportSize of [100, 30_000, 60_000, 65_000]) {
            const result = composeBody(
                `${REPORT_MARKER}\n${"x".repeat(reportSize)}`,
                inventory(many(900))
            );
            expect(result.ok).toBe(true);
            expect(result.ok && result.body.length).toBeLessThanOrEqual(
                ISSUE_BODY_LIMIT
            );
        }
    });
});

describe("refreshComment", () => {
    it("splits the outdated count into researched and routine", () => {
        const comment = refreshComment(
            inventory([
                item({ name: "a" }),
                item({ name: "b" }),
                item({ name: "c", tier: "research", delta: "major" }),
                item({ name: "d", needsUpdate: false }),
            ]),
            "2026-09-21"
        );
        expect(comment).toContain("Refreshed 2026-09-21");
        expect(comment).toContain("3 of 4 tracked dependencies are behind");
        expect(comment).toContain("(1 researched, 2 routine)");
    });
});

describe("projectCell", () => {
    it("falls back to a dash for a surface that has no projects", () => {
        expect(projectCell(item({ name: "tauri", projects: undefined }))).toBe(
            "—"
        );
        expect(projectCell(item({ name: "tauri", projects: [] }))).toBe("—");
    });
});

describe("fingerprint", () => {
    const base = () => inventory([item({ name: "viem" })]);

    it("ignores when the collector ran", () => {
        const later = base();
        later.generatedAt = "2027-01-01T00:00:00.000Z";
        expect(fingerprint(later)).toBe(fingerprint(base()));
    });

    it("ignores the order items arrive in", () => {
        const items = [item({ name: "a" }), item({ name: "b" })];
        expect(fingerprint(inventory([...items].reverse()))).toBe(
            fingerprint(inventory(items))
        );
    });

    it("moves when a version, tier, flag, project or location moves", () => {
        const before = fingerprint(base());
        const mutations: InventoryItem[] = [
            item({ name: "viem", latest: "1.2.0" }),
            item({ name: "viem", current: "^1.0.1" }),
            item({ name: "viem", tier: "research" }),
            item({ name: "viem", delta: "major" }),
            item({ name: "viem", flags: ["deprecated"] }),
            item({ name: "viem", projects: ["apps/wallet"] }),
            item({
                name: "viem",
                locations: [{ file: "apps/wallet/package.json", line: 4 }],
            }),
        ];
        for (const mutated of mutations) {
            expect(fingerprint(inventory([mutated]))).not.toBe(before);
        }
    });

    it("moves when an item is added or dropped", () => {
        expect(
            fingerprint(
                inventory([item({ name: "viem" }), item({ name: "a" })])
            )
        ).not.toBe(fingerprint(base()));
        expect(fingerprint(inventory([]))).not.toBe(fingerprint(base()));
    });
});

describe("readFingerprint", () => {
    it("treats a body with no stamp as moved", () => {
        expect(readFingerprint("## report")).toBeNull();
        expect(readFingerprint(null)).toBeNull();
        expect(readFingerprint(undefined)).toBeNull();
    });

    it("finds the stamp wherever it sits in the body", () => {
        const stamp = stampOf(inventory([item({ name: "viem" })]));
        expect(readFingerprint(`before\n${stamp}\nafter`)).toBe(
            fingerprint(inventory([item({ name: "viem" })]))
        );
    });
});

describe("parseArgs", () => {
    it("defaults every flag", () => {
        expect(parseArgs([], "2026-09-21")).toEqual({
            bodyFile: "dependency-report.md",
            inventoryFile: "dependency-inventory.json",
            label: "dependencies",
            title: "📦 Dependency report — week of 2026-09-21",
            dryRun: false,
            checkChanged: false,
            force: false,
        });
    });

    it("reads the gate switches", () => {
        const args = parseArgs(["--check-changed", "--force"], "2026-09-21");
        expect(args.checkChanged).toBe(true);
        expect(args.force).toBe(true);
    });

    it("reads explicit values and the dry-run switch", () => {
        expect(
            parseArgs(
                [
                    "--body",
                    "out.md",
                    "--inventory",
                    "inv.json",
                    "--label",
                    "deps",
                    "--title",
                    "Custom",
                    "--dry-run",
                ],
                "2026-09-21"
            )
        ).toEqual({
            bodyFile: "out.md",
            inventoryFile: "inv.json",
            label: "deps",
            title: "Custom",
            dryRun: true,
            checkChanged: false,
            force: false,
        });
    });

    it("falls back when a flag is passed without a value", () => {
        const args = parseArgs(["--title", "--dry-run"], "2026-09-21");
        expect(args.title).toBe("📦 Dependency report — week of 2026-09-21");
        expect(args.dryRun).toBe(true);
    });
});
