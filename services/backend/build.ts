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
        "process.env.NODE_ENV": JSON.stringify("production"),
        // Help tree-shake MongoDB debug/logging/optional features
        "process.env.MONGODB_CRYPT_DEBUG": "undefined",
        "process.env.MONGODB_LOG_ALL": "undefined",
        "process.env.MONGODB_LOG_COMMAND": "undefined",
        "process.env.MONGODB_LOG_TOPOLOGY": "undefined",
        "process.env.MONGODB_LOG_SERVER_SELECTION": "undefined",
        "process.env.MONGODB_LOG_CONNECTION": "undefined",
        "process.env.MONGODB_LOG_CLIENT": "undefined",
        "process.env.MONGODB_LOG_MAX_DOCUMENT_LENGTH": "undefined",
        "process.env.MONGODB_LOG_PATH": "undefined",
        // Unused MongoDB auth mechanisms
        "process.env.AWS_ACCESS_KEY_ID": "undefined",
        "process.env.AWS_SECRET_ACCESS_KEY": "undefined",
        "process.env.AWS_SESSION_TOKEN": "undefined",
        "process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI": "undefined",
        "process.env.OIDC_TOKEN_FILE": "undefined",
        // GCP metadata detection (not needed for MongoDB auth)
        "process.env.GCE_METADATA_IP": "undefined",
        "process.env.GCE_METADATA_HOST": "undefined",
        "process.env.DETECT_GCP_RETRIES": "undefined",
        "process.env.METADATA_SERVER_DETECTION": "undefined",
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
