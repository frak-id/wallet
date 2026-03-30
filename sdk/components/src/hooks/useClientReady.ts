import { sdkConfigStore } from "@frak-labs/core-sdk";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { onClientReady } from "@/utils/clientReady";

export function useClientReady() {
    const [disabled, setDisabled] = useState(true);
    const [isHidden, setIsHidden] = useState(false);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    const handleClientReady = useCallback(() => {
        const shouldWaitForBackendConfig =
            window.FrakSetup?.config?.waitForBackendConfig !== false;

        if (!shouldWaitForBackendConfig || sdkConfigStore.isResolved) {
            setDisabled(false);
            setIsHidden(sdkConfigStore.getConfig().hidden ?? false);
            return;
        }

        unsubscribeRef.current = sdkConfigStore.subscribe((config) => {
            if (!config.isResolved) return;
            setDisabled(false);
            setIsHidden(config.hidden ?? false);
            unsubscribeRef.current?.();
            unsubscribeRef.current = null;
        });
    }, []);

    useEffect(() => {
        onClientReady("add", handleClientReady);
        return () => {
            onClientReady("remove", handleClientReady);
            unsubscribeRef.current?.();
            unsubscribeRef.current = null;
        };
    }, [handleClientReady]);

    return { isClientReady: !disabled, isHidden };
}
