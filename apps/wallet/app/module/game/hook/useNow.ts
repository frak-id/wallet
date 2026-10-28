import { useEffect, useState } from "react";

/** `Date.now()`, refreshed every `everyMs`. */
export function useNow(everyMs: number) {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), everyMs);
        return () => clearInterval(id);
    }, [everyMs]);
    return now;
}
