import { build } from "bun";

console.log("Building credential-sync...");
console.time("build-time");
const result = await build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    minify: true,
    splitting: false,
    target: "bun",
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
