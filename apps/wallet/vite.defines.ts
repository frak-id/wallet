import * as process from "node:process";
import { getSandboxEnv, getSstResource } from "../../packages/dev-tooling";
import walletPackage from "./package.json";

/**
 * Build-time `define` map, shared by the SPA build (`vite.config.ts`) and the
 * standalone `/sharing` + `/install` build (`vite.standalone.config.ts`).
 *
 * Extracted so the two builds cannot drift: both talk to the same backend,
 * report to the same analytics project and stamp the same app version. A
 * standalone page pointing at a different `BACKEND_URL` than the SPA would be
 * a silent, stage-shaped bug.
 */

const DEBUG = JSON.stringify(false);

export type PlatformFlags = {
    isTauri: boolean;
    isTauriIos: boolean;
    isTauriAndroid: boolean;
};

export async function getDefineProps({
    isTauri,
    isTauriIos,
    isTauriAndroid,
}: PlatformFlags) {
    const sandboxEnv = await getSandboxEnv();
    const backendUrl =
        sandboxEnv.backendUrl ??
        getSstResource("BACKEND_URL") ??
        "https://backend.gcp-dev.frak.id";

    // Fail loud instead of silently shipping the dev backend in a prod app.
    // `sst shell` serves `BACKEND_URL` from the last *deployed* stage state, not
    // from current code — so a stale/undeployed `prod` stage makes the resource
    // resolve to `undefined` here and fall back to the dev default. The mobile
    // release sets `FRAK_VARIANT=prod` directly (independent of SST), so use it
    // as the authoritative prod-build signal: if we're building the prod app but
    // the backend still points at a dev host, that's a broken release — abort.
    if (
        process.env.FRAK_VARIANT === "prod" &&
        (backendUrl.includes("gcp-dev") || backendUrl.includes("-dev."))
    ) {
        throw new Error(
            `[wallet build] FRAK_VARIANT=prod but BACKEND_URL resolved to "${backendUrl}". ` +
                `The prod stage's SST_RESOURCE_BACKEND_URL is missing — run \`sst deploy --stage prod\` ` +
                `to sync the BACKEND_URL linkable into the deployed state before building.`
        );
    }

    const appVersion = process.env.COMMIT_HASH ?? walletPackage.version;

    const stage = getSstResource("STAGE") ?? "dev";

    // OTA channel for this exact artifact. Deliberately built from
    // `walletPackage.version` rather than `appVersion`: the latter collapses to
    // `COMMIT_HASH` on web deploys, and a channel keyed by commit would never
    // match the installed binary. Platform is folded in because `__IS_IOS__` /
    // `__IS_ANDROID__` are baked in, stage because `BACKEND_URL` is, and version
    // because the JS↔Rust command surface is only valid for the binary it
    // shipped with. `null` on web and on any non-mobile build disables OTA.
    const otaPlatform = isTauriIos ? "ios" : isTauriAndroid ? "android" : null;
    const otaChannel = otaPlatform
        ? `${stage}-${otaPlatform}-${walletPackage.version}`
        : null;

    return {
        "process.env.STAGE": JSON.stringify(stage),
        "process.env.BACKEND_URL": JSON.stringify(backendUrl),
        "process.env.ERPC_URL": JSON.stringify(
            getSstResource("ERPC_URL") ??
                "https://erpc.gcp-dev.frak.id/nexus-rpc/evm/"
        ),
        "process.env.DRPC_API_KEY": JSON.stringify(
            getSstResource("DRPC_API_KEY")
        ),
        "process.env.PIMLICO_API_KEY": JSON.stringify(
            getSstResource("PIMLICO_API_KEY")
        ),
        "process.env.NEXUS_RPC_SECRET": JSON.stringify(
            getSstResource("NEXUS_RPC_SECRET")
        ),
        "process.env.VAPID_PUBLIC_KEY": JSON.stringify(
            getSstResource("VAPID_PUBLIC_KEY")
        ),
        "process.env.DEBUG": JSON.stringify(DEBUG),
        // Build-time platform constants consumed by
        // `packages/app-essentials/src/utils/platform.ts`. Substituted to literal
        // booleans so Rolldown's `inlineConst` propagates them to every call site
        // and dead-code-eliminates the unreachable branches (and their `@tauri-apps/*`
        // dynamic imports).
        __IS_TAURI__: JSON.stringify(isTauri),
        __IS_IOS__: JSON.stringify(isTauriIos),
        __IS_ANDROID__: JSON.stringify(isTauriAndroid),
        __OTA_CHANNEL__: JSON.stringify(otaChannel),
        "process.env.APP_VERSION": JSON.stringify(appVersion),
        "process.env.FRAK_WALLET_URL": JSON.stringify(
            sandboxEnv.walletUrl ??
                getSstResource("FRAK_WALLET_URL") ??
                "https://wallet-dev.frak.id"
        ),
        "process.env.OPEN_PANEL_API_URL": JSON.stringify(
            getSstResource("OPEN_PANEL_API_URL") ?? "https://op-api.gcp.frak.id"
        ),
        "process.env.OPEN_PANEL_WALLET_CLIENT_ID": JSON.stringify(
            getSstResource("OPEN_PANEL_WALLET_CLIENT_ID")
        ),
        "process.env.WEBAUTHN_RP_ID": JSON.stringify(
            process.env.WEBAUTHN_RP_ID
        ),
        "process.env.ANDROID_SHA256_FINGERPRINT": JSON.stringify(
            getSstResource("ANDROID_SHA256_FINGERPRINT")
        ),
        "process.env.MONERIUM_CLIENT_ID": JSON.stringify(
            getSstResource("MONERIUM_CLIENT_ID")
        ),
    };
}

export type WalletDefines = Awaited<ReturnType<typeof getDefineProps>>;

/**
 * Read a resolved value back out of the define map rather than resolving it a
 * second time, so a `<link rel=preconnect>` can never point somewhere the app
 * does not. `JSON.stringify` yields the value `undefined` for an unset
 * resource, not a JSON string, hence the type guard.
 */
export function readDefine(
    define: WalletDefines,
    key: keyof WalletDefines
): string | undefined {
    const raw = define[key];
    return typeof raw === "string" ? JSON.parse(raw) : undefined;
}
