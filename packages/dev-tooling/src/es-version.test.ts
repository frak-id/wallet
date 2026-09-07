import * as fsSync from "node:fs";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertEsVersion, NothingScannedError } from "./es-version";

describe("assertEsVersion", () => {
    let dir: string;
    let root: string;

    const write = (source: string, name = "chunk.js") => {
        fsSync.mkdirSync(root, { recursive: true });
        fsSync.writeFileSync(path.join(root, name), source, "utf-8");
    };

    const run = (enforce = true) => assertEsVersion({ root, enforce });

    beforeEach(() => {
        dir = fsSync.mkdtempSync(path.join(tmpdir(), "dev-tooling-esver-"));
        root = path.join(dir, "out");
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it("rejects an ES2024 stdlib call the type layer cannot catch", async () => {
        write("export const p = Promise.withResolvers().promise;\n");
        await expect(run()).rejects.toThrow(/above the es2022 floor/);
    });

    it("scans .cjs and .mjs, not just .js", async () => {
        // sdk/core, sdk/react and packages/rpc all publish a .cjs entry
        // through the require condition, so an extension filter that misses
        // them leaves published artifacts unparsed.
        write("exports.x = [3, 1, 2].toSorted();\n", "index.cjs");
        await expect(run()).rejects.toThrow(/above the es2022 floor/);
    });

    it("also scans .mjs", async () => {
        write("export const x = [3, 1, 2].toSorted();\n", "index.mjs");
        await expect(run()).rejects.toThrow(/above the es2022 floor/);
    });

    it("types a nothing-scanned failure distinctly from a violation", async () => {
        // Callers scanning several directories route these to opposite
        // remedies — build first, versus fix the code — so the distinction
        // cannot rest on message text.
        await expect(run()).rejects.toBeInstanceOf(NothingScannedError);
        write("export const x = [1].at(-1);\n");
        await expect(run()).resolves.toBeUndefined();
        write("export const y = [3, 1, 2].toSorted();\n", "bad.js");
        await expect(run()).rejects.not.toBeInstanceOf(NothingScannedError);
    });

    it("rejects an ES2023 array method", async () => {
        write("export const x = [3, 1, 2].toSorted();\n");
        await expect(run()).rejects.toThrow(/above the es2022 floor/);
    });

    it("rejects syntax the bundler emits verbatim below target", async () => {
        write("using handle = getHandle();\nexport const y = handle;\n");
        await expect(run()).rejects.toThrow(/above the es2022 floor/);
    });

    it("accepts ES2022-and-below APIs", async () => {
        write(
            "export const a = Object.hasOwn({}, 'k');\nexport const b = [1].at(-1);\nexport const c = new Error('x', { cause: 'y' });\n"
        );
        await expect(run()).resolves.toBeUndefined();
    });

    it("accepts ESM import/export syntax", async () => {
        write("import { x } from './other.js';\nexport const y = x;\n");
        await expect(run()).resolves.toBeUndefined();
    });

    it("logs without throwing when enforce is false", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        write("export const x = [3, 1, 2].toSorted();\n");
        await expect(run(false)).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("chunk.js"));
        warn.mockRestore();
    });

    it("fails rather than passing when the scanned dir is missing", async () => {
        await expect(run()).rejects.toThrow(/cannot read/);
    });

    it("rejects above-floor syntax the stdlib pass cannot see", async () => {
        write("export const r = /[\\p{ASCII}]/v;\n");
        await expect(run()).rejects.toThrow(/above the es2022 floor/);
    });

    it("exempts an ignored name only in the chunks it is scoped to", async () => {
        write("export const x = coll.toSorted(cmp);\n", "ui-vendor.js");
        await expect(
            assertEsVersion({
                root,
                ignore: { features: "ArrayToSorted", in: "ui-vendor" },
            })
        ).resolves.toBeUndefined();
    });

    it("partitions a mixed set, exempting only the scoped chunk", async () => {
        write("export const x = coll.toSorted(cmp);\n", "ui-vendor.js");
        write("export const y = [3, 1, 2].toSorted();\n", "app.js");
        const failure = assertEsVersion({
            root,
            ignore: { features: "ArrayToSorted", in: "ui-vendor" },
        });
        await expect(failure).rejects.toThrow(/app\.js/);
        await expect(failure).rejects.not.toThrow(/ui-vendor\.js/);
    });

    it("fails rather than passing when the root holds no JS", async () => {
        fsSync.mkdirSync(root, { recursive: true });
        await expect(run()).rejects.toThrow(/nothing was checked/);
    });

    it("scans nested chunk directories", async () => {
        fsSync.mkdirSync(path.join(root, "nested"), { recursive: true });
        fsSync.writeFileSync(
            path.join(root, "nested", "deep.js"),
            "export const x = [3, 1, 2].toSorted();\n",
            "utf-8"
        );
        await expect(run()).rejects.toThrow(/above the es2022 floor/);
    });
});
