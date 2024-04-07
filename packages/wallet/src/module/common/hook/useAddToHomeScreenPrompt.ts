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

    return { prompt, outcome, launchInstallation };
}
