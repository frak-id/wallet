import { build } from "bun";

console.log("Building bootstrap...");
console.time("build-time");
const result = await build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    minify: true,
    splitting: false,
    target: "bun",
    // sharp and @libsql/client ship native bindings that cannot be bundled;
    // they are installed in the runtime image instead (same approach as
    // services/backend).
    external: ["sharp", "@libsql/client"],
    drop: ["debugger"],
    sourcemap: "linked",
});
console.timeEnd("build-time");

if (!result.success) {
    console.error("Build failed");
    for (const message of result.logs) {
        console.error(message);
    }
    process.exit(1);
}

for (const message of result.logs) {
    console.log(message);
}
