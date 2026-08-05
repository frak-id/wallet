import { useEffect } from "react";

/**
 * Let a native host's sheet show through this page's corners.
 *
 * The host's sheet clips the WebView to a rectangle now (see `cornerRadius` in
 * `../params/table.ts` for why), so the rounding is drawn by this page
 * instead. For that to read as a rounded sheet rather than a rounded card on a
 * square white page, the document behind it has to be transparent.
 *
 * `defaults.css.ts` sets an opaque `body` background via `globalStyle`, and
 * the root `AGENTS.md` forbids adding another `globalStyle` to carve out an
 * exception — so the previous inline value is read and restored here instead,
 * scoped to this route only.
 *
 * `document` always exists when this runs: `apps/wallet` has SSR disabled and
 * boots through `react-dom/client`'s `createRoot` (see `app/main.tsx`), so
 * this never renders outside a browser.
 */
export function useHostCornerRadius(cornerRadius: number | undefined) {
    useEffect(() => {
        if (!cornerRadius) return;
        const { documentElement, body } = document;
        const previousHtmlBackground = documentElement.style.backgroundColor;
        const previousBodyBackground = body.style.backgroundColor;
        documentElement.style.backgroundColor = "transparent";
        body.style.backgroundColor = "transparent";
        return () => {
            documentElement.style.backgroundColor = previousHtmlBackground;
            body.style.backgroundColor = previousBodyBackground;
        };
    }, [cornerRadius]);
}
