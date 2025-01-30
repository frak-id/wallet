import { useEffect } from "react";

/**
 * Listens for when the escape key is down
 */
export function useEscapeKeydown(
    onEscapeKeyDown?: (event: KeyboardEvent) => void
) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onEscapeKeyDown?.(event);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onEscapeKeyDown]);
}
