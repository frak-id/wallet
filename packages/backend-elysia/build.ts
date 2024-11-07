import { build, write } from "bun";
import { minify } from "terser";

console.log("Building...", { stage: process.env.STAGE });
console.time("build-time");
const result = await build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    // Terser will handle minification
    minify: false,
    target: "bun",
    // Directly replace some known env during build time
    define: {
        // Replace public env variable with the current value
        "process.env.STAGE": JSON.stringify(process.env.STAGE ?? "dev"),
    },
    // Drop any console or debugger related code
    drop: ["console", "debugger"],
    sourcemap: "none",
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

console.log("Output files:");
for (const output of result.outputs) {
    console.log(
        ` - ${output.path}: Initial build ${output.size} bytes (${output.kind})`
    );

    if (output.kind !== "entry-point" && output.kind !== "chunk") {
        continue;
    }

    // Read the src code directly
    const srcCode = await output.text();

    // Send it to terser for further optimisation
    const isTopLevel = output.kind === "entry-point";
    console.time(`terser-${output.path}`);
    const minified = await minify(srcCode, {
        toplevel: isTopLevel,
        compress: {
            // Drop debugger + console (should have been done by bun)
            drop_debugger: true,
            drop_console: true,
            // Drop unused code at the top level
            toplevel: isTopLevel,
            // Drop unused function arguments
            keep_fargs: false,
            // Multi pass to ensure we evict all the env specific code
            passes: 3,
            // We use the latest ecma script version with bun
            ecma: 2020,
        },
        mangle: {
            toplevel: isTopLevel,
        },
    });
    console.timeEnd(`terser-${output.path}`);
    const finalName = output.path.replace(".js", "-terser.js");
    if (minified.code) {
        console.log(
            ` - ${output.path}: Terser minification from ${srcCode.length} to ${minified.code.length}`
        );
        await write(finalName, minified.code);
    }
}
