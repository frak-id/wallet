import { useSyncExternalStore } from "react";
import { useDemoStore } from "@/core/store";

function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (onChange) => {
            const list = window.matchMedia(query);
            list.addEventListener("change", onChange);
            return () => list.removeEventListener("change", onChange);
        },
        () => window.matchMedia(query).matches
    );
}

/** Room for a phone drawn at a readable size: laptops, tablets, projectors. */
const ROOMY = "(min-width: 700px) and (min-height: 620px)";
/** Room for the presenter panel next to the phone. */
const WIDE = "(min-width: 1080px) and (min-height: 620px)";

/** Draw a phone frame around the demo, or run it edge to edge on a real phone. */
export function useFramed(): boolean {
    const frame = useDemoStore((s) => s.frame);
    const roomy = useMediaQuery(ROOMY);
    if (frame === "on") return true;
    if (frame === "off") return false;
    return roomy;
}

export function useWide(): boolean {
    return useMediaQuery(WIDE);
}
