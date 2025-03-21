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
    | HandshakeResponse;

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
};

type HandshakeResponse = {
    clientLifecycle: "handshake-response";
    data: {
        token: string;
        currentUrl: string;
    };
};
