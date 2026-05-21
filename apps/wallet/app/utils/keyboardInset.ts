import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";

/**
 * Mirror `window.visualViewport.height` into a `--viewport-height` CSS
 * variable on `:root`. The app shell consumes it as
 * `height: var(--viewport-height, 100dvh)` so the layout shrinks when the
 * soft keyboard opens, keeping pinned footers above it.
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

    const write = () => {
        rafId = null;
        document.documentElement.style.setProperty(
            "--viewport-height",
            `${vv.height}px`
        );
    };

    const schedule = () => {
        if (rafId !== null) return;
        rafId = window.requestAnimationFrame(write);
    };

    // Seed the variable so consumers always read a defined value.
    write();

    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);

    return () => {
        if (rafId !== null) {
            window.cancelAnimationFrame(rafId);
            rafId = null;
        }
        vv.removeEventListener("resize", schedule);
        vv.removeEventListener("scroll", schedule);
        document.documentElement.style.removeProperty("--viewport-height");
    };
}
