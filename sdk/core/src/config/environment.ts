/**
 * Environment resolution — the single source of truth for the wallet and
 * backend origins the SDK talks to.
 *
 * Set once, at client setup, from {@link FrakWalletSdkConfig.env}; every
 * consumer reads it back with {@link getWalletUrl} / {@link getBackendUrl}
 * rather than receiving an origin through its own signature, since these are
 * process-wide facts, not per-call arguments.
 *
 * State lives on `window.__frakEnv` (mirroring `sdkConfigStore`'s
 * `window.__frakSdkConfig`) because a page can load two module instances —
 * the CDN components bundle and the npm core bundle — that must agree on the
 * stage. The module-level copy is the non-browser (SSR) fallback; it's a
 * plain global, so it's per-process and assumes one stage per deployment.
 */

import type { FrakEnvironment } from "../types/config";

const GLOBAL_KEY = "__frakEnv";

/**
 * A fully resolved environment: both origins known, no derivation left.
 * @category Config
 */
export type ResolvedEnvironment = {
    /** Wallet origin — hosts the listener iframe, SSO and sharing pages. */
    wallet: string;
    /** Backend origin — hosts the REST API. */
    backend: string;
};

/**
 * The named stages. Anything else is expressed as an explicit
 * `{ wallet, backend }` pair, including local development.
 */
const PRESETS = {
    prod: {
        wallet: "https://wallet.frak.id",
        backend: "https://backend.frak.id",
    },
    dev: {
        wallet: "https://wallet-dev.frak.id",
        backend: "https://backend.gcp-dev.frak.id",
    },
} as const satisfies Record<string, ResolvedEnvironment>;

// Checked per call rather than captured at import: SSR bundles see `window`
// appear only later, and a snapshot const would make the non-browser path untestable.
function isBrowser(): boolean {
    return typeof window !== "undefined";
}

declare global {
    interface Window {
        [GLOBAL_KEY]?: ResolvedEnvironment;
    }
}

let memoryEnv: ResolvedEnvironment = PRESETS.prod;

/**
 * Origins are concatenated with paths verbatim, so a pasted `https://host/`
 * would produce `https://host//user/…`.
 */
function withoutTrailingSlash(origin: string): string {
    return origin.replace(/\/+$/, "");
}

/**
 * Resolve a config-level `env` into concrete origins.
 *
 * Ingestion paths are untyped (Liquid templates, merchant-pasted `<script>`,
 * `window.FrakSetup.config`), so bad input is logged loudly but still falls
 * back to production rather than throwing — a typo in a merchant's snippet
 * must not take their page down.
 */
function resolveEnvironment(env: FrakEnvironment): ResolvedEnvironment {
    if (typeof env === "string") {
        // `Object.hasOwn`, not a truthiness probe: a bare index would resolve
        // inherited keys ("constructor", "toString") to a non-environment.
        if (Object.hasOwn(PRESETS, env)) {
            return PRESETS[env as keyof typeof PRESETS];
        }
        console.error(
            `[Frak SDK] Unknown env "${env}", falling back to production. Expected "prod", "dev", or { wallet, backend }.`
        );
        return PRESETS.prod;
    }

    // A half-filled object would serialise into `fetch("undefined/user/…")`
    // at request time, far from the cause.
    if (!env?.wallet || !env?.backend) {
        console.error(
            "[Frak SDK] env must state both `wallet` and `backend` origins, falling back to production. Received:",
            env
        );
        return PRESETS.prod;
    }

    return {
        wallet: withoutTrailingSlash(env.wallet),
        backend: withoutTrailingSlash(env.backend),
    };
}

/**
 * Publish the environment for every later reader. Called by the client
 * entrypoints (`createIframe` / `createIFrameFrakClient` / the React
 * provider), so it runs more than once per page in normal use.
 *
 * An omitted `env` is a no-op rather than "reset to production": a second
 * client built from a bare config would otherwise silently repoint the
 * first one's in-flight calls. The production default lives in
 * {@link getEnvironment} instead.
 */
export function setEnvironment(env?: FrakEnvironment): ResolvedEnvironment {
    if (!env) return getEnvironment();

    const resolved = resolveEnvironment(env);

    // Two integrations disagreeing on the stage otherwise only shows up as
    // traffic on the wrong backend, with nothing to explain it.
    const previous = isBrowser() ? window[GLOBAL_KEY] : undefined;
    if (
        previous &&
        (previous.wallet !== resolved.wallet ||
            previous.backend !== resolved.backend)
    ) {
        console.warn(
            "[Frak SDK] env changed after being published; the last value wins for every SDK call on this page.",
            { previous, next: resolved }
        );
    }

    memoryEnv = resolved;
    if (isBrowser()) window[GLOBAL_KEY] = resolved;
    return resolved;
}

/**
 * The active environment. Defaults to production when nothing was set, so
 * standalone actions (`trackPurchaseStatus`, an early `ensureIdentity`) work
 * without a client.
 */
export function getEnvironment(): ResolvedEnvironment {
    if (isBrowser()) return window[GLOBAL_KEY] ?? memoryEnv;
    return memoryEnv;
}

/**
 * The wallet origin for the active environment.
 */
export function getWalletUrl(): string {
    return getEnvironment().wallet;
}

/**
 * The backend origin for the active environment.
 */
export function getBackendUrl(): string {
    return getEnvironment().backend;
}
