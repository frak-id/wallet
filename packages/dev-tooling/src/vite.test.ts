import * as fsSync from "node:fs";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    assertBundleEsVersion,
    assertEagerBundleBudget,
    collectEagerClosure,
    preconnectOrigins,
} from "./vite";

type WriteBundlePlugin = {
    writeBundle: (options: { dir?: string }) => void;
    configResolved?: (config: { base?: string }) => void;
};

type AsyncWriteBundlePlugin = {
    writeBundle: (options: { dir?: string }) => Promise<void>;
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

    it("strips a non-root base from the served src before walking", () => {
        // The listener serves under `/listener/`, so its HTML carries
        // `src="/listener/assets/entry.js"` while the chunk sits at
        // `assets/entry.js` on disk. The gate once measured this as
        // 0 chunks / 0.00 KB and passed — a defeated budget, not a light app.
        fsSync.writeFileSync(
            path.join(dir, "index.html"),
            `<script type="module" src="/listener/assets/entry.js"></script>`,
            "utf-8"
        );
        fsSync.writeFileSync(
            path.join(dir, "assets", "entry.js"),
            `console.log(${JSON.stringify("x".repeat(5000))});`,
            "utf-8"
        );

        const plugin = assertEagerBundleBudget({
            budgetGzip: 1,
        }) as unknown as WriteBundlePlugin;
        plugin.configResolved?.({ base: "/listener" });

        expect(() => plugin.writeBundle({ dir })).toThrow(
            /Eager boot JS budget exceeded/
        );
    });

    it("fails loud when no entry script resolves to an on-disk chunk", () => {
        // A src the path mapping cannot place must not read as a 0-chunk pass.
        fsSync.writeFileSync(
            path.join(dir, "index.html"),
            `<script type="module" src="/elsewhere/assets/entry.js"></script>`,
            "utf-8"
        );

        const plugin = assertEagerBundleBudget({
            budgetGzip: 1024,
            enforce: false,
        }) as unknown as WriteBundlePlugin;

        expect(() => plugin.writeBundle({ dir })).toThrow(
            /served-path to output-path mapping is broken/
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

describe("assertBundleEsVersion", () => {
    let dir: string;

    const write = (source: string, ...segments: string[]) => {
        const target = path.join(dir, ...segments);
        fsSync.mkdirSync(path.dirname(target), { recursive: true });
        fsSync.writeFileSync(target, source, "utf-8");
    };

    const violation = "export const x = [3, 1, 2].toSorted();\n";

    beforeEach(() => {
        dir = fsSync.mkdtempSync(path.join(tmpdir(), "dev-tooling-esver-"));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it("scans the subdir under the emitted dir", async () => {
        write(violation, "standalone", "chunk.js");
        const plugin = assertBundleEsVersion({
            subdir: "standalone",
        }) as unknown as AsyncWriteBundlePlugin;
        await expect(plugin.writeBundle({ dir })).rejects.toThrow(
            /above the es2022 floor/
        );
    });

    it("scans the emitted dir itself when no subdir is given", async () => {
        write(violation, "chunk.js");
        const plugin =
            assertBundleEsVersion() as unknown as AsyncWriteBundlePlugin;
        await expect(plugin.writeBundle({ dir })).rejects.toThrow(
            /above the es2022 floor/
        );
    });

    it("returns without scanning when the build reports no dir", async () => {
        const plugin =
            assertBundleEsVersion() as unknown as AsyncWriteBundlePlugin;
        await expect(plugin.writeBundle({})).resolves.toBeUndefined();
    });

    it("declares no environment filter when none is configured", () => {
        expect(assertBundleEsVersion().applyToEnvironment).toBeUndefined();
    });

    const resolve = (
        environments: string[],
        known: string[] = ["client", "ssr"]
    ) => {
        const hook = assertBundleEsVersion({ subdir: "assets", environments })
            .configResolved as
            | ((config: { environments: Record<string, unknown> }) => void)
            | undefined;
        if (typeof hook !== "function") {
            throw new Error("expected a configResolved hook");
        }
        return () =>
            hook({
                environments: Object.fromEntries(known.map((n) => [n, {}])),
            });
    };

    it("rejects an environment name no build declares", () => {
        // Vite drops an unapplied plugin silently, so a typo would remove the
        // gate from every environment and still report a green build.
        expect(resolve(["cleint"])).toThrow(/no such build environment/);
        expect(resolve(["cleint"])).toThrow(/client, ssr/);
    });

    it("rejects an empty environment list", () => {
        // `[]` is truthy, so it would otherwise install a predicate that is
        // false for every environment — the same silent drop.
        expect(resolve([])).toThrow(/no such build environment/);
    });

    it("accepts a name the build declares", () => {
        expect(resolve(["client"])).not.toThrow();
    });

    it("filters environments through vite rather than at scan time", () => {
        // Declarative on purpose: vite resolves this, so a name matching
        // nothing yields no plugin. A runtime guard would instead skip
        // silently and report success for a gate that never ran.
        const apply = assertBundleEsVersion({
            subdir: "assets",
            environments: ["client"],
        }).applyToEnvironment;
        if (typeof apply !== "function") {
            throw new Error("expected an applyToEnvironment predicate");
        }
        expect(apply({ name: "client" } as never)).toBe(true);
        expect(apply({ name: "ssr" } as never)).toBe(false);
    });

    it("forwards enforce to the core", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        write(violation, "assets", "chunk.js");
        const plugin = assertBundleEsVersion({
            subdir: "assets",
            enforce: false,
        }) as unknown as AsyncWriteBundlePlugin;
        await expect(plugin.writeBundle({ dir })).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("chunk.js"));
        warn.mockRestore();
    });

    it("forwards ignore to the core", async () => {
        write(violation, "assets", "ui-vendor.js");
        const plugin = assertBundleEsVersion({
            subdir: "assets",
            ignore: { features: "ArrayToSorted", in: "ui-vendor" },
        }) as unknown as AsyncWriteBundlePlugin;
        await expect(plugin.writeBundle({ dir })).resolves.toBeUndefined();
    });
});
