import { sdkConfigStore } from "@frak-labs/core-sdk";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { onClientReady } from "@/utils/clientReady";

export function useClientReady() {
    const [disabled, setDisabled] = useState(true);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    const handleClientReady = useCallback(() => {
        const shouldWaitForBackendConfig =
            window.FrakSetup?.config?.waitForBackendConfig !== false;

        if (!shouldWaitForBackendConfig || sdkConfigStore.isResolved) {
            setDisabled(false);
            return;
        }

        unsubscribeRef.current = sdkConfigStore.subscribe((config) => {
            if (!config.isResolved) return;
            setDisabled(false);
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

    return { isClientReady: !disabled };
}
