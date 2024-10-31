export function modalShare() {
    if (!window.FrakSetup.modalBuilder) {
        console.error("Frak client not initialized");
        return;
    }
    window.FrakSetup.modalBuilder
        .sharing({
            popupTitle: "Share this article with your friends",
            text: "Discover this awesome article",
            link: typeof window !== "undefined" ? window.location.href : "",
        })
        .display();
}
