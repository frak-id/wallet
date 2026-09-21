import { describe, expect, it } from "vitest";
import {
    isCatalogRow,
    locate,
    type OutdatedRow,
    parseOutdated,
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
