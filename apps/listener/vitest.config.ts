import * as path from "node:path";
import { fileURLToPath } from "node:url";
import sharedConfig from "@frak-labs/test-foundation/vitest.shared";
import preact from "@preact/preset-vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig, mergeConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const preactRoot = path.resolve(__dirname, "node_modules/preact");
const preactCompat = path.resolve(preactRoot, "compat");
const preactCompatClient = path.resolve(preactRoot, "compat/client");
const preactJsxRuntime = path.resolve(preactRoot, "jsx-runtime");
const preactHooks = path.resolve(preactRoot, "hooks");
const preactTestingLibrary = path.resolve(
    __dirname,
    "node_modules/@testing-library/preact"
);

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins: [
            preact({ reactAliasesEnabled: false }),
            vanillaExtractPlugin(),
        ],
        test: {
            name: "listener-unit",
            alias: {
                "@testing-library/react": preactTestingLibrary,
                "react-dom/test-utils": preactCompat,
                "react-dom/client": preactCompatClient,
                "react-dom": preactCompat,
                "react/jsx-dev-runtime": preactJsxRuntime,
                "react/jsx-runtime": preactJsxRuntime,
                react: preactCompat,
                "preact/jsx-dev-runtime": preactJsxRuntime,
                "preact/jsx-runtime": preactJsxRuntime,
                "preact/compat/client": preactCompatClient,
                "preact/compat": preactCompat,
                "preact/hooks": preactHooks,
                preact: preactRoot,
            },
            setupFiles: [
                "./tests/vitest-setup.ts",
                "@frak-labs/test-foundation/shared-setup",
                "@frak-labs/test-foundation/apps-setup",
            ],
            include: ["app/**/*.{test,spec}.{ts,tsx}"],
            server: {
                deps: {
                    inline: true,
                },
            },
            coverage: {
                include: ["app/**/*.{ts,tsx}"],
                exclude: [
                    "app/main.tsx",
                    "app/App.tsx",
                    "**/component/**/*.tsx",
                    "**/components/**/*.tsx",
                ],
            },
        },
    })
);
