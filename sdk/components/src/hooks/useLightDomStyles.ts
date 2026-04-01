import { useEffect } from "preact/hooks";
import { lightDomBaseCss } from "@/utils/sharedCss";
import { styleManager } from "@/utils/styleManager";

export function useLightDomStyles(
    tag: string,
    placementId?: string,
    placementCss?: string
): void {
    useEffect(() => {
        styleManager.injectBase(tag, lightDomBaseCss);
    }, [tag]);

    useEffect(() => {
        if (!placementId || !placementCss) return;
        styleManager.injectPlacement(tag, placementId, placementCss);
    }, [tag, placementId, placementCss]);
}
