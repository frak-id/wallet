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
    | HandshakeRequestEvent
    | RedirectRequestEvent;

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

type RedirectRequestEvent = {
    iframeLifecycle: "redirect";
    data: {
        /**
         * The base url to redirect to (contain a query param `u`, the client need to suffix the current url to the base url)
         */
        baseRedirectUrl: string;
    };
};
