import { defineConfig } from "vitest/config";
import { maxWorkers } from "../packages/test-foundation/src/vitest.workers";

// Standalone rather than extending the shared config: `scripts/` is not a
// workspace, so it cannot resolve `@frak-labs/test-foundation`. These are
// plain node tests that need none of what the shared setup provides.
export default defineConfig({
    test: {
        name: "scripts-unit",
        include: ["*.{test,spec}.ts"],
        environment: "node",
        maxWorkers,
    },
});
