/**
 * Custom production server for the Shopify embedded app.
 *
 * A faithful, minimal reimplementation of `@react-router/serve`'s CLI
 * (node_modules/@react-router/serve/dist/cli.js) with ONE behavioural change:
 * the access logger skips the `/health` probe path.
 *
 * Why: `react-router-serve` hardcodes `morgan("tiny")`, which logs every
 * request. The Kubernetes liveness/readiness probes hit `/health` on a short
 * period (see infra/gcp/shopify.ts), producing ~17k signal-free access-log
 * lines per pod per day — mixed 1:1 with real traffic, inflating ingestion
 * cost and burying real errors. Skipping `/health` here removes that noise
 * while keeping honest access logs for real traffic.
 *
 * The per-request logging correlation context (reqId/route/shop/merchantId)
 * is NOT set here: it lives inside the app bundle (see app/root.tsx
 * `middleware` + app/services.server/logger.ts) so it shares the same
 * AsyncLocalStorage instance as every `log.*` call.
 *
 * Runs under Bun (PID 1) in the runtime image, exactly like `react-router-serve`.
 */
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const buildPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "build/server/index.js"
);
const build = await import(pathToFileURL(buildPath).href);

const assetsBuildDirectory = path.resolve(
    path.dirname(buildPath),
    "..",
    "client"
);

const app = express();
app.disable("x-powered-by");

app.use(compression());

// Immutable, content-hashed client assets — long cache.
app.use(
    "/assets",
    express.static(path.join(assetsBuildDirectory, "assets"), {
        immutable: true,
        maxAge: "1y",
    })
);
// Remaining build output (non-hashed) + the public/ dir.
app.use(express.static(assetsBuildDirectory));
app.use(express.static("public", { maxAge: "1h" }));

// Access log — same "tiny" format as react-router-serve, but skip the
// health-probe path so it never floods the logs.
app.use(
    morgan("tiny", {
        skip: (req) => req.url.split("?")[0] === "/health",
    })
);

app.all(
    "*",
    createRequestHandler({
        build,
        mode: process.env.NODE_ENV,
    })
);

const server = app.listen(port, () => {
    console.log(`[shopify-server] listening on http://localhost:${port}`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => server?.close(console.error));
}
