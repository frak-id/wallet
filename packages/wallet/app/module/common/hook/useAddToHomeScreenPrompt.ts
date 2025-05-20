import { useCallback, useEffect, useState } from "react";

declare global {
    interface Window {
        promptEvent?: IBeforeInstallPromptEvent;
    }
}

interface IBeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    prompt(): Promise<{
        outcome: "accepted" | "dismissed";
        platform: string;
    }>;
}

export function useAddToHomeScreenPrompt() {
    // The current prompt returned by the browser
    const [prompt, setState] = useState<IBeforeInstallPromptEvent | null>(null);

    // Is the app installed ?
    const [isInstalled, setIsInstalled] = useState<boolean>(false);

    const [outcome, setOutcome] = useState<"accepted" | "dismissed" | null>(
        null
    );

    // Launch the installation prompt
    const launchInstallation = useCallback(async () => {
        if (!prompt) {
            throw new Error(
                'Tried installing before browser sent "beforeinstallprompt" event'
            );
        }

        const userChoices = await prompt.prompt();
        setOutcome(userChoices.outcome);

        // Set the prompt to null because we can't use it anymore
        setState(null);
    }, [prompt]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!window.promptEvent) return;

            // Set the window.promptEvent to the current prompt
            setState(window.promptEvent);

            // Stop polling after the event is available
            if (window.promptEvent) clearInterval(interval);
        }, 500);

        // Stop polling after 5 seconds (iOS never fires the event)
        const timeout = setTimeout(() => clearInterval(interval), 5000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, []);

    // Listen on the appinstalled event (to know if we just installed the PWA)
    useEffect(() => {
        const onInstall = ((e: Event) => {
            e.preventDefault();
            setIsInstalled(true);
        }) as EventListenerOrEventListenerObject;

        window.addEventListener("appinstalled", onInstall);

        return () => {
            window.removeEventListener("appinstalled", onInstall);
        };
    }, []);

    return { prompt, outcome, launchInstallation, isInstalled };
}
