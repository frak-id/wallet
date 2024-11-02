import { build } from "bun";

console.log("Building...");
console.time("build-time");
const result = await build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    minify: true,
    target: "bun",
    // Directly replace some known env during build time
    define: {
        // todo: This is fucking up during docker build
        // // Replace public env variable with the current value
        // "process.env.STAGE": JSON.stringify(Config.STAGE),
        // "process.env.POSTGRES_DB": JSON.stringify(Config.POSTGRES_DB),
        // "process.env.POSTGRES_USER": JSON.stringify(Config.POSTGRES_USER),
        // "process.env.INDEXER_URL": JSON.stringify(Config.INDEXER_URL),
        // "process.env.MASTER_KEY_SECRET_ID": JSON.stringify(
        //     Config.MASTER_KEY_SECRET_ID
        // ),
    },
    // Drop any console or debugger related code
    drop: ["console", "debugger"],
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
