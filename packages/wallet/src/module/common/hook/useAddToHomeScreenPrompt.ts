"use client";

import { useCallback, useEffect, useState } from "react";

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

    // Listen on the beforeinstallprompt event (to know if we can install or not the PWA)
    useEffect(() => {
        const ready = ((e: IBeforeInstallPromptEvent) => {
            e.preventDefault();
            setState(e);
        }) as EventListenerOrEventListenerObject;

        window.addEventListener("beforeinstallprompt", ready);

        return () => {
            window.removeEventListener("beforeinstallprompt", ready);
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
