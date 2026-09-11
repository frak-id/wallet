import { t } from "@backend-utils";
import { Elysia } from "elysia";

/**
 * Minimum supported app version per platform, hard-blocking older clients.
 * Captured at module load, so bumping the env var needs a pod restart;
 * `0.0.0` means no hard update is enforced.
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
 * Public endpoint consumed by the wallet on app boot + on focus. The cache
 * headers keep a flaky backend from cascading into the version gate.
 */
export const versionRoutes = new Elysia({ name: "Routes.common.version" }).get(
    "/version",
    () => ({ minVersion: minVersions }),
    {
        response: { 200: versionResponseSchema },
        afterHandle: ({ set }) => {
            set.headers["cache-control"] =
                "public, max-age=60, s-maxage=60, stale-while-revalidate=300";
        },
    }
);
