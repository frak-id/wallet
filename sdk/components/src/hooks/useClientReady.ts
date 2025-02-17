import { onClientReady } from "@/utils/clientReady";
import { useCallback, useEffect, useState } from "preact/hooks";

/**
 * Hook to manage client readiness state for the wallet button
 * Handles subscription to client ready events and manages readiness state
 * @returns Object containing the readiness state of the client
 */
export function useClientReady() {
    const [disabled, setDisabled] = useState(true);

    const handleClientReady = useCallback(() => {
        setDisabled(false);
    }, []);

    useEffect(() => {
        onClientReady("add", handleClientReady);
        return () => onClientReady("remove", handleClientReady);
    }, [handleClientReady]);

    return { isClientReady: !disabled };
}
