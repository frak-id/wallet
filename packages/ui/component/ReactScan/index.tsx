import { useEffect } from "react";

export function ReactScan() {
    useEffect(() => {
        import("react-scan").then(({ Store, scan }) => {
            Store.isInIframe.value = false;
            scan({
                enabled: true,
                log: false,
            });
        });
    }, []);

    return null;
}
