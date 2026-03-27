import { allWelcomeSlideIds, type WelcomeSlideId } from "./types";

const STORAGE_KEY = "frak_welcome_dismissed";

function isWelcomeSlideId(value: unknown): value is WelcomeSlideId {
    return allWelcomeSlideIds.includes(value as WelcomeSlideId);
}

export function getDismissedSlides(): WelcomeSlideId[] {
    try {
        const storedValue = localStorage.getItem(STORAGE_KEY);

        if (!storedValue) {
            return [];
        }

        if (storedValue === "true") {
            return [...allWelcomeSlideIds];
        }

        const parsedValue = JSON.parse(storedValue);

        if (!Array.isArray(parsedValue)) {
            return [];
        }

        return parsedValue.filter(isWelcomeSlideId);
    } catch {
        return [];
    }
}

export function persistDismissedSlides(slides: WelcomeSlideId[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slides));
    } catch {}
}
