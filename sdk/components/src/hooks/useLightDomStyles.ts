import { useEffect } from "preact/hooks";
import { lightDomBaseCss } from "@/styles/sharedCss";
import { styleManager } from "@/styles/styleManager";

export function useLightDomStyles(
    tag: string,
    placementId?: string,
    placementCss?: string,
    baseCss?: string,
    sharedBaseCss?: string
): void {
    useEffect(() => {
        // Components that pass `sharedBaseCss` (PostPurchase, Banner) opt into
        // vanilla-extract styling and need the shared design-system base
        // (reset + theme tokens) injected once. In CDN mode this is also
        // injected at boot by loader.ts — styleManager.injectBase is idempotent
        // on the tag id, so the duplicate call is a no-op.
        if (sharedBaseCss) {
            styleManager.injectBase("shared", sharedBaseCss);
        }
        styleManager.injectBase(tag, baseCss ?? lightDomBaseCss);
    }, [tag]);

    useEffect(() => {
        if (!placementId || !placementCss) return;
        styleManager.injectPlacement(tag, placementId, placementCss);
    }, [tag, placementId, placementCss]);
}
