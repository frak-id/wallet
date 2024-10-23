import { loginModalStep } from "./config";

export function modalShare() {
    const finalAction = {
        key: "sharing",
        options: {
            popupTitle: "Share this article with your friends",
            text: "Discover this awesome article",
            link: typeof window !== "undefined" ? window.location.href : "",
        },
    } as const;
    if (!window.FrakSetup.frakClient) {
        console.error("Frak client not initialized");
        return;
    }
    window.NexusSDK.displayModal(window.FrakSetup.frakClient, {
        metadata: {
            lang: "fr",
            isDismissible: true,
        },
        steps: {
            login: loginModalStep,
            openSession: {},
            final: {
                action: finalAction,
            },
        },
    });
}
