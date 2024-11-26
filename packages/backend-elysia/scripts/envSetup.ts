import * as process from "node:process";
import { Resource } from "sst";

// Get all the SST resources, and build a key value mapping
const secrets = Object.entries(Resource).map(([key, obj]) => [
    key,
    "value" in obj ? obj.value : null,
]);

// Write a .env file with all the secrets
console.log("Writing .env file with secrets");
await Bun.write(
    ".env",
    secrets.map(([key, value]) => (value ? `${key}=${value}` : "")).join("\n")
);
process.exit(0);
