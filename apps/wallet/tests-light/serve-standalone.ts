import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Serves the built standalone `/sharing` and `/install` pages for the light specs. */
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = new URL("../dist/", import.meta.url);
const PORT = Number(process.env.STANDALONE_PORT ?? 3100);

// Loopback by default: `dist/` carries sourcemaps and build-time inlined
// config, so a wildcard bind would offer them to the whole network. CI runs in
// a disposable container and sets `STANDALONE_HOST`.
const HOST = process.env.STANDALONE_HOST ?? "127.0.0.1";

// The only nginx behaviour worth reproducing: these two paths are their own
// documents, not SPA routes.
const ENTRYPOINTS: Record<string, string> = {
    "/sharing": "sharing.html",
    "/install": "install.html",
};

// Built here rather than in `globalSetup`, which Playwright runs *after* the
// web server: a fresh checkout has no `dist/`, so every route would 404 and the
// readiness poll would wait out its whole timeout. Building before `listen`
// also means `reuseExistingServer` cannot skip it — nothing is listening yet.
const build = spawnSync("bun", ["run", "build:standalone"], {
    cwd: ROOT,
    stdio: "inherit",
});
if (build.status !== 0) throw new Error("build:standalone failed");

// `new URL` normalises rather than throwing, so `%2e%2e` resolves outside
// `dist/`. Browsers collapse that before it is sent, but this is the only
// thing standing between a raw client and the repo.
function assetUrl(pathname: string): URL | null {
    const url = new URL(`.${pathname}`, DIST);
    return url.href.startsWith(DIST.href) ? url : null;
}

Bun.serve({
    hostname: HOST,
    port: PORT,
    async fetch(request) {
        const { pathname } = new URL(request.url);
        const entry = ENTRYPOINTS[pathname.replace(/\/$/, "")];
        const url = entry ? new URL(entry, DIST) : assetUrl(pathname);
        if (!url) return new Response("not found", { status: 404 });

        const file = Bun.file(url);
        if (await file.exists()) return new Response(file);
        return new Response("not found", { status: 404 });
    },
});

console.log(`standalone ready on http://${HOST}:${PORT}`);
