import { detectPWA } from "@frak-labs/ui/utils/detectPWA";
import { useEffect } from "react";

export function DetectPWA() {
    useEffect(() => {
        if (typeof window === "undefined") return;

        const rootElement = document.querySelector(":root") as HTMLElement;
        const pwaStatus = detectPWA();

        if (pwaStatus.isPWA) {
            rootElement.dataset.pwa = "true";
        }

        if (pwaStatus.isPWAIos) {
            rootElement.dataset.iosPwa = "true";
        }

        return () => {
            rootElement.removeAttribute("data-pwa");
        };
    }, []);

    return null;
}
