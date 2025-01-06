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
    | RemoveBackupEvent;

type DoBackupEvent = {
    iframeLifecycle: "do-backup";
    data: { backup?: string };
};

type RemoveBackupEvent = {
    iframeLifecycle: "remove-backup";
};
