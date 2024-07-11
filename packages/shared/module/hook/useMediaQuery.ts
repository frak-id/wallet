import { useEffect, useMemo, useState } from "react";

export function useMediaQuery(query: string) {
    const mediaQueryList = useMemo(() => {
        if (typeof window !== "undefined") {
            return window.matchMedia(query);
        }
        return null;
    }, [query]);

    const [matches, setMatches] = useState(() =>
        mediaQueryList ? mediaQueryList.matches : false
    );

    useEffect(() => {
        if (!mediaQueryList) {
            return;
        }

        const documentChangeHandler = () => setMatches(mediaQueryList.matches);

        mediaQueryList.addEventListener("change", documentChangeHandler);

        // Clean up listener on unmount
        return () =>
            mediaQueryList.removeEventListener("change", documentChangeHandler);
    }, [mediaQueryList]);

    return matches;
}
