import type { I18nConfig } from "../config";

/**
 * Event related to the iframe lifecycle
 * @ignore
 */
export type ClientLifecycleEvent =
    | CustomCssEvent
    | CustomI18nEvent
    | RestoreBackupEvent
    | HearbeatEvent
    | HandshakeResponse
    | SsoRedirectCompleteEvent
    | DeepLinkFailedEvent;

type CustomCssEvent = {
    clientLifecycle: "modal-css";
    data: { cssLink: string };
};

type CustomI18nEvent = {
    clientLifecycle: "modal-i18n";
    data: { i18n: I18nConfig };
};

type RestoreBackupEvent = {
    clientLifecycle: "restore-backup";
    data: { backup: string };
};

type HearbeatEvent = {
    clientLifecycle: "heartbeat";
    data?: never;
};

type HandshakeResponse = {
    clientLifecycle: "handshake-response";
    data: {
        token: string;
        currentUrl: string;
        /**
         * Pending merge token extracted from URL (?fmt= parameter)
         * When present, listener should execute identity merge in background
         * URL is cleaned after handshake response is sent
         */
        pendingMergeToken?: string;
        /**
         * Client ID for identity tracking (belt & suspenders fallback)
         * Primary delivery is via iframe URL query param; handshake is backup for SSR
         */
        clientId?: string;
        /**
         * Explicit domain from SDK config (FrakWalletSdkConfig.domain)
         * When present, listener should prefer this over URL-derived domain
         * for merchant resolution (handles proxied/tunneled environments)
         */
        configDomain?: string;
    };
};

type SsoRedirectCompleteEvent = {
    clientLifecycle: "sso-redirect-complete";
    data: { compressed: string };
};

type DeepLinkFailedEvent = {
    clientLifecycle: "deep-link-failed";
    data: { originalUrl: string };
};
