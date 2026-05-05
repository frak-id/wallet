import { t } from "@backend-utils";
import { Elysia } from "elysia";

/**
 * Minimum supported app version per platform — surfaced to the wallet so it
 * can hard-block clients running below this floor and redirect them to the
 * store.
 *
 * Source: `MIN_VERSION_IOS` / `MIN_VERSION_ANDROID` env vars (set by SST and
 * piped through `infra/gcp/secrets.ts`). When unset we fall back to `0.0.0`,
 * which means "no hard-update enforced" — the wallet will skip the gate.
 *
 * Soft updates are NOT served from here on purpose: the wallet checks the
 * App Store / Play Store directly via the `frak-updater` Tauri plugin so
 * staged store rollouts never get out of sync with a backend value.
 */
const minVersions = {
    ios: process.env.MIN_VERSION_IOS ?? "0.0.0",
    android: process.env.MIN_VERSION_ANDROID ?? "0.0.0",
} as const;

const versionResponseSchema = t.Object({
    minVersion: t.Object({
        ios: t.String(),
        android: t.String(),
    }),
});

/**
 * Public endpoint consumed by the wallet on app boot + on focus.
 *
 * Cache headers are deliberately short: the wallet keeps its own client-side
 * cache (TanStack Query) and we want infra-level updates of the env var to
 * propagate within minutes.
 */
export const versionRoutes = new Elysia({ name: "Routes.common.version" }).get(
    "/version",
    () => ({ minVersion: minVersions }),
    {
        response: { 200: versionResponseSchema },
        // 60s edge cache is enough — the wallet polls again on focus.
        afterHandle: ({ set }) => {
            set.headers["cache-control"] = "public, max-age=60";
        },
    }
);
