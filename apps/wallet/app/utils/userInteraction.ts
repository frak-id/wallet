let interacted = false;

/** Call once at boot. After the first tap or key press, a reload could lose what the user started. */
export function trackUserInteraction(): void {
    const mark = () => {
        interacted = true;
    };
    window.addEventListener("pointerdown", mark, { capture: true, once: true });
    window.addEventListener("keydown", mark, { capture: true, once: true });
}

export function hasUserInteracted(): boolean {
    return interacted;
}
