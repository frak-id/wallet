import type { FrakEnvironment } from "@frak-labs/core-sdk";

/** The Frak stage this deployment talks to, in the shape the SDK's `config.env` expects; an explicit origin pair since this app also deploys against sandboxes no preset knows. */
export function frakEnv(): FrakEnvironment {
    return {
        wallet: process.env.FRAK_WALLET_URL || "https://wallet.frak.id",
        backend:
            process.env.PUBLIC_BACKEND_URL ||
            process.env.BACKEND_URL ||
            "https://backend.frak.id",
    };
}
