import * as fsSync from "node:fs";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    assertEagerBundleBudget,
    collectEagerClosure,
    preconnectOrigins,
} from "./vite";

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

    it("logs but does not throw when over budget with enforce: false", () => {
        writeEagerFixture(`console.log(${JSON.stringify("x".repeat(5000))});`);
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const plugin = assertEagerBundleBudget({
            budgetGzip: 1,
            enforce: false,
        }) as unknown as WriteBundlePlugin;

        expect(() => plugin.writeBundle({ dir })).not.toThrow();
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining("Eager boot JS budget exceeded")
        );

        warn.mockRestore();
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

describe("preconnectOrigins", () => {
    type TransformIndexHtmlPlugin = {
        transformIndexHtml: () => {
            tag: string;
            attrs: Record<string, string>;
            injectTo: string;
        }[];
    };

    const tagsFor = (
        origins: Parameters<typeof preconnectOrigins>[0]["origins"]
    ) =>
        (
            preconnectOrigins({
                origins,
            }) as unknown as TransformIndexHtmlPlugin
        ).transformIndexHtml();

    it("emits a hint for the origin, dropping any path", () => {
        const tags = tagsFor([{ url: "https://backend.example.test/v1/api" }]);

        expect(tags).toHaveLength(1);
        expect(tags[0].tag).toBe("link");
        expect(tags[0].attrs).toEqual({
            rel: "preconnect",
            href: "https://backend.example.test",
        });
    });

    it("lands ahead of the injected module scripts", () => {
        // `head` appends after them, which puts the hint behind the downloads
        // it is meant to run alongside and costs the entire optimisation.
        expect(tagsFor([{ url: "https://a.example.test" }])[0].injectTo).toBe(
            "head-prepend"
        );
    });

    it("carries the CORS mode the eventual request will use", () => {
        const tags = tagsFor([
            { url: "https://a.example.test", crossorigin: "use-credentials" },
        ]);

        expect(tags[0].attrs.crossorigin).toBe("use-credentials");
    });

    it("keeps one connection per mode for the same origin", () => {
        // An origin fetched both with and without credentials needs both: a
        // connection opened under one mode cannot serve the other.
        const tags = tagsFor([
            { url: "https://a.example.test" },
            { url: "https://a.example.test", crossorigin: "use-credentials" },
        ]);

        expect(tags).toHaveLength(2);
        expect(tags.map((t) => t.attrs.crossorigin)).toEqual([
            undefined,
            "use-credentials",
        ]);
    });

    it("collapses a repeated origin in the same mode", () => {
        const tags = tagsFor([
            { url: "https://a.example.test/one" },
            { url: "https://a.example.test/two" },
        ]);

        expect(tags).toHaveLength(1);
    });

    it("drops entries it cannot turn into an origin", () => {
        const tags = tagsFor([
            { url: undefined },
            { url: "not a url" },
            { url: "file:///etc/hosts" },
            { url: "https://good.example.test" },
        ]);

        expect(tags).toHaveLength(1);
        expect(tags[0].attrs.href).toBe("https://good.example.test");
    });
});
