import { useCallback, useEffect, useState } from "react";

export function useCopyToClipboardWithState() {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (copied) {
            const timer = setTimeout(() => {
                setCopied(false);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [copied]);

    const copy = useCallback(
        (text: string) => {
            if (!copied) {
                navigator.clipboard.writeText(text);
                setCopied(true);
            }
        },
        [copied]
    );

    return { copied, copy };
}
