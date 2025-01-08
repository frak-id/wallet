/**
 * Event related to the iframe lifecycle
 * @ignore
 */
export type IFrameLifecycleEvent =
    | {
          iframeLifecycle: "connected" | "heartbeat" | "show" | "hide";
          data?: never;
      }
    | DoBackupEvent
    | RemoveBackupEvent
    | SetupPrivyEvent
    | PrivyRequestEvent;

type DoBackupEvent = {
    iframeLifecycle: "do-backup";
    data: { backup?: string };
};

type RemoveBackupEvent = {
    iframeLifecycle: "remove-backup";
};

type SetupPrivyEvent = {
    iframeLifecycle: "setup-privy";
    data: {
        embeddedWalletUrl: string;
    };
};

type PrivyRequestEvent = {
    iframeLifecycle: "privy-request";
    targetOrigin: string;
    data: unknown;
};
