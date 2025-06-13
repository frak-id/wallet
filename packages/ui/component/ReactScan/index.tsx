import { useEffect } from "react";
import { Store, scan } from "react-scan";

export function ReactScan() {
    useEffect(() => {
        Store.isInIframe.value = false;
        scan({
            enabled: true,
            log: false,
        });
    }, []);

    return null;
}
