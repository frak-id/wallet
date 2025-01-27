/**
 * Event related to the iframe lifecycle
 * @ignore
 */
export type ClientLifecycleEvent =
    | CustomCssEvent
    | RestoreBackupEvent
    | HearbeatEvent
    | HandshakeResponse;

type CustomCssEvent = {
    clientLifecycle: "modal-css";
    data: { cssLink: string };
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
    };
};
