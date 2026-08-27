import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Rebuild `/sharing` and `/install` before the specs run.
 *
 * Kept out of `webServer.command` because `reuseExistingServer` skips that
 * command entirely once something is listening, which silently serves a bundle
 * older than the source under test.
 */
export default function buildStandalone() {
    const cwd = dirname(dirname(fileURLToPath(import.meta.url)));
    const { status } = spawnSync("bun", ["run", "build:standalone"], {
        cwd,
        stdio: "inherit",
    });
    if (status !== 0) throw new Error("build:standalone failed");
}
