import type { Session } from "@/types/Session";
import { useLocalStorage } from "@uidotdev/usehooks";
import { useEffect } from "react";

type LastAuthentication = Session;

/**
 * Simple hook to get last authentication data and set it
 * TODO: Move that into a zustand / tanstak store to prevent multiple local storage load, since this hook will be called multiple times
 */
export function useLastAuthentication() {
    /**
     * TODO: Should we experiment with IndexedDb here? With Dexie/IDB/idb-keyval? Idk what's the best, maybe ussing zustand and a wrapper arround it?
     */
    const [lastAuthentication, setLastAuthentication] =
        useLocalStorage<LastAuthentication>("lastAuthentication");

    useEffect(() => {
        console.log("Rebuilding", { setLastAuthentication });
    }, [setLastAuthentication]);

    return {
        username: lastAuthentication?.username,
        wallet: lastAuthentication?.wallet,
        setLastAuthentication,
    };
}
