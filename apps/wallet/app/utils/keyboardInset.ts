import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";

/**
 * Mirror `window.visualViewport.height` into a `--viewport-height` CSS variable
 * (plus `--keyboard-open`) so the shell shrinks when the soft keyboard opens.
 * Tauri-only: on iOS WKWebView `dvh` ignores the keyboard, and on edge-to-edge
 * Android `adjustResize` is often not honored, so `dvh` stays at full height.
 * Returns a cleanup that detaches the listeners.
 */
export function initKeyboardInset(): () => void {
    if (typeof window === "undefined") return () => {};
    if (!IS_TAURI) return () => {};

    const vv = window.visualViewport;
    if (!vv) return () => {};

    let rafId: number | null = null;
    // Max height seen = "no keyboard" baseline (robust under edge-to-edge).
    let baseline = vv.height;
    // Smaller shrinkage is toolbar jitter, not the IME (keyboard ~250-350px).
    const KEYBOARD_THRESHOLD_PX = 120;

    // iOS scrolls the document to reveal a focused input, dragging the shell up
    // and leaving a gap below the footer. Snap it back to the top.
    const pinScroll = () => {
        if (window.scrollY !== 0 || window.scrollX !== 0)
            window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };

    const write = () => {
        rafId = null;
        baseline = Math.max(baseline, vv.height);
        const keyboardOpen = baseline - vv.height > KEYBOARD_THRESHOLD_PX;
        const root = document.documentElement.style;
        root.setProperty("--viewport-height", `${vv.height}px`);
        root.setProperty("--keyboard-open", keyboardOpen ? "1" : "0");
        pinScroll();
    };

    const schedule = () => {
        if (rafId !== null) return;
        rafId = window.requestAnimationFrame(write);
    };

    // Seed the variable so consumers always read a defined value.
    write();

    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("scroll", pinScroll, { passive: true });

    return () => {
        if (rafId !== null) {
            window.cancelAnimationFrame(rafId);
            rafId = null;
        }
        vv.removeEventListener("resize", schedule);
        vv.removeEventListener("scroll", schedule);
        window.removeEventListener("scroll", pinScroll);
        document.documentElement.style.removeProperty("--viewport-height");
        document.documentElement.style.removeProperty("--keyboard-open");
    };
}
