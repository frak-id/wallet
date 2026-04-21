import type { I18nConfig } from "../config";
import type { ResolvedSdkConfig } from "../resolvedConfig";

/**
 * Event related to the iframe lifecycle
 * @ignore
 */
export type ClientLifecycleEvent =
    | CustomCssEvent
    | CustomI18nEvent
    | RestoreBackupEvent
    | HearbeatEvent
    | SsoRedirectCompleteEvent
    | DeepLinkFailedEvent
    | ResolvedConfigEvent;

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

type SsoRedirectCompleteEvent = {
    clientLifecycle: "sso-redirect-complete";
    data: { compressed: string };
};

type DeepLinkFailedEvent = {
    clientLifecycle: "deep-link-failed";
    data: { originalUrl: string };
};

type ResolvedConfigEvent = {
    clientLifecycle: "resolved-config";
    data: {
        merchantId: string;
        /** The domain the backend resolved this config for */
        domain: string;
        /** All domains registered for this merchant (for domain proof) */
        allowedDomains: string[];
        /** Full URL of the parent page (for interaction tracking) */
        sourceUrl: string;
        /**
         * Pending merge token extracted from URL (?fmt= parameter).
         * When present, listener should execute identity merge in background.
         */
        pendingMergeToken?: string;
        /**
         * Persistent per-origin anonymous id generated on the partner site
         * (SDK-side localStorage). Propagated here so the listener can
         * set it as an OpenPanel global property and stitch SDK events
         * with listener events in the same funnel.
         */
        sdkAnonymousId?: string;
        sdkConfig?: ResolvedSdkConfig;
    };
};
