import { useEffect } from "react";

type NavigatorStandalone = {
    standalone?: boolean;
};

function detectPWA() {
    const isStandalone = () => {
        const standalone = window.matchMedia(
            "(display-mode: standalone)"
        ).matches;
        const iOSStandalone = (window.navigator as NavigatorStandalone)
            .standalone;
        return standalone || iOSStandalone;
    };

    const isIosStandalone = () => {
        return (window.navigator as NavigatorStandalone).standalone;
    };

    return {
        isPWA: isStandalone(),
        isPWAIos: isIosStandalone(),
    };
}

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
