type NavigatorStandalone = {
    standalone?: boolean;
};

export function detectPWA() {
    const navigatorCheck = {
        // Check if running in standalone mode (installed PWA)
        isStandalone: () => {
            const standalone = window.matchMedia(
                "(display-mode: standalone)"
            ).matches;
            const iOSStandalone = (window.navigator as NavigatorStandalone)
                .standalone;
            return standalone || iOSStandalone;
        },

        // Check if running in standalone mode (installed PWA) on iOS
        isIosStandalone: () => {
            return (window.navigator as NavigatorStandalone).standalone;
        },

        // Check for PWA display mode
        getDisplayMode: () => {
            const modes = ["fullscreen", "standalone", "minimal-ui", "browser"];
            return (
                modes.find(
                    (mode) =>
                        window.matchMedia(`(display-mode: ${mode})`).matches
                ) || "browser"
            );
        },
    };

    return {
        isPWA: navigatorCheck.isStandalone(),
        isPWAIos: navigatorCheck.isIosStandalone(),
        displayMode: navigatorCheck.getDisplayMode(),
    };
}
