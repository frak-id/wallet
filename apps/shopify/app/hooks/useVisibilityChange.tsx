import { useEffect } from "react";

export const useVisibilityChange = (callback: () => void) => {
    useEffect(() => {
        if (typeof window !== "undefined" && window.addEventListener) {
            const visibilitychangeHandler = () => {
                if (document.visibilityState === "visible") {
                    callback();
                }
            };

            window.addEventListener(
                "visibilitychange",
                visibilitychangeHandler,
                false
            );

            return () => {
                window.removeEventListener(
                    "visibilitychange",
                    visibilitychangeHandler
                );
            };
        }
    }, [callback]);
};
