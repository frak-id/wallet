/** Serves the built standalone `/sharing` and `/install` pages for the light specs. */
const DIST = new URL("../dist/", import.meta.url);
const PORT = Number(process.env.STANDALONE_PORT ?? 3100);

// The only nginx behaviour worth reproducing: these two paths are their own
// documents, not SPA routes.
const ENTRYPOINTS: Record<string, string> = {
    "/sharing": "sharing.html",
    "/install": "install.html",
};

function assetUrl(pathname: string): URL | null {
    try {
        return new URL(`.${pathname}`, DIST);
    } catch {
        // An encoded slash makes this unrepresentable as a file path.
        return null;
    }
}

Bun.serve({
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

console.log(`standalone ready on http://localhost:${PORT}`);
