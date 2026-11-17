import { useCallback, useEffect, useState } from "react";

const COPIED_MS = 2000;

export function useCopyToClipboardWithState() {
    const [copiedAt, setCopiedAt] = useState<number | null>(null);

    useEffect(() => {
        if (copiedAt === null) return;
        const timer = setTimeout(() => setCopiedAt(null), COPIED_MS);
        return () => clearTimeout(timer);
    }, [copiedAt]);

    // Writes on every call: a page with two copy targets must not keep the first value.
    const copy = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedAt(performance.now());
    }, []);

    return { copied: copiedAt !== null, copy };
}
