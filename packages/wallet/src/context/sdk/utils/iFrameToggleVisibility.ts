/**
 * Toggle the listener iFrame visibility
 *   - It's used to display modal when needed
 * @param visibility
 */
export function iFrameToggleVisibility(visibility: boolean) {
    window.parent?.postMessage(
        { lifecycle: visibility ? "show" : "hide" },
        "*"
    );
}
