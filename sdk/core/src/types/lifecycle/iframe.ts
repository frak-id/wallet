/**
 * Event related to the iframe lifecycle
 * @ignore
 */
export type IFrameLifecycleEvent =
    | {
          iframeLifecycle: "connected" | "show" | "hide";
          data?: never;
      }
    | DoBackupEvent
    | RemoveBackupEvent
    | HandshakeRequestEvent;

type DoBackupEvent = {
    iframeLifecycle: "do-backup";
    data: { backup?: string };
};

type RemoveBackupEvent = {
    iframeLifecycle: "remove-backup";
};

type HandshakeRequestEvent = {
    iframeLifecycle: "handshake";
    data: {
        token: string;
    };
};
