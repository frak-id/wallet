declare global {
    namespace NodeJS {
        interface ProcessEnv {
            JWT_SECRET: string;
            JWT_SDK_SECRET: string;
            JWT_BUSINESS_SECRET: string;
            PRODUCT_SETUP_CODE_SALT: string;
            // LibSQL (sqld) URL
            LIBSQL_URL: string;
            // Notification stuff
            VAPID_PUBLIC_KEY: string;
            VAPID_PRIVATE_KEY: string;
            // Other services
            WORLD_NEWS_API_KEY: string;
            // Shopify
            SHOPIFY_API_SECRET: string;
            SHOPIFY_CLIENT_ID: string;
            // Business dashboard origin — Shopify SSO callback redirect
            // target (§4.7). NOTE: not yet wired into infra/gcp/secrets.ts
            // elysiaEnv (out of scope for this backend-only change — infra's
            // `businessUrl` from infra/config.ts is the value to plumb in).
            BUSINESS_URL: string;
            // RustFS (object storage)
            RUSTFS_ENDPOINT: string;
            RUSTFS_ACCESS_KEY: string;
            RUSTFS_SECRET_KEY: string;
            RUSTFS_CDN_BASE_URL: string;
        }
    }
}

export type {};
