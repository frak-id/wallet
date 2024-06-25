export function iFrameToggleVisibility(visibility: boolean) {
    window.parent?.postMessage(
        { lifecycle: visibility ? "show" : "hide" },
        "*"
    );
}
