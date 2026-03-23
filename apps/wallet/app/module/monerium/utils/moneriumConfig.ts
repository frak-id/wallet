import { isRunningInProd } from "@frak-labs/app-essentials/utils/env";

export const moneriumConfig = {
    environment: isRunningInProd ? "production" : "sandbox",
    clientId: process.env.MONERIUM_CLIENT_ID ?? "",
    redirectUri: `${process.env.FRAK_WALLET_URL ?? "https://wallet-dev.frak.id"}/monerium/callback`,
    chain: isRunningInProd ? "arbitrum" : "arbitrumsepolia",
} as const;

export const MONERIUM_AUTH_BASE_URL = {
    production: "https://api.monerium.app/auth",
    sandbox: "https://api.monerium.dev/auth",
} as const;

export const ADDRESS_LINKING_MESSAGE =
    "I hereby declare that I am the address owner.";
