declare global {
    namespace NodeJS {
        interface ProcessEnv {
            JWT_SECRET: string;
            JWT_SDK_SECRET: string;
            JWT_BUSINESS_SECRET: string;
            SESSION_ENCRYPTION_KEY: string;
            PRODUCT_SETUP_CODE_SALT: string;
            // Mongo URL
            MONGODB_EXAMPLE_URI: string;
            MONGODB_NEXUS_URI: string;
            // Notification stuff
            VAPID_PUBLIC_KEY: string;
            VAPID_PRIVATE_KEY: string;
            // Other services
            WORLD_NEWS_API_KEY: string;
        }
    }
}

export type {};
