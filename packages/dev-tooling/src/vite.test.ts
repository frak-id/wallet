import * as fsSync from "node:fs";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertEagerBundleBudget, collectEagerClosure } from "./vite";

type WriteBundlePlugin = {
    writeBundle: (options: { dir?: string }) => void;
};

describe("collectEagerClosure", () => {
    let dir: string;

    beforeEach(() => {
        dir = fsSync.mkdtempSync(path.join(tmpdir(), "dev-tooling-eager-"));
        fsSync.mkdirSync(path.join(dir, "assets"), { recursive: true });
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    function writeChunk(name: string, code: string) {
        fsSync.writeFileSync(path.join(dir, "assets", name), code, "utf-8");
    }

    it("walks the transitive static-import closure from the entry", () => {
        writeChunk(
            "entry.js",
            `import { a } from "./a.js";\nimport "./b.js";\nconsole.log(a);`
        );
        writeChunk("a.js", `export { c } from "./c.js";\nexport const a = 1;`);
        writeChunk("b.js", `console.log("b");`);
        writeChunk("c.js", `export const c = 1;`);

        const eager = collectEagerClosure(dir, ["assets/entry.js"]);

        expect([...eager.keys()].sort()).toEqual([
            "assets/a.js",
            "assets/b.js",
            "assets/c.js",
            "assets/entry.js",
        ]);
    });

    it("excludes dynamic import() and assets/*.js preload-helper dep arrays", () => {
        writeChunk(
            "entry.js",
            [
                'import { a } from "./a.js";',
                'const lazy = () => import("./lazy.js");',
                'const deps = ["assets/lazy-Xy12.js", "assets/other-Ab34.js"];',
                "console.log(a, lazy, deps);",
            ].join("\n")
        );
        writeChunk("a.js", `export const a = 1;`);
        writeChunk("lazy.js", `export const lazy = 1;`);

        const eager = collectEagerClosure(dir, ["assets/entry.js"]);

        expect([...eager.keys()].sort()).toEqual([
            "assets/a.js",
            "assets/entry.js",
        ]);
    });

    it("returns just the entry when it has no static imports", () => {
        writeChunk("entry.js", `console.log("boot");`);

        const eager = collectEagerClosure(dir, ["assets/entry.js"]);

        expect([...eager.keys()]).toEqual(["assets/entry.js"]);
    });

    it("skips a missing/unreadable chunk without throwing", () => {
        writeChunk("entry.js", `import "./missing.js";\nconsole.log(1);`);

        expect(() =>
            collectEagerClosure(dir, ["assets/entry.js"])
        ).not.toThrow();

        const eager = collectEagerClosure(dir, ["assets/entry.js"]);
        expect([...eager.keys()]).toEqual(["assets/entry.js"]);
    });
});

describe("assertEagerBundleBudget", () => {
    let dir: string;

    beforeEach(() => {
        dir = fsSync.mkdtempSync(path.join(tmpdir(), "dev-tooling-budget-"));
        fsSync.mkdirSync(path.join(dir, "assets"), { recursive: true });
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    function writeEagerFixture(entryBody: string) {
        fsSync.writeFileSync(
            path.join(dir, "index.html"),
            `<script type="module" src="/assets/entry.js"></script>`,
            "utf-8"
        );
        fsSync.writeFileSync(
            path.join(dir, "assets", "entry.js"),
            entryBody,
            "utf-8"
        );
    }

    it("passes when the eager closure is at or under budget", () => {
        writeEagerFixture(`console.log("boot");`);

        const plugin = assertEagerBundleBudget({
            budgetGzip: 1024,
        }) as unknown as WriteBundlePlugin;

        expect(() => plugin.writeBundle({ dir })).not.toThrow();
    });

    it("throws with a breakdown when the eager closure exceeds budget", () => {
        writeEagerFixture(`console.log(${JSON.stringify("x".repeat(5000))});`);

        const plugin = assertEagerBundleBudget({
            budgetGzip: 1,
        }) as unknown as WriteBundlePlugin;

        expect(() => plugin.writeBundle({ dir })).toThrow(
            /Eager boot JS budget exceeded/
        );
    });

    it("runs the optional assertHtml hook before the budget check", () => {
        writeEagerFixture(`console.log("boot");`);

        const plugin = assertEagerBundleBudget({
            budgetGzip: 1024,
            assertHtml: () => {
                throw new Error("custom html check failed");
            },
        }) as unknown as WriteBundlePlugin;

        expect(() => plugin.writeBundle({ dir })).toThrow(
            "custom html check failed"
        );
    });
});
