import { useEffect, useState } from "react";
import { useMounted } from "./useMounted";

export const useWindowLocation = (): {
    location: Location | undefined;
    href: string | undefined;
} => {
    const isMounted = useMounted();
    const [location, setLocation] = useState<Location | undefined>(
        isMounted ? window.location : undefined
    );
    const [href, setHref] = useState<string | undefined>(
        isMounted ? window.location.href : undefined
    );

    useEffect(() => {
        if (!isMounted) return;

        const setWindowLocation = () => {
            setLocation(window.location);
            setHref(window.location.href);
        };

        if (!location) {
            setWindowLocation();
        }

        window.addEventListener("popstate", setWindowLocation);

        return () => {
            window.removeEventListener("popstate", setWindowLocation);
        };
    }, [isMounted, location]);

    return { location, href };
};
