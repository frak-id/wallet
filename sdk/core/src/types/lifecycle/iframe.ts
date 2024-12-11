/**
 * Event related to the iframe lifecycle
 */
export type IFrameLifecycleEvent =
    | {
          iframeLifecycle: "connected" | "show" | "hide";
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
