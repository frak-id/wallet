import { build } from "bun";

const stage = process.env.STAGE ?? "dev";

console.log("Building...", { stage });
console.time("build-time");
const result = await build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    // Terser will handle minification
    minify: true,
    splitting: false,
    target: "bun",
    // Directly replace some known env during build time
    define: {
        // Replace public env variable with the current value
        "process.env.STAGE": JSON.stringify(stage),
    },
    // Drop any console or debugger related code
    drop: ["console", "debugger"],
    sourcemap: "linked",
});
console.timeEnd("build-time");

// In case of a failure in the first run build, early exit
if (!result.success) {
    console.error("Build failed");
    for (const message of result.logs) {
        // Bun will pretty print the message object
        console.error(message);
    }
}

// Display the result
console.log("Build messages:");
for (const message of result.logs) {
    console.log(message);
}
