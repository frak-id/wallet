/**
 * Event related to the iframe lifecycle
 * @ignore
 */
export type IFrameLifecycleEvent =
    | {
          iframeLifecycle: "connected" | "show" | "hide" | "remove-backup";
          data?: never;
      }
    | DoBackupEvent
    | HandshakeRequestEvent
    | RedirectRequestEvent;

type DoBackupEvent = {
    iframeLifecycle: "do-backup";
    data: { backup?: string };
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
         * The base url to redirect to
         *  If it contain a query param `u`, the client need will suffix the current url to the base url
         */
        baseRedirectUrl: string;
    };
};
