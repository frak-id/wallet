import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    type Budget,
    type BudgetEntry,
    isOverBudget,
    measureBudget,
} from "./check-bundle-size";

let root: string;

beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "bundle-size-"));
});

afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

const noise = (seed: number, length = 4000) => {
    let state = seed;
    let out = "";
    for (let i = 0; i < length; i++) {
        state = (state * 1103515245 + 12345) % 2147483648;
        out += String.fromCharCode(97 + (state % 26));
    }
    return out;
};

const write = (name: string, content: string) => {
    const file = path.join(root, "out", name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
};

const gz = (content: string) => gzipSync(content).length;

const budgetFor = (entry: BudgetEntry, maxGzipBytes: number): Budget => ({
    label: "fixture",
    dir: "out",
    entry,
    maxGzipBytes,
    why: "a fixture",
    buildCommand: "build it",
});

describe("measureBudget", () => {
    it("passes a file under its budget", () => {
        const code = `var a="${noise(1)}";`;
        write("bundle.js", code);
        const result = measureBudget(
            budgetFor({ kind: "file", name: "bundle.js" }, gz(code) + 1),
            root
        );
        expect(result).toMatchObject({
            kind: "measured",
            gzipBytes: gz(code),
        });
        expect(isOverBudget(result)).toBe(false);
    });

    it("fails a file over its budget", () => {
        const code = `var a="${noise(2)}";`;
        write("bundle.js", code);
        const result = measureBudget(
            budgetFor({ kind: "file", name: "bundle.js" }, gz(code) - 1),
            root
        );
        expect(isOverBudget(result)).toBe(true);
    });

    it("counts a statically imported chunk and skips a dynamic one", () => {
        const entry = `import{a}from"./dep-abcd1234.js";import("./lazy-abcd1234.js");export{a};`;
        const dep = `export const a="${noise(3)}";`;
        write("Modal-abcd1234.js", entry);
        write("dep-abcd1234.js", dep);
        write("lazy-abcd1234.js", `export const b="${noise(4)}";`);
        const result = measureBudget(
            budgetFor({ kind: "chunk", name: "Modal" }, 1_000_000),
            root
        );
        expect(result).toMatchObject({
            kind: "measured",
            gzipBytes: gz(entry) + gz(dep),
        });
    });

    it("reports a missing output directory", () => {
        const result = measureBudget(
            budgetFor({ kind: "file", name: "bundle.js" }, 1000),
            path.join(root, "nowhere")
        );
        expect(result).toMatchObject({ kind: "missing" });
    });

    it("reports a chunk that no longer exists", () => {
        write("other-abcd1234.js", "export{};");
        const result = measureBudget(
            budgetFor({ kind: "chunk", name: "Modal" }, 1000),
            root
        );
        expect(result).toMatchObject({ kind: "missing" });
    });

    it("reports an ambiguous chunk", () => {
        write("Modal-abcd1234.js", "export{};");
        write("Modal-efgh5678.js", "export{};");
        const result = measureBudget(
            budgetFor({ kind: "chunk", name: "Modal" }, 1000),
            root
        );
        expect(result).toMatchObject({
            kind: "missing",
            reason: expect.stringContaining("ambiguous"),
        });
    });

    it("does not match a longer chunk name as the same chunk", () => {
        write("Modal-abcd1234.js", "export{};");
        write("Modal-Extra-abcd1234.js", "export{};");
        const result = measureBudget(
            budgetFor({ kind: "chunk", name: "Modal" }, 1000),
            root
        );
        expect(result.kind).toBe("measured");
    });
});
