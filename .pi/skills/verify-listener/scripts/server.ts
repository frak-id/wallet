// Two origins on one port so SDK→listener postMessage crosses origins: merchant
// `127.0.0.1` (host page, `/sdk/**`), wallet `localhost` (`/listener/**`, stubs).
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

export type LoggedRequest = {
    origin: "merchant" | "wallet";
    /** Off-origin call the browser made, replayed here by drive.ts. */
    forwardedFrom?: string;
    method: string;
    path: string;
    status: number;
    kind: "host" | "sdk" | "listener" | "stub" | "notfound";
    rawBytes: number;
    gzBytes: number;
};

const MIME: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".webp": "image/webp",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
};

export const STUB_WALLET = "0x1111111111111111111111111111111111111111";

const STUB_SESSION = {
    type: "webauthn",
    address: STUB_WALLET,
    publicKey: { x: `0x${"11".repeat(32)}`, y: `0x${"22".repeat(32)}` },
    authenticatorId: "verify-listener-authenticator",
    transports: ["internal"],
    token: "verify-listener-token",
    sdkJwt: "verify-listener-sdk-jwt",
};

function hostPage(walletUrl: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>verify-listener merchant</title>
    <script>
        window.FrakSetup = {
            config: {
                env: { wallet: ${JSON.stringify(walletUrl)}, backend: ${JSON.stringify(walletUrl)} },
                metadata: { name: "Verify Listener", lang: "en", currency: "eur" },
            },
        };
    </script>
    <script type="module" src="/sdk/loader.js"></script>
</head>
<body><h1>verify-listener merchant page</h1></body>
</html>`;
}

function fileUnder(base: string, sub: string): string | null {
    const target = resolve(join(base, sub));
    return target.startsWith(`${resolve(base)}/`) ? target : null;
}

export type ServerHandle = {
    merchantUrl: string;
    walletUrl: string;
    log: LoggedRequest[];
    stop: () => Promise<void>;
};

type Respond = (
    status: number,
    kind: LoggedRequest["kind"],
    contentType: string,
    body: Uint8Array | string | null,
    extra?: Record<string, string>
) => Response;

function makeRespond(
    log: LoggedRequest[],
    req: Request,
    origin: LoggedRequest["origin"]
): Respond {
    return (status, kind, contentType, body, extra = {}) => {
        const raw =
            typeof body === "string" ? new TextEncoder().encode(body) : body;
        const gz = raw ? gzipSync(raw) : null;
        log.push({
            origin,
            forwardedFrom:
                req.headers.get("x-verify-original-origin") ?? undefined,
            method: req.method,
            path: new URL(req.url).pathname,
            status,
            kind,
            rawBytes: raw?.length ?? 0,
            gzBytes: gz?.length ?? 0,
        });
        const headers: Record<string, string> = {
            "cache-control": "no-store",
            "content-type": contentType,
            ...extra,
        };
        if (gz) headers["content-encoding"] = "gzip";
        return new Response(gz, { status, headers });
    };
}

async function serveFile(
    respond: Respond,
    base: string,
    sub: string,
    kind: "sdk" | "listener"
) {
    const file = fileUnder(base, sub);
    const handle = file ? Bun.file(file) : null;
    if (!handle || !(await handle.exists())) {
        return respond(404, "notfound", "text/plain", `${kind}: not found`);
    }
    const type =
        MIME[sub.slice(sub.lastIndexOf("."))] ?? "application/octet-stream";
    return respond(200, kind, type, new Uint8Array(await handle.arrayBuffer()));
}

const STUBS: Record<string, (merchantHost: string) => string> = {
    "/user/merchant/resolve": (merchantHost) =>
        JSON.stringify({
            merchantId: "11111111-1111-1111-1111-111111111111",
            name: "Verify Listener",
            domain: "127.0.0.1",
            // The listener compares host:port; this is what makes trust "verified".
            allowedDomains: ["127.0.0.1", merchantHost],
        }),
    "/user/wallet/auth/login": () => JSON.stringify(STUB_SESSION),
    // Not a reward summary, so the SDK shows no reminder.
    "/user/merchant/rewards-summary": () => "{}",
};

function serveMerchant(respond: Respond, url: URL, sdkDir: string) {
    if (url.pathname === "/") {
        return respond(
            200,
            "host",
            MIME[".html"],
            hostPage(`http://localhost:${url.port}`)
        );
    }
    if (url.pathname.startsWith("/sdk/")) {
        return serveFile(
            respond,
            sdkDir,
            url.pathname.slice("/sdk/".length),
            "sdk"
        );
    }
    return respond(404, "notfound", "text/plain", "merchant: not found");
}

export function startServer(opts: {
    dist: string;
    sdkDir: string;
}): ServerHandle {
    const log: LoggedRequest[] = [];

    const server = Bun.serve({
        port: 0,
        async fetch(req) {
            const url = new URL(req.url);
            const path = url.pathname;
            const origin = url.hostname === "127.0.0.1" ? "merchant" : "wallet";
            const respond = makeRespond(log, req, origin);
            const cors = {
                "access-control-allow-origin": req.headers.get("origin") ?? "*",
                "access-control-allow-credentials": "true",
                "access-control-allow-methods": "GET, POST, OPTIONS",
                "access-control-allow-headers":
                    req.headers.get("access-control-request-headers") ?? "*",
            };

            if (origin === "merchant") {
                return serveMerchant(respond, url, opts.sdkDir);
            }

            if (path === "/listener" || path.startsWith("/listener/")) {
                const sub = path.slice("/listener/".length) || "index.html";
                return serveFile(respond, opts.dist, sub, "listener");
            }

            if (req.method === "OPTIONS") {
                return respond(204, "stub", "text/plain", null, cors);
            }
            const stub = STUBS[path];
            if (stub) {
                return respond(
                    200,
                    "stub",
                    MIME[".json"],
                    stub(`127.0.0.1:${url.port}`),
                    cors
                );
            }
            return respond(
                404,
                "notfound",
                MIME[".json"],
                JSON.stringify({
                    error: `verify-listener: no stub for ${path}`,
                }),
                cors
            );
        },
    });

    return {
        merchantUrl: `http://127.0.0.1:${server.port}`,
        walletUrl: `http://localhost:${server.port}`,
        log,
        stop: () => server.stop(true),
    };
}
