import { build } from "bun";

console.log("Building...");
console.time("build-time");
const result = await build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    minify: true,
    target: "bun",
    // todo: Define a few env specific stuff to reduce runtime impact of `Config.` loading?
    define: {
        __PRECOMPILE__: "true",
    },
});
console.timeEnd("build-time");

// Display the result
if (result.success) {
    console.log("Build succeeded");
    for (const message of result.logs) {
        console.log(message);
    }

    console.log("Output files:");
    for (const output of result.outputs) {
        console.log(` - ${output.path} - ${output.size} bytes`);
    }
} else {
    console.error("Build failed");
    for (const message of result.logs) {
        // Bun will pretty print the message object
        console.error(message);
    }
}
