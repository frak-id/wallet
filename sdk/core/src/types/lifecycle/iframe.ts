/**
 * Event related to the iframe lifecycle
 * @ignore
 */
export type IFrameLifecycleEvent =
    | {
          iframeLifecycle: "connected" | "heartbeat" | "hide";
          data?: never;
      }
    | IFrameLifecycleShow
    | DoBackupEvent
    | RemoveBackupEvent;

export type IFramePositions = {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
    width?: string;
    height?: string;
};

type IFrameLifecycleShow = {
    iframeLifecycle: "show";
    data?: IFramePositions;
};

type DoBackupEvent = {
    iframeLifecycle: "do-backup";
    data: { backup?: string };
};

type RemoveBackupEvent = {
    iframeLifecycle: "remove-backup";
};
