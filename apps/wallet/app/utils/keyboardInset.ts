import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";

/**
 * Mirror `window.visualViewport.height` into a `--viewport-height` CSS
 * variable on `:root`. The app shell consumes it as
 * `height: var(--viewport-height, 100dvh)` so the layout shrinks when the
 * soft keyboard opens, keeping pinned footers above it. Also publishes
 * `--keyboard-open` (`0`/`1`), read by initSafeAreaInsets to collapse the
 * nav-bar inset while the keyboard is up.
 *
 * Why not `100dvh` alone: on Tauri iOS (WKWebView) `dvh` does not react to
 * the keyboard at all, and on Tauri Android the WebView often runs in
 * edge-to-edge mode where `android:windowSoftInputMode="adjustResize"` is
 * not honored — `dvh` stays at the full screen height even with the IME
 * visible. Reading `visualViewport.height` works in both cases: when the
 * native shell already resized the WebView, `vv.height` matches the (already
 * shrunk) layout viewport so the variable is a no-op; when it didn't, the
 * variable provides the missing shrinkage.
 *
 * Scope: gated on `IS_TAURI` because regular browsers/PWA handle keyboard
 * insets correctly through `dvh` and the upcoming `interactive-widget`
 * viewport directive, and we don't want to fight them.
 *
 * Returns a cleanup function (used by tests; production callers don't need
 * it since the listeners live for the document's lifetime).
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
