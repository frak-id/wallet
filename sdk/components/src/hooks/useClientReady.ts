import { type SdkResolvedConfig, sdkConfigStore } from "@frak-labs/core-sdk";
import { useEffect, useState } from "preact/hooks";
import { onClientReady } from "@/utils/clientReady";

export function useClientReady() {
    const [shouldRender, setShouldRender] = useState(() => {
        const mustWaitForConfig =
            window.FrakSetup?.config?.waitForBackendConfig !== false;
        if (!mustWaitForConfig) return true;
        return sdkConfigStore.isResolved;
    });

    const [isHidden, setIsHidden] = useState(
        () => sdkConfigStore.getConfig().hidden ?? false
    );

    const [isClientReady, setIsClientReady] = useState(
        () => !!window.FrakSetup?.client
    );

    useEffect(() => {
        // Re-check store to catch events fired between render and effect mount
        const currentConfig = sdkConfigStore.getConfig();
        if (currentConfig.isResolved) {
            setShouldRender(true);
            setIsHidden(currentConfig.hidden ?? false);
        }
        if (window.FrakSetup?.client) {
            setIsClientReady(true);
        }

        const onConfig = (e: CustomEvent<SdkResolvedConfig>) => {
            const config = e.detail;
            if (config.isResolved) {
                setShouldRender(true);
            }
            setIsHidden(config.hidden ?? false);
        };
        window.addEventListener("frak:config", onConfig);

        const handleReady = () => setIsClientReady(true);
        onClientReady("add", handleReady);

        return () => {
            window.removeEventListener("frak:config", onConfig);
            onClientReady("remove", handleReady);
        };
    }, []);

    return { shouldRender, isHidden, isClientReady };
}
