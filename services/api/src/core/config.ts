export const config = {
    env: process.env.NODE_ENV ?? "development",
    stage: process.env.STAGE ?? "dev",

    postgres: {
        host: process.env.POSTGRES_HOST ?? "",
        port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
        database: process.env.POSTGRES_DB ?? "",
        user: process.env.POSTGRES_USER ?? "",
        password: process.env.POSTGRES_PASSWORD ?? "",
    },

    blockchain: {
        rpcUrl: process.env.RPC_URL ?? "",
        chainId: Number.parseInt(process.env.CHAIN_ID ?? "1", 10),
        vaultAddress: process.env.VAULT_ADDRESS ?? "",
    },

    openpanel: {
        clientId: process.env.OPENPANEL_CLIENT_ID ?? "",
        host: process.env.OPENPANEL_HOST ?? "",
    },
} as const;
