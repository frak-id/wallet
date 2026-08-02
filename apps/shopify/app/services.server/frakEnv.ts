import type { FrakEnvironment } from "@frak-labs/core-sdk";

/**
 * The Frak stage this deployment of the app talks to, in the shape the SDK's
 * `config.env` expects.
 *
 * Always an explicit origin pair rather than a named preset: the app is also
 * deployed against sandboxes whose hosts no preset knows. The backend origin
 * is the publicly reachable one — the config it feeds is consumed by the
 * merchant's browser, not by this server.
 */
export function frakEnv(): FrakEnvironment {
    const { wallet, backend } = configuredOrigins();
    return {
        wallet: wallet ?? "https://wallet.frak.id",
        backend: backend ?? "https://backend.frak.id",
    };
}

/**
 * The origins this deployment was actually given, before any default is
 * applied. Callers that must not invent a stage — the shop metafield sync,
 * which would otherwise stamp production onto every shop of an unconfigured
 * deployment — use this instead of {@link frakEnv}.
 *
 * `PUBLIC_BACKEND_URL` wins because the value is consumed by a browser: it is
 * the same precedence the web pixel and the webhook registration use.
 */
export function configuredOrigins(): {
    wallet?: string;
    backend?: string;
} {
    return {
        wallet: process.env.FRAK_WALLET_URL || undefined,
        backend:
            process.env.PUBLIC_BACKEND_URL ||
            process.env.BACKEND_URL ||
            undefined,
    };
}
