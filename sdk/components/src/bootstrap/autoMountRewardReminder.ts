import { sdkConfigStore } from "@frak-labs/core-sdk";
import { isRewardReminderEnabled } from "../rewards/reminderConfig";
import { onClientReady } from "./clientReady";

function scheduleIdle(callback: () => void) {
    if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(callback);
    } else {
        setTimeout(callback, 1);
    }
}

function loadMountModule() {
    import(
        /* webpackChunkName: "mount-reward-reminder" */ "./mountRewardReminder"
    )
        .then(({ mountRewardReminder }) => mountRewardReminder())
        .catch((error) => console.error(error));
}

/** Once the client is ready and the backend config resolved, mounts the reminder for a visitor with something to claim. */
export function autoMountRewardReminder(): () => void {
    let done = false;

    const attempt = () => {
        if (done || !window.FrakSetup?.client || !sdkConfigStore.isResolved) {
            return;
        }
        // A cached config also reads as resolved, so a "no" stays open to the fresh one.
        if (sdkConfigStore.getConfig().hidden || !isRewardReminderEnabled()) {
            return;
        }
        done = true;
        window.removeEventListener("frak:config", attempt);
        onClientReady("remove", attempt);
        scheduleIdle(loadMountModule);
    };

    window.addEventListener("frak:config", attempt);
    onClientReady("add", attempt);
    return () => {
        window.removeEventListener("frak:config", attempt);
        onClientReady("remove", attempt);
    };
}
