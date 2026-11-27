// Serves the real apps/shopify route modules client-side, with every server module replaced by a stub.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";

const here = realpathSync(dirname(fileURLToPath(import.meta.url)));
const REPO = process.env.VERIFY_SHOPIFY_TREE;
if (!REPO)
    throw new Error(
        "started by verify-shopify.sh, which sets VERIFY_SHOPIFY_TREE"
    );
const SHOPIFY = join(REPO, "apps/shopify");

const SERVER_FILE =
    /(\.server(\.[jt]sx?)?$|\/services\.server\/|\/shopify\.server)/;
// Pure server modules the harness runs for real, so their output follows the tree under test.
const REAL_SERVER_FILE = /\/auth\.login\/error\.server\.tsx$/;

function exportNames(source) {
    const names = new Set();
    for (const m of source.matchAll(
        /export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g
    ))
        names.add(m[1]);
    for (const m of source.matchAll(/export\s*\{([^}]*)\}/g))
        for (const part of m[1].split(",")) {
            const p = part.trim();
            if (!p || p.startsWith("type ")) continue;
            names.add(
                p
                    .split(/\s+as\s+/)
                    .pop()
                    .trim()
            );
        }
    names.delete("default");
    return [...names];
}

const PROXY = `const __p = new Proxy(function () { return __p; }, { get: (_t, k) => k === Symbol.toPrimitive ? () => "" : k === "then" ? undefined : __p, apply: () => __p });`;

// Route modules touch server exports only inside loaders and actions, which the harness never calls.
function stubServerModules() {
    return {
        name: "stub-server-modules",
        enforce: "pre",
        resolveId(id) {
            if (id === "@shopify/shopify-app-react-router/server")
                return "\0stub-shopify-server";
            return null;
        },
        load(id) {
            if (id === "\0stub-shopify-server")
                return `${PROXY}\nexport const LoginErrorType = { MissingShop: "MISSING_SHOP", InvalidShop: "INVALID_SHOP" };\nexport const boundary = __p; export const authenticate = __p; export const login = __p; export default __p;`;
            const file = id.split("?")[0];
            if (
                !SERVER_FILE.test(file) ||
                REAL_SERVER_FILE.test(file) ||
                file.includes("node_modules") ||
                !existsSync(file)
            )
                return null;
            const names = exportNames(readFileSync(file, "utf8"));
            return `${PROXY}\n${names.map((n) => `export const ${n} = __p;`).join("\n")}\nexport default __p;`;
        },
    };
}

function mockMerchantBank() {
    return {
        name: "mock-merchant-bank",
        enforce: "pre",
        resolveId(id, importer) {
            if (!/hooks\/useMerchantBank$/.test(id)) return null;
            if (importer?.endsWith("useMerchantBank.mock.ts")) return null;
            return join(here, "useMerchantBank.mock.ts");
        },
    };
}

// Vanilla Extract needs the app's .css.ts files inside root, so root is apps/shopify and the page is served from here.
function harnessHtml() {
    return {
        name: "harness-html",
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (!(req.url === "/" || req.url.startsWith("/?")))
                    return next();
                const raw = readFileSync(
                    join(here, "index.html"),
                    "utf8"
                ).replace("/main.tsx", `/@fs${here}/main.tsx`);
                res.setHeader("content-type", "text/html");
                res.end(await server.transformIndexHtml(req.url, raw));
            });
        },
    };
}

export default {
    root: SHOPIFY,
    cacheDir: join(SHOPIFY, "node_modules/.vite-verify-shopify"),
    plugins: [
        harnessHtml(),
        stubServerModules(),
        mockMerchantBank(),
        vanillaExtractPlugin(),
    ],
    resolve: {
        tsconfigPaths: true,
        alias: [
            { find: /^app\//, replacement: `${SHOPIFY}/app/` },
            { find: /^db\//, replacement: `${SHOPIFY}/db/` },
            {
                find: "@backend-utils",
                replacement: join(REPO, "services/backend/src/utils/index.ts"),
            },
            {
                find: /^@backend-domain\//,
                replacement: `${join(REPO, "services/backend/src/domain")}/`,
            },
        ],
    },
    define: {
        "process.env.STAGE": JSON.stringify("prod"),
        "process.env.FRAK_WALLET_URL": JSON.stringify("https://wallet.frak.id"),
        "process.env.FRAK_COMPONENTS_URL": JSON.stringify(
            "https://sdk.frak.id/components.js"
        ),
        "process.env.BUSINESS_URL": JSON.stringify("https://business.frak.id"),
        "process.env.BACKEND_URL": JSON.stringify("https://backend.frak.id"),
        "process.env.NODE_ENV": JSON.stringify("development"),
    },
    oxc: { jsx: { runtime: "automatic" } },
    server: { fs: { allow: [REPO, here] } },
    clearScreen: false,
};
