import { useMatches } from "@tanstack/react-router";

declare module "@tanstack/react-router" {
    interface StaticDataRouteOption {
        /** "bare" renders the route without the app shell (header + nav). */
        shell?: "bare";
    }
}

export function useIsBareShell(): boolean {
    return useMatches({
        select: (matches) =>
            matches.some((match) => match.staticData?.shell === "bare"),
    });
}
