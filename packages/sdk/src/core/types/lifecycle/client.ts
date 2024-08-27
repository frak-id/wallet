/**
 * Event related to the iframe lifecycle
 */
export type ClientLifecycleEvent = CustomCssEvent | RestoreBackupEvent;

type CustomCssEvent = {
    clientLifecycle: "modal-css";
    data: { cssLink: string };
};

type RestoreBackupEvent = {
    clientLifecycle: "restore-backup";
    data: { backup: string };
};