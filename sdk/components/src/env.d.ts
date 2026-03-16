declare namespace NodeJS {
    interface ProcessEnv {
        CDN_TAG: string;
        BUILD_TIMESTAMP: string;
        SDK_VERSION: string;
        OPEN_PANEL_API_URL: string;
    }
}

declare const process: { env: NodeJS.ProcessEnv };
