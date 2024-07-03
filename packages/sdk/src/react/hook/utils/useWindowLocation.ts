import { useEffect, useMemo, useState } from "react";
import { useMounted } from "./useMounted";

/**
 * Returns the current window location and href
 */
export function useWindowLocation(): {
    location: Location | undefined;
    href: string | undefined;
} {
    const isMounted = useMounted();
    const [location, setLocation] = useState<Location | undefined>(
        isMounted ? window.location : undefined
    );

    useEffect(() => {
        if (!isMounted) return;

        // Method to the current window location
        function setWindowLocation() {
            setLocation(window.location);
        }

        if (!location) {
            setWindowLocation();
        }

        window.addEventListener("popstate", setWindowLocation);

        return () => {
            window.removeEventListener("popstate", setWindowLocation);
        };
    }, [isMounted, location]);

    // Derive the href from the location
    const href = useMemo(() => location?.href, [location?.href]);

    return { location, href };
}
