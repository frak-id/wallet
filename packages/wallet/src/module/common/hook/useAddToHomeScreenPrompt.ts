"use client";

import { useEffect, useState } from "react";

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
    async function launchInstallation() {
        if (prompt) {
            const userChoices = await prompt.prompt();
            setOutcome(userChoices.outcome);
        }

        throw new Error(
            'Tried installing before browser sent "beforeinstallprompt" event'
        );
    }

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
