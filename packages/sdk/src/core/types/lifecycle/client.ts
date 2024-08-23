/**
 * Event related to the iframe lifecycle
 */
export type ClientLifecycleEvent = CustomCssEvent | RestoreBackupEvent;

type CustomCssEvent = {
    clientLifecycle: "modal-css";
    data: { rawCss: string };
};

type RestoreBackupEvent = {
    clientLifecycle: "restore-backup";
    data: { backup: string };
};
