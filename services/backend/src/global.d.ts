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
        }
    }
}

export type {};
