import type { FrakEnvironment } from "@frak-labs/core-sdk";

/** The Frak stage this deployment talks to, in the shape the SDK's `config.env` expects; an explicit origin pair since this app also deploys against sandboxes no preset knows. */
export function frakEnv(): FrakEnvironment {
    const { wallet, backend } = configuredOrigins();
    return {
        wallet: wallet ?? "https://wallet.frak.id",
        backend: backend ?? "https://backend.frak.id",
    };
}

/** Configured origins with no default applied. Use this over {@link frakEnv} when an unconfigured deployment must not fall back to production. */
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
