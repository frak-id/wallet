import { useEffect, useState } from "react";

type LaunchParams = Readonly<{
    targetURL: string;
    files?: FileSystemHandle[];
}>;

type LaunchQueueConsumer = (params: LaunchParams) => void;

type LaunchQueue = Readonly<{
    setConsumer: (consumer: LaunchQueueConsumer) => void;
}>;

/**
 * Hook to ease the use of launch queue with react
 *  - Spec: https://wicg.github.io/web-app-launch/#launchqueue-interface
 *  - Google doc: https://developer.chrome.com/docs/web-platform/launch-handler
 *
 *  Not rly promising results, should handle the URL manually (tried with "focus-existing" and "navigate-existing" launch modes)
 *   - Keep it here for now for other tests
 */
export function useLaunchQueue() {
    const [isSupported, setIsSupported] = useState<boolean>(false);
    const [lastParams, setLastParams] = useState<LaunchParams | null>(null);

    // Setup a launch queue listener on mount
    useEffect(() => {
        // Early exit if browser doesn't support launchQueue
        if (!("launchQueue" in window)) {
            setIsSupported(false);
            console.warn("launchQueue not supported");
            return;
        }
        setIsSupported(true);

        (<LaunchQueue>window.launchQueue).setConsumer((launchParams) => {
            console.log("Launch queue event", launchParams);
            setLastParams(launchParams);
            // TODO: Sofltly handle the launchParams
            // TODO: If an important operation is in progress, just display a notification that should be click by the user, with the option to go back?
        });
    }, []);

    return { isSupported, lastParams };
}
