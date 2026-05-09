import { minify } from "@swc/core";
import { build } from "bun";

const stage = process.env.STAGE ?? "dev";

console.log("Building...", { stage });
console.time("build-time");

// Pass 1: Bun bundles + define replacements (no minify)
console.time("pass-1-bun");
const bunResult = await build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    minify: false,
    splitting: false,
    target: "bun",
    external: ["sharp", "lightningcss"],
    packages: "bundle",
    define: {
        "process.env.STAGE": JSON.stringify(stage),
        "process.env.NODE_ENV": JSON.stringify("production"),
    },
    drop: ["console", "debugger"],
    sourcemap: "none",
});
console.timeEnd("pass-1-bun");

if (!bunResult.success) {
    console.error("Bun build failed");
    for (const message of bunResult.logs) {
        console.error(message);
    }
    process.exit(1);
}

// Pass 2: SWC inlines constants (reduce_vars/collapse_vars) + eliminates dead branches
console.time("pass-2-swc");
const bundled = await Bun.file("./dist/index.js").text();
const minified = await minify(bundled, {
    ecma: 2020,
    module: true,
    toplevel: true,
    compress: {
        ecma: 2020,
        passes: 3,
        toplevel: true,
        reduce_vars: true,
        collapse_vars: true,
        dead_code: true,
        conditionals: true,
        evaluate: true,
        booleans: true,
        switches: true,
        unused: true,
        drop_console: true,
        drop_debugger: true,
    },
    mangle: { toplevel: true },
    sourceMap: false,
});
console.timeEnd("pass-2-swc");

if (!minified.code) {
    console.error("SWC minification failed");
    process.exit(1);
}

await Bun.write("./dist/index.js", minified.code);

console.timeEnd("build-time");
