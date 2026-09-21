import { describe, expect, it } from "vitest";
import {
    consumersOf,
    isCatalogRow,
    locate,
    type Manifest,
    type OutdatedRow,
    parseOutdated,
    projectsFor,
} from "./dependency/collect-npm";

const table = [
    "bun outdated v1.4.2 (744846f84)",
    '[1.11ms] ".env"',
    "|------|------|------|------|------|",
    "| Package | Current | Update | Latest | Workspace |",
    "|------|------|------|------|------|",
].join("\n");

const row = (overrides: Partial<OutdatedRow> = {}): OutdatedRow => ({
    name: "viem",
    current: "2.56.3",
    update: "2.56.3",
    latest: "2.60.0",
    workspace: "frak-wallet",
    ...overrides,
});

describe("parseOutdated", () => {
    it("throws when the header no longer matches the expected columns", () => {
        const renamed = table.replace("| Package |", "| Name |");
        expect(() => parseOutdated(renamed)).toThrow(
            /table shape changed.*Name/s
        );
    });

    it("throws rather than returning nothing when the table is absent", () => {
        expect(() =>
            parseOutdated("bun outdated v1.4.2\nall up to date")
        ).toThrow(/table shape changed/);
    });

    it("quotes the first lines of output so a shape change is diagnosable", () => {
        expect(() => parseOutdated("surprise banner\nsecond\nthird")).toThrow(
            /surprise banner/
        );
    });
});

describe("isCatalogRow", () => {
    it("does not match a workspace whose name merely starts with catalog", () => {
        expect(isCatalogRow("catalogue-app")).toBe(false);
        expect(isCatalogRow("@frak-labs/nexus-wallet")).toBe(false);
    });
});

describe("consumersOf", () => {
    it("reads the consumers a catalog row names in parentheses", () => {
        expect(
            consumersOf(row({ workspace: "catalog (@a/one, @a/two)" }))
        ).toEqual(["@a/one", "@a/two"]);
    });

    it("yields nothing for a bare catalog row, which names no consumer", () => {
        expect(consumersOf(row({ workspace: "catalog" }))).toEqual([]);
    });

    it("yields the single workspace for an ordinary row", () => {
        expect(consumersOf(row({ workspace: "@a/one" }))).toEqual(["@a/one"]);
        expect(consumersOf(row({ workspace: "" }))).toEqual([]);
    });
});

describe("projectsFor", () => {
    const manifest = (file: string): Manifest => ({ file, lines: [] });
    const byName = new Map([
        ["@frak-labs/nexus-wallet", manifest("apps/wallet/package.json")],
        [
            "@frak-labs/design-system",
            manifest("packages/design-system/package.json"),
        ],
        ["frak-wallet", manifest("package.json")],
    ]);

    it("maps a workspace name to the directory that declares it", () => {
        expect(
            projectsFor(row({ workspace: "@frak-labs/nexus-wallet" }), byName)
        ).toEqual(["apps/wallet"]);
    });

    it("reports the root workspace as `.`", () => {
        expect(projectsFor(row({ workspace: "frak-wallet" }), byName)).toEqual([
            ".",
        ]);
    });

    it("fans a catalog row out across every consumer", () => {
        expect(
            projectsFor(
                row({
                    workspace:
                        "catalog (@frak-labs/nexus-wallet, @frak-labs/design-system)",
                }),
                byName
            )
        ).toEqual(["apps/wallet", "packages/design-system"]);
    });

    it("drops a consumer it cannot resolve rather than inventing a path", () => {
        expect(
            projectsFor(row({ workspace: "catalog (@a/unknown)" }), byName)
        ).toEqual([]);
    });
});

describe("locate", () => {
    const root = {
        file: "package.json",
        lines: ["{", '  "catalog": {', '    "viem": "^2.56.3"', "  }", "}"],
    };
    const app = {
        file: "apps/wallet/package.json",
        lines: [
            "{",
            '  "dependencies": {',
            '    "viem": "catalog:"',
            "  }",
            "}",
        ],
    };
    const byName = new Map([["@frak-labs/nexus-wallet", app]]);

    it("returns no location for a workspace it cannot resolve", () => {
        expect(
            locate(row({ workspace: "@frak-labs/unknown" }), byName, root)
        ).toEqual([]);
    });

    it("returns no location for a catalog entry that is not in the catalog", () => {
        expect(
            locate(
                row({ name: "missing", workspace: "catalog (a)" }),
                byName,
                root
            )
        ).toEqual([]);
    });

    it("returns no location for a catalog row when the root is unreadable", () => {
        expect(locate(row({ workspace: "catalog (a)" }), byName, null)).toEqual(
            []
        );
    });
});
