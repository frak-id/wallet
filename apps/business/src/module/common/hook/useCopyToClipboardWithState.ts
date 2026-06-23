import { useCallback, useEffect, useState } from "react";

export function useCopyToClipboardWithState() {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const timer = setTimeout(() => setCopied(false), 2000);
        return () => clearTimeout(timer);
    }, [copied]);

    const copy = useCallback(
        async (text: string) => {
            if (copied) return;
            try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
            } catch {
                // Clipboard API may fail in non-secure contexts.
            }
        },
        [copied]
    );

    return { copied, copy };
}
