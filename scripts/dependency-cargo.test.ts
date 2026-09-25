import { describe, expect, it } from "vitest";
import {
    declRegex,
    highestStable,
    indexPath,
    inRange,
    lockedVersions,
} from "./dependency/collect-cargo";

const entry = (vers: string, yanked = false) =>
    JSON.stringify({ name: "demo", vers, yanked });

describe("indexPath", () => {
    it("shards a one-character name", () => {
        expect(indexPath("a")).toBe("1/a");
    });

    it("shards a two-character name", () => {
        expect(indexPath("os")).toBe("2/os");
    });
});

describe("inRange", () => {
    it("treats a leading zero minor as the breaking component", () => {
        expect(inRange("^0.14", "0.14.9")).toBe(true);
        expect(inRange("^0.14", "0.15.0")).toBe(false);
    });

    it("treats a leading zero patch as the breaking component", () => {
        expect(inRange("^0.0.3", "0.0.3")).toBe(true);
        expect(inRange("^0.0.3", "0.0.4")).toBe(false);
    });

    it("declines to judge a range operator cargo did not normalize", () => {
        expect(inRange(">=1.0, <2.0", "1.5.0")).toBe(false);
    });
});

describe("highestStable", () => {
    it("compares numerically rather than lexically", () => {
        expect(
            highestStable([entry("1.0.9"), entry("1.0.10")].join("\n"))
        ).toBe("1.0.10");
    });

    it("skips yanked releases", () => {
        const body = [entry("1.0.1"), entry("1.0.2", true)].join("\n");
        expect(highestStable(body)).toBe("1.0.1");
    });

    it("skips prereleases", () => {
        const body = [entry("2.0.0"), entry("2.1.0-rc.1")].join("\n");
        expect(highestStable(body)).toBe("2.0.0");
    });

    it("returns null for an empty body", () => {
        expect(highestStable("")).toBeNull();
    });
});

describe("lockedVersions", () => {
    it("is empty when there is no lockfile", () => {
        expect(lockedVersions("").size).toBe(0);
    });
});

describe("declRegex", () => {
    it("does not match a longer crate sharing the prefix", () => {
        expect(declRegex("serde").test('serde_json = "1.0"')).toBe(false);
    });

    it("does not match a crate that merely mentions the name", () => {
        expect(
            declRegex("tauri").test('tauri-build = { version = "2.6" }')
        ).toBe(false);
    });

    it("matches a dotted key", () => {
        expect(declRegex("serde").test("serde.workspace = true")).toBe(true);
    });
});
