export function modalShare() {
    if (!window.NexusSDK.modalBuilderSteps) {
        console.error("Frak client not initialized");
        return;
    }
    window.NexusSDK.modalBuilderSteps
        .sharing({
            popupTitle: "Share this article with your friends",
            text: "Discover this awesome article",
            link: typeof window !== "undefined" ? window.location.href : "",
        })
        .display();
}
