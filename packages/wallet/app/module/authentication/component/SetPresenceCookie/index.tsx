import { useEffect } from "react";

export function SetPresenceCookie() {
    /**
     * Set the cookie to know that the user has visited the page
     * useful for Safari Intelligent Tracking Prevention
     */
    useEffect(() => {
        document.cookie =
            "hasVisited=true; Secure; Path=/; SameSite=None; Max-Age=34560000";
    }, []);

    return null;
}
